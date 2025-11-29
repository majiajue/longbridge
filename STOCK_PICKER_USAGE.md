# 智能选股系统 - 使用说明

## ✅ 已完成的后端功能

### 1. 数据库表（3张）
- ✅ `stock_picker_pools` - 股票池管理
- ✅ `stock_picker_analysis` - 分析结果存储
- ✅ `stock_picker_config` - 系统配置

### 2. 核心服务类
- ✅ `StockPickerService` - 完整实现
  - 股票池管理（增删改查）
  - 批量分析
  - 推荐度计算
  - 结果排序

### 3. API 接口（9个）
- ✅ `GET /api/stock-picker/pools` - 获取股票池
- ✅ `POST /api/stock-picker/pools` - 添加股票
- ✅ `POST /api/stock-picker/pools/batch` - 批量添加
- ✅ `DELETE /api/stock-picker/pools/{id}` - 删除股票
- ✅ `PATCH /api/stock-picker/pools/{id}/toggle` - 切换激活
- ✅ `POST /api/stock-picker/analyze` - 触发分析
- ✅ `GET /api/stock-picker/analysis` - 获取结果
- ✅ `GET /api/stock-picker/analysis/{symbol}` - 获取详情
- ✅ `GET /api/stock-picker/stats` - 统计信息

### 4. 工具脚本
- ✅ `import_stocks.py` - 导入股票脚本
- ✅ `analyze_stocks.py` - 分析脚本

---

## 🚀 快速开始

### 步骤1：启动后端服务

```bash
cd /Volumes/SamSung/longbridge
./start.sh
```

后端会自动创建数据库表。

### 步骤2：导入股票

您提供的40只股票已经内置在 `import_stocks.py` 中：

**做多池（20只）**：
```
EUSM.US, DRI.US, GLP_B.US, DRVN.US, GMAB.US,
VPV.US, GMAR.US, WIW.US, DRLL.US, GMAY.US,
GME.US, DRIV.US, GMED.US, GMET.US, DRIP.US,
GMEY.US, GMF.US, VPU.US, DRIO.US, GLPI.US
```

**做空池（20只）**：
```
PTL.US, AFL.US, SPR.US, ZLAB.US, PSTG.US,
BABX.US, SPSK.US, BA.US, TLTI.US, PTBD.US,
PTHS.US, TLTP.US, SPPP.US, AZTR.US, PTIN.US,
PTIR.US, PTH.US, AFYA.US, PTIX.US, ZYXI.US
```

运行导入：

```bash
python import_stocks.py
```

输出示例：
```
============================================================
导入股票池
============================================================

📈 做多池: 20 只
   成功: 20, 失败: 0
📉 做空池: 20 只
   成功: 20, 失败: 0

✅ 导入完成！
```

### 步骤3：运行分析

```bash
python analyze_stocks.py
```

输出示例：
```
============================================================
  📊 智能选股分析
============================================================

📋 当前股票池:
   做多池: 20 只
   做空池: 20 只

🔍 开始分析...

✅ 分析完成:
   总计: 40 只
   成功: 40 只
   失败: 0 只

============================================================
  📈 做多推荐 (Top 10)
============================================================

#1  🟢 GME.US       | 评分: 82.5/100 (A级) | 推荐度: 85.3
     $25.50 ↑ 3.2%
     💡 量化评分: 82.5/100 (A级)

#2  🟡 DRI.US       | 评分: 72.1/100 (B级) | 推荐度: 76.8
     ...

============================================================
  📉 做空推荐 (Top 10)
============================================================

#1  🟢 BA.US        | 评分: 38.5/100 (D级) | 推荐度: 83.2
     $180.25 ↓ 2.5%
     💡 技术面偏弱，适合做空
```

---

## 📡 API 使用示例

### 1. 获取股票池

```bash
curl http://localhost:8000/api/stock-picker/pools
```

### 2. 添加单只股票

```bash
curl -X POST http://localhost:8000/api/stock-picker/pools \
  -H "Content-Type: application/json" \
  -d '{
    "pool_type": "LONG",
    "symbol": "TSLA.US",
    "name": "Tesla",
    "added_reason": "电动车龙头"
  }'
```

### 3. 批量添加股票

```bash
curl -X POST http://localhost:8000/api/stock-picker/pools/batch \
  -H "Content-Type: application/json" \
  -d '{
    "pool_type": "LONG",
    "symbols": ["TSLA.US", "NVDA.US", "AMD.US"]
  }'
```

### 4. 触发分析

```bash
curl -X POST http://localhost:8000/api/stock-picker/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "pool_type": "LONG",
    "force_refresh": true
  }'
```

### 5. 获取分析结果（按推荐度排序）

```bash
curl "http://localhost:8000/api/stock-picker/analysis?sort_by=recommendation&limit=10"
```

### 6. 获取统计信息

```bash
curl http://localhost:8000/api/stock-picker/stats
```

---

## 🎯 评分系统说明

### 量化评分（0-100分）

每只股票会获得5个维度的评分：

1. **趋势评分（30分）**
   - MA排列情况
   - 价格相对MA20的位置

2. **动量评分（25分）**
   - RSI指标
   - MACD指标

3. **量能评分（15分）**
   - 成交量比

4. **波动评分（15分）**
   - 布林带位置

5. **K线形态评分（15分）**
   - 锤子线、红三兵等

**评级标准**：
- A级（80-100分）：强烈推荐
- B级（65-79分）：推荐
- C级（50-64分）：中性
- D级（<50分）：不推荐

### 推荐度计算

```python
# 做多池
推荐度 = 量化评分 × 50% + 信心度 × 15% + 信号强度 × 20%

# 做空池（低分 = 高推荐度）
推荐度 = (100 - 量化评分) × 50% + 信心度 × 15% + 信号强度 × 20%
```

---

## 📊 数据库查询

### 查看股票池

```sql
SELECT * FROM stock_picker_pools WHERE is_active = TRUE;
```

### 查看最新分析结果

```sql
SELECT 
    symbol,
    pool_type,
    score_total,
    score_grade,
    recommendation_score,
    recommendation_reason
FROM stock_picker_analysis
WHERE id IN (
    SELECT MAX(id) FROM stock_picker_analysis GROUP BY symbol
)
ORDER BY recommendation_score DESC;
```

### 统计各评级数量

```sql
SELECT 
    pool_type,
    score_grade,
    COUNT(*) as count
FROM stock_picker_analysis
WHERE id IN (
    SELECT MAX(id) FROM stock_picker_analysis GROUP BY symbol
)
GROUP BY pool_type, score_grade;
```

---

## 🔧 高级配置

### 修改缓存时长

编辑 `backend/app/stock_picker.py`：

```python
def __init__(self):
    self.cache = {}
    self.cache_duration = 300  # 改为你想要的秒数
```

### 修改并发数量

编辑 `backend/app/stock_picker.py` 的 `analyze_pool` 方法：

```python
semaphore = asyncio.Semaphore(5)  # 改为你想要的并发数
```

### 修改推荐度权重

编辑 `calculate_recommendation_score` 方法：

```python
if pool_type == 'LONG':
    recommendation = (
        score_total * 0.5 +      # 可调整
        confidence * 50 * 0.3 +  # 可调整
        signal_strength * 0.2    # 可调整
    )
```

---

## 🐛 故障排查

### 问题1：导入失败

```bash
❌ 添加失败: XXXX.US - UNIQUE constraint failed
```

**原因**：股票已存在  
**解决**：这是正常的，系统会跳过已存在的股票

### 问题2：分析失败

```bash
❌ 分析失败: XXXX.US - K线数据不足
```

**原因**：股票K线数据少于20根  
**解决**：该股票可能刚上市或数据未同步，系统会跳过

### 问题3：API返回500错误

**检查日志**：
```bash
tail -f logs/backend.log
```

**常见原因**：
- 数据库连接问题
- K线数据获取失败
- 并发数过高导致超时

---

## 📈 性能优化建议

### 1. 缓存策略
- 默认缓存5分钟
- 相同股票5分钟内不会重复分析
- 使用 `force_refresh=true` 可强制刷新

### 2. 并发控制
- 默认最多5个并发请求
- 避免API限流
- 可根据网络情况调整

### 3. 数据清理
定期清理旧的分析记录：

```sql
DELETE FROM stock_picker_analysis 
WHERE analysis_time < datetime('now', '-7 days');
```

---

## 📝 下一步

### 前端开发
创建前端界面展示分析结果：

1. **StockPicker.tsx** - 主页面
2. **StockPool 组件** - 双栏展示
3. **StockCard 组件** - 股票卡片
4. **AnalysisDetail 对话框** - 详细信息

### 增强功能
1. WebSocket 实时推送
2. 自动刷新机制
3. 历史分析记录
4. 导出分析报告

---

## 🎉 总结

后端功能已全部完成！包括：

✅ 数据库表（3张）  
✅ 核心服务类（400+行代码）  
✅ API接口（9个）  
✅ 工具脚本（2个）  
✅ 完整文档

您现在可以：
1. 导入您的40只股票
2. 运行分析获取推荐
3. 通过API集成到前端
4. 定期刷新获取最新评分

**使用您提供的股票列表**：
```bash
python import_stocks.py    # 导入40只股票
python analyze_stocks.py   # 分析并显示结果
```

---

**创建日期**: 2025-10-24  
**版本**: v1.0  
**状态**: 后端完成，前端待开发











