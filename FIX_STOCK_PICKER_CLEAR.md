# 修复：智能选股历史数据清理问题

## 🐛 问题描述

用户报告：清空股票池并添加新股票后，分析结果仍然显示旧股票的数据，而不是新添加的股票。

## 🔍 根本原因

1. **`clear_pool()` 方法只清空股票池表**
   - 只删除了 `stock_picker_pools` 表的数据
   - 但没有清理 `stock_picker_analysis` 表（分析结果表）

2. **`get_analysis_results()` 查询逻辑问题**
   - 查询所有历史分析结果，不管股票是否还在当前池中
   - 通过 `MAX(id)` 获取最新分析，但没有验证对应的股票池记录是否存在

## ✅ 修复方案

### 1. 修复 `clear_pool()` 方法

**之前**：
```python
def clear_pool(self, pool_type: str) -> int:
    with get_connection() as conn:
        # 只删除股票池
        conn.execute("DELETE FROM stock_picker_pools WHERE pool_type = ?", (pool_type,))
```

**修复后**：
```python
def clear_pool(self, pool_type: str) -> int:
    with get_connection() as conn:
        # 1. 删除该股票池的所有历史分析结果
        conn.execute("DELETE FROM stock_picker_analysis WHERE pool_type = ?", (pool_type,))
        
        # 2. 删除股票池
        conn.execute("DELETE FROM stock_picker_pools WHERE pool_type = ?", (pool_type,))
        
        # 3. 清理内存缓存
        cache_keys = [k for k in self.cache.keys() if k.endswith(f"_{pool_type}")]
        for key in cache_keys:
            del self.cache[key]
```

### 2. 加强 `get_analysis_results()` 查询

**之前**：
```sql
SELECT a.*, p.name
FROM stock_picker_analysis a
JOIN stock_picker_pools p ON a.pool_id = p.id
WHERE p.is_active = TRUE
AND a.id IN (
    SELECT MAX(id) FROM stock_picker_analysis 
    GROUP BY symbol, pool_type
)
```
问题：`MAX(id)` 可能返回已被删除的股票池中的分析结果

**修复后**：
```sql
SELECT a.*, p.name
FROM stock_picker_analysis a
JOIN stock_picker_pools p ON a.pool_id = p.id
WHERE p.is_active = TRUE
AND a.pool_id = p.id  -- 确保分析对应的股票还在池中
AND a.id IN (
    SELECT MAX(a2.id)
    FROM stock_picker_analysis a2
    JOIN stock_picker_pools p2 ON a2.pool_id = p2.id
    WHERE p2.is_active = TRUE
    GROUP BY a2.symbol, a2.pool_type
)
```

## 📝 使用场景

### 场景1：清空股票池
```python
# 前端调用
DELETE /api/stock-picker/pools/clear/LONG

# 现在会：
# 1. 删除 LONG 池的所有历史分析结果
# 2. 删除 LONG 池的所有股票
# 3. 清理内存缓存
```

### 场景2：添加新股票并分析
```python
# 1. 清空旧池
DELETE /api/stock-picker/pools/clear/LONG

# 2. 批量添加新股票
POST /api/stock-picker/pools/batch
{
  "pool_type": "LONG",
  "symbols": ["AAPL", "TSLA", "GOOGL"]
}

# 3. 开始分析
POST /api/stock-picker/analyze
{
  "pool_type": "LONG",
  "force_refresh": true  # 强制刷新
}

# 4. 获取结果 - 现在只会返回 AAPL, TSLA, GOOGL 的分析
GET /api/stock-picker/analysis?pool_type=LONG
```

## 🧪 测试步骤

1. **清空测试**：
```bash
# 清空 LONG 池
curl -X DELETE http://localhost:8000/api/stock-picker/pools/clear/LONG

# 验证：查询分析结果应该为空
curl http://localhost:8000/api/stock-picker/analysis?pool_type=LONG
# 应返回：{"long_analysis": [], "short_analysis": [], "stats": {...}}
```

2. **重新添加并分析**：
```bash
# 添加新股票
curl -X POST http://localhost:8000/api/stock-picker/pools/batch \
  -H "Content-Type: application/json" \
  -d '{"pool_type": "LONG", "symbols": ["AAPL", "TSLA"]}'

# 分析
curl -X POST http://localhost:8000/api/stock-picker/analyze \
  -H "Content-Type: application/json" \
  -d '{"pool_type": "LONG", "force_refresh": true}'

# 验证：结果应该只包含 AAPL 和 TSLA
curl http://localhost:8000/api/stock-picker/analysis?pool_type=LONG
```

## 📊 数据库影响

### 清空前
```sql
-- stock_picker_pools 表
LONG | NEWZ.US | ...
LONG | MNDY.US | ...
...

-- stock_picker_analysis 表
1 | pool_id=1 | NEWZ.US | LONG | ...
2 | pool_id=2 | MNDY.US | LONG | ...
...
```

### 清空后
```sql
-- stock_picker_pools 表
(空)

-- stock_picker_analysis 表
(空)  -- 🔥 修复后会清理
```

## 🎯 预期效果

修复后的行为：

1. **清空股票池** → 同时清理历史分析结果 + 缓存
2. **添加新股票** → 干净的起点，没有旧数据干扰
3. **分析新股票** → 只分析当前池中的股票
4. **查看结果** → 只显示当前池中股票的分析

## ⚠️ 注意事项

1. **数据丢失警告**：清空股票池会删除所有历史分析数据，无法恢复
2. **缓存清理**：内存缓存也会被清理，下次分析需要重新计算
3. **并发安全**：使用数据库事务确保清理的原子性

## 📅 修复日期

2025-11-03

---

**总结**：通过同时清理股票池和分析结果表，确保用户看到的始终是当前股票池的最新分析数据。
