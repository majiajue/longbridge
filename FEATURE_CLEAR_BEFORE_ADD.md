# ✨ 新功能：批量添加时清空现有数据

## 🎯 功能说明

在批量添加股票时，可以选择**先清空现有的股票池**，然后再添加新股票。

这个功能非常适合：
- 完全替换股票池
- 重新导入新的股票列表
- 清理旧数据重新开始

---

## 🔧 技术实现

### 后端实现

#### 1. 新增 API 接口

**路径**：`DELETE /api/stock-picker/pools/clear/{pool_type}`

**参数**：
- `pool_type`: `LONG` 或 `SHORT`

**响应**：
```json
{
  "success": true,
  "message": "已清空15只股票",
  "count": 15
}
```

**文件**：`backend/app/routers/stock_picker.py`
```python
@router.delete("/pools/clear/{pool_type}")
async def clear_pool(pool_type: str):
    """
    清空指定类型的股票池
    
    Args:
        pool_type: LONG | SHORT
    """
    if pool_type not in ['LONG', 'SHORT']:
        raise HTTPException(status_code=400, detail="pool_type 必须是 LONG 或 SHORT")
    
    service = get_stock_picker_service()
    count = service.clear_pool(pool_type)
    return {"success": True, "message": f"已清空{count}只股票", "count": count}
```

---

#### 2. 服务层方法

**文件**：`backend/app/stock_picker.py`
```python
def clear_pool(self, pool_type: str) -> int:
    """清空指定类型的股票池"""
    with get_connection() as conn:
        # 获取要删除的数量
        count_result = conn.execute(
            "SELECT COUNT(*) as cnt FROM stock_picker_pools WHERE pool_type = ?",
            (pool_type,)
        ).fetchone()
        count = count_result[0] if count_result else 0
        
        # 删除股票
        conn.execute("DELETE FROM stock_picker_pools WHERE pool_type = ?", (pool_type,))
        
        logger.info(f"清空股票池: {pool_type} - {count}只股票")
        return count
```

---

### 前端实现

#### 1. API 客户端

**文件**：`frontend/src/api/stockPicker.ts`
```typescript
/**
 * 清空股票池
 */
export async function clearPool(poolType: 'LONG' | 'SHORT'): Promise<{
  success: boolean;
  message: string;
  count: number;
}> {
  const response = await fetch(`${API_BASE}/api/stock-picker/pools/clear/${poolType}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '清空失败');
  }
  
  return response.json();
}
```

---

#### 2. UI 组件

**文件**：`frontend/src/pages/StockPicker.tsx`

**添加状态**：
```typescript
const [clearBeforeAdd, setClearBeforeAdd] = useState(false);
```

**添加复选框**（批量添加模式）：
```tsx
{/* 清空选项 */}
<div className="mt-3">
  <label className="flex items-center space-x-2 cursor-pointer">
    <input
      type="checkbox"
      checked={clearBeforeAdd}
      onChange={(e) => setClearBeforeAdd(e.target.checked)}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    />
    <span className="text-sm text-gray-700">
      添加前先清空现有的{type === 'LONG' ? '多头' : '空头'}股票池
    </span>
  </label>
  <p className="text-xs text-gray-500 ml-6 mt-1">
    ⚠️ 勾选后，将删除现有的所有{type === 'LONG' ? '多头' : '空头'}股票，然后添加新股票
  </p>
</div>
```

**批量添加逻辑**：
```typescript
// 如果勾选了清空现有数据，先清空
if (clearBeforeAdd) {
  await clearPool(type);
}

// 然后添加新股票
const result = await batchAddStocks({
  pool_type: type,
  symbols: symbols,
});
```

---

## 🚀 使用方法

### 第1步：打开批量添加对话框

1. 访问 http://localhost:5173
2. 进入「🎯 智能选股」Tab
3. 点击「➕ 添加股票」按钮
4. 选择「批量添加」模式

---

### 第2步：准备股票列表

粘贴您的新股票列表：
```
AAPL.US
MSFT.US
GOOGL.US
AMZN.US
META.US
```

或直接粘贴Python代码：
```python
['AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US']
```

---

### 第3步：勾选清空选项

✅ **勾选**：「添加前先清空现有的多头/空头股票池」

这样会：
1. 先删除现有的所有股票
2. 然后添加新的股票列表

---

### 第4步：提交

点击「批量添加」按钮

系统会：
1. ✅ 清空现有股票池（如果勾选了）
2. ✅ 添加新股票
3. ✅ 刷新页面显示

---

## 📊 使用场景

### 场景1：完全替换股票池

**需求**：想用新的20只股票完全替换现有的10只股票

**操作**：
1. 批量添加模式
2. ✅ 勾选「清空现有股票池」
3. 粘贴新的20只股票
4. 提交

**结果**：旧的10只被删除，新的20只被添加

---

### 场景2：追加股票（不清空）

**需求**：在现有10只股票基础上，再添加5只新股票

**操作**：
1. 批量添加模式
2. ❌ 不勾选「清空现有股票池」
3. 粘贴新的5只股票
4. 提交

**结果**：现有10只保留，新增5只，总共15只

---

### 场景3：每日更新策略股票池

**需求**：每天导入新的策略推荐股票，清空昨天的数据

**操作**：
1. 批量添加模式
2. ✅ 勾选「清空现有股票池」
3. 粘贴今天的策略股票
4. 提交

**结果**：昨天的股票被清空，今天的股票被添加

---

## ⚠️ 注意事项

### 1. 不可恢复

清空操作**不可恢复**，请谨慎使用。

如果误操作，需要重新添加股票。

---

### 2. 只清空当前池

- 添加到「多头池」时勾选清空 → 只清空多头池
- 添加到「空头池」时勾选清空 → 只清空空头池
- 两个池是独立的

---

### 3. 分析结果

清空股票池后：
- 股票被删除
- 对应的分析结果也会失效
- 需要重新触发分析

---

## 🎯 API 使用示例

### cURL

```bash
# 清空多头池
curl -X DELETE http://localhost:8000/api/stock-picker/pools/clear/LONG

# 清空空头池
curl -X DELETE http://localhost:8000/api/stock-picker/pools/clear/SHORT
```

---

### Python

```python
import requests

# 清空多头池
response = requests.delete('http://localhost:8000/api/stock-picker/pools/clear/LONG')
result = response.json()
print(f"清空了 {result['count']} 只股票")

# 然后批量添加新股票
new_stocks = ['AAPL.US', 'MSFT.US', 'GOOGL.US']
response = requests.post(
    'http://localhost:8000/api/stock-picker/pools/batch',
    json={'pool_type': 'LONG', 'symbols': new_stocks}
)
print(f"添加了 {response.json()['success_count']} 只股票")
```

---

### TypeScript

```typescript
import { clearPool, batchAddStocks } from './api/stockPicker';

// 清空并重新添加
async function replaceStocks() {
  // 1. 清空
  const clearResult = await clearPool('LONG');
  console.log(`清空了 ${clearResult.count} 只股票`);
  
  // 2. 添加新股票
  const addResult = await batchAddStocks({
    pool_type: 'LONG',
    symbols: ['AAPL.US', 'MSFT.US', 'GOOGL.US']
  });
  console.log(`添加了 ${addResult.success_count} 只股票`);
}
```

---

## 🔍 日志示例

### 后端日志

```
INFO:app.stock_picker:清空股票池: LONG - 15只股票
INFO:app.stock_picker:批量添加股票: LONG池, 20个代码
INFO:app.stock_picker:成功添加: AAPL.US
INFO:app.stock_picker:成功添加: MSFT.US
...
INFO:app.stock_picker:批量添加完成: 成功 20, 失败 0
```

---

## 📝 总结

### 实现内容
- ✅ 后端 API：`DELETE /api/stock-picker/pools/clear/{pool_type}`
- ✅ 服务层方法：`clear_pool(pool_type)`
- ✅ 前端 API 客户端：`clearPool(poolType)`
- ✅ UI 复选框：批量添加模式下可选
- ✅ 逻辑集成：勾选后先清空再添加

### 优势
- 🚀 一键替换股票池
- 🎯 适合策略更新场景
- 💡 操作简单直观
- ⚠️ 有明确的警告提示

### 安全性
- ✅ 只清空指定类型的池（多头/空头）
- ✅ 需要用户主动勾选
- ✅ 有警告文字提示
- ✅ 操作日志记录

---

**功能已完成！刷新浏览器试试吧！** 🎉

系统正在重启中...（约10-20秒）










