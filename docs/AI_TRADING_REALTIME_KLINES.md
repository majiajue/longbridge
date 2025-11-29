# AI 自动交易 - 实时 K 线与长桥交易集成

## 更新总结

已完成以下三大功能模块的开发：

### 1. ✅ 长桥真实交易 API 集成

**后端改进** (`backend/app/ai_trading_engine.py`)

- 集成 `trading_api.py` 中的长桥交易接口
- 支持市价买入/卖出订单
- 实时订单状态查询
- 自动区分模拟/真实交易模式

**核心功能**：

```python
# 买入流程
1. 创建订单请求（OrderRequest）
2. 调用 trading_api.place_order() 下单
3. 等待订单成交（2秒）
4. 查询最终订单状态
5. 记录交易到数据库
6. 创建/更新持仓记录

# 卖出流程
1. 获取持仓数量
2. 创建卖出订单
3. 下单并等待成交
4. 计算实际盈亏
5. 更新交易记录
6. 删除持仓记录
```

**模式切换**：

- **模拟模式**（默认）：
  - 不执行真实下单
  - 记录状态为 'SIMULATED'
  - 适合测试和学习
  
- **真实交易模式**：
  - 通过 Longbridge API 执行真实下单
  - 记录实际订单ID
  - 追踪真实成交价格和数量
  - 需要在配置中设置 `enable_real_trading: true`

### 2. ✅ 实时 K 线数据获取

**新增 API 接口** (`backend/app/routers/ai_trading.py`)

```http
GET /ai-trading/klines/{symbol}?period=day&count=100
```

**功能特性**：
- 获取指定股票的历史 K 线数据
- 支持多种周期（day, min1, min5 等）
- 可自定义获取数量（1-1000）
- 返回完整的 OHLCV 数据
- 与 AI 分析使用相同的数据源

**响应格式**：
```json
{
  "symbol": "AAPL.US",
  "period": "day",
  "count": 100,
  "klines": [
    {
      "ts": "2024-01-01T00:00:00",
      "open": 180.5,
      "high": 182.3,
      "low": 179.8,
      "close": 181.9,
      "volume": 50000000,
      "turnover": 9050000000
    },
    ...
  ]
}
```

### 3. ✅ K 线图表可视化展示

**前端功能** (`frontend/src/pages/AiTrading.tsx`)

**新增功能**：
1. **K 线图标按钮**：每个 AI 分析记录旁边显示 📈 图标
2. **K 线数据对话框**：点击图标弹出完整K线数据表格
3. **实时数据刷新**：可随时刷新最新K线数据
4. **涨跌幅显示**：自动计算并高亮显示涨跌

**使用方式**：
1. 在「AI 分析记录」Tab 页
2. 找到任意分析记录
3. 点击股票代码旁边的 📊 图标
4. 查看完整 K 线数据表格（最近 100 根）

**数据展示**：
- 时间
- 开盘价
- 最高价
- 最低价
- 收盘价
- 成交量
- 涨跌幅（红涨绿跌）

### 4. ✅ 真实交易模式配置

**配置界面更新**：

在配置对话框中新增：
```
启用真实交易（⚠️ 谨慎操作）
☐ 关闭时为模拟模式，开启后会通过 Longbridge API 执行真实下单
```

**安全警告**：
- 开启时显示红色警告
- 提醒用户风险
- 建议充分测试后再启用

## 使用指南

### 步骤 1: 同步历史 K 线数据

在开始使用 AI 交易之前，需要先同步 K 线数据：

1. 前往「⚙️ 基础配置」页面
2. 找到「历史 K 线同步与预览」区域
3. 选择周期（建议使用「日K」）
4. 设置数量（建议 100-500 根）
5. 点击「🔄 同步历史数据」

### 步骤 2: 配置 AI 交易参数

1. 前往「🤖 AI 交易」页面
2. 点击右上角 ⚙️ 设置按钮
3. 配置以下参数：
   - **DeepSeek API Key**：在「基础配置」页面设置
   - **监控股票池**：输入要监控的股票代码
   - **检查间隔**：建议 5-15 分钟
   - **最小信心度**：建议 0.75+
   - **每日最大交易次数**：建议 20 次以内
   - **每笔固定交易金额**：根据资金情况设置
   - **启用真实交易**：⚠️ 测试完成后再开启

### 步骤 3: 启动 AI 交易

1. 确认配置正确
2. 点击绿色「启动」按钮
3. 系统开始自动分析和交易

### 步骤 4: 监控运行状态

**查看 AI 分析**：
- 切换到「🔍 AI 分析记录」Tab
- 查看每次分析的决策和理由
- 点击 📊 图标查看 K 线数据
- 展开查看详细的分析理由

**查看交易记录**：
- 切换到「📝 交易记录」Tab
- 查看所有执行的交易
- 查看盈亏情况
- 查看订单状态

**查看持仓**：
- 切换到「💼 持仓管理」Tab
- 查看当前 AI 持仓
- 查看未实现盈亏

## AI 决策流程

### 数据获取
```
1. 获取最近 100 根日线 K 线
2. 计算技术指标（MA, RSI, MACD, 布林带等）
3. 分析 K 线形态和趋势
```

### AI 分析
```
4. 将 K 线数据和指标发送给 DeepSeek
5. AI 综合分析市场状态
6. 给出交易建议（BUY/SELL/HOLD）
7. 提供信心度评分（0-1）
8. 说明决策理由
```

### 交易执行
```
9. 检查信心度是否达标
10. 检查当前持仓状态
11. 计算买卖数量
12. 执行交易（模拟/真实）
13. 记录交易结果
14. 更新持仓信息
```

## 真实交易注意事项

### ⚠️ 风险提示

1. **充分测试**
   - 在模拟模式下运行至少 1-2 周
   - 观察 AI 决策质量
   - 调整参数直到满意

2. **小额开始**
   - 初次启用真实交易时使用小金额
   - 逐步增加交易金额
   - 确认系统稳定后再扩大规模

3. **持续监控**
   - 定期检查交易记录
   - 关注盈亏情况
   - 及时调整策略参数

4. **风险控制**
   - 设置合理的止损止盈
   - 控制每日最大交易次数
   - 限制每日最大亏损金额
   - 不要过度依赖 AI

### ✅ 最佳实践

1. **参数配置**
   - 信心度阈值：>= 0.75
   - 检查间隔：5-15 分钟
   - 每日最大交易：10-20 次
   - 每日最大亏损：< 总资产 5%

2. **数据质量**
   - 定期同步最新 K 线数据
   - 确保数据完整性
   - 使用合适的周期（推荐日线）

3. **监控策略**
   - 每天查看交易日志
   - 分析决策理由
   - 优化参数设置
   - 记录经验教训

## API 接口文档

### 获取 K 线数据
```http
GET /ai-trading/klines/{symbol}

参数：
  - symbol: 股票代码（路径参数）
  - period: 周期（查询参数，默认 day）
  - count: 数量（查询参数，默认 100）

响应：
  {
    "symbol": "AAPL.US",
    "period": "day",
    "count": 100,
    "klines": [...]
  }
```

### 启动/停止引擎
```http
POST /ai-trading/engine/start
POST /ai-trading/engine/stop

响应：
  {
    "status": "started/stopped",
    "message": "...",
    "config": {...}
  }
```

### 获取引擎状态
```http
GET /ai-trading/engine/status

响应：
  {
    "running": true,
    "enabled_in_config": true,
    "symbols_monitoring": 5,
    "today_trades": 3,
    "today_pnl": 150.50,
    "current_positions": 2,
    "config": {...}
  }
```

### 更新配置
```http
PUT /ai-trading/config

请求体：
  {
    "enabled": true,
    "symbols": ["AAPL.US", "TSLA.US"],
    "check_interval_minutes": 5,
    "min_confidence": 0.75,
    "enable_real_trading": false,
    ...
  }
```

## 技术实现细节

### 订单执行流程

```python
# 真实买入
async def _execute_buy():
    1. 获取 trading_api 实例
    2. 创建 OrderRequest(
         symbol=symbol,
         side=OrderSide.BUY,
         quantity=quantity,
         order_type=OrderType.MARKET
       )
    3. order_response = await trading_api.place_order(order_request)
    4. 等待 2 秒给订单成交时间
    5. final_status = await trading_api.get_order_status(order_id)
    6. 保存交易记录到数据库
    7. 创建/更新持仓记录
```

### K 线数据流

```
数据库 (ohlc 表)
    ↓
services.get_cached_candlesticks()
    ↓
routers/ai_trading.get_ai_klines()
    ↓
前端 loadKlineData()
    ↓
K 线表格展示
```

### 模拟 vs 真实交易对比

| 功能 | 模拟模式 | 真实模式 |
|------|---------|---------|
| 下单 | 仅记录 | 调用 Longbridge API |
| 订单ID | SIMULATED_xxx | 真实订单号 |
| 成交价 | 估算价格 | 实际成交价 |
| 成交量 | 计算数量 | 实际成交量 |
| 盈亏 | 估算盈亏 | 实际盈亏 |
| 风险 | 无风险 | 真实风险 ⚠️ |
| 适用场景 | 测试学习 | 实盘交易 |

## 常见问题

### Q1: 为什么点击 K 线图标没有数据？
**A**: 需要先在「基础配置」页面同步历史数据。

### Q2: AI 分析后为什么不执行交易？
**A**: 可能原因：
- 信心度不足（< 最小信心度阈值）
- 已有持仓无法重复买入
- 无持仓无法卖出
- 达到每日交易次数限制

### Q3: 真实交易模式如何启用？
**A**: 
1. 在配置对话框中勾选「启用真实交易」
2. 保存配置
3. 重启引擎

### Q4: 如何查看订单是否成交？
**A**: 在「📝 交易记录」Tab 中查看订单状态：
- FILLED: 已成交
- SUBMITTED: 已提交
- FAILED: 失败
- SIMULATED: 模拟

### Q5: K 线数据多久更新一次？
**A**: 
- 数据库中的K线：根据同步频率
- 实时分析使用：每次分析时读取最新数据
- 建议每天同步一次历史数据

## 后续优化方向

- [ ] 可视化 K 线图表（蜡烛图）
- [ ] 支持多周期联合分析
- [ ] 止损止盈自动管理
- [ ] 交易信号推送通知
- [ ] 更多技术指标支持
- [ ] 策略回测功能
- [ ] 性能报告生成

## 参考文档

- [AI Trading Guide](./AI_TRADING_GUIDE.md)
- [Trading API](../backend/app/trading_api.py)
- [AI Trading Engine](../backend/app/ai_trading_engine.py)
- [AI Analyzer](../backend/app/ai_analyzer.py)

---

**最后更新**: 2025-01-22
**版本**: 2.0



