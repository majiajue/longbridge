# 高级交易策略使用指南

## 概述

本系统实现了两种高级量化交易策略：
1. **买低卖高策略**（Buy Low Sell High）- 基于波段检测
2. **EMA 交叉策略**（Exponential Moving Average Crossover）- 基于均线交叉

## 策略说明

### 1. 买低卖高策略 🎯

#### 原理
通过检测价格的局部最高点和最低点（波峰波谷），在**局部最低点买入**，在**局部最高点卖出**。

#### 核心指标
- **波峰检测**：价格高于前后 N 根 K 线
- **波谷检测**：价格低于前后 N 根 K 线
- **最小波幅**：默认 2%，防止在震荡市中频繁交易
- **成交量确认**：检查成交量是否配合

#### 参数说明
```python
lookback_window: int = 5      # 回看窗口（检测波峰波谷）
min_wave_amplitude: float = 0.02  # 最小波幅 2%
volume_threshold: float = 1.2     # 成交量阈值
trend_confirmation: bool = True    # 是否需要趋势确认
```

#### 适用场景
- ✅ 波段明显的股票
- ✅ 有一定波动率的市场
- ✅ 中短期交易
- ❌ 单边趋势市场
- ❌ 极度震荡的股票

#### 信号示例
```
✅ 买入信号：
检测到局部最低点 45.20，当前反弹至 46.10
置信度: 72%

✅ 卖出信号：
检测到局部最高点 52.80，当前回落至 51.90
置信度: 68%
```

### 2. EMA 交叉策略 📈

#### 原理
使用两条不同周期的指数移动平均线（EMA）：
- **快线**（短期 EMA）：默认 12 天
- **慢线**（长期 EMA）：默认 26 天

当快线上穿慢线时**买入**（金叉），下穿时**卖出**（死叉）。

#### 核心指标
- **EMA 快线**：反应更快，捕捉短期趋势
- **EMA 慢线**：反应较慢，代表长期趋势
- **MACD**：作为辅助确认指标
- **成交量**：确认趋势的有效性

#### 参数说明
```python
fast_period: int = 12         # 快线周期
slow_period: int = 26         # 慢线周期
signal_period: int = 9        # 信号线周期（MACD）
volume_confirmation: bool = True  # 成交量确认
min_crossover_gap: float = 0.001  # 最小交叉间距
```

#### 适用场景
- ✅ 明显趋势行情
- ✅ 中长期投资
- ✅ 趋势跟踪
- ❌ 震荡市
- ❌ 极短期交易

#### 信号示例
```
✅ 金叉（买入）：
EMA12 金叉 EMA26
当前趋势: 上升
置信度: 75%

✅ 死叉（卖出）：
EMA12 死叉 EMA26
当前趋势: 下降
置信度: 70%
```

## API 接口

### 1. 分析买低卖高策略

**端点**: `GET /strategies/advanced/buy-low-sell-high/analyze`

**参数**:
- `symbol`: 股票代码（必填）
- `lookback_window`: 波峰波谷检测窗口（默认5）
- `min_wave_amplitude`: 最小波幅（默认0.02）
- `limit`: K线数量（默认200）

**示例**:
```bash
curl "http://localhost:8000/strategies/advanced/buy-low-sell-high/analyze?symbol=AAPL.US&lookback_window=5&limit=200"
```

**响应**:
```json
{
  "symbol": "AAPL.US",
  "strategy": "买低卖高策略",
  "parameters": {
    "lookback_window": 5,
    "min_wave_amplitude": 0.02
  },
  "summary": {
    "total_buy_signals": 8,
    "total_sell_signals": 7,
    "completed_trades": 7,
    "average_return": 0.042,
    "buy_points": [...],
    "sell_points": [...]
  },
  "current_signal": {
    "action": "BUY",
    "price": 175.50,
    "reason": "检测到局部最低点...",
    "confidence": 0.72
  }
}
```

### 2. 分析 EMA 交叉策略

**端点**: `GET /strategies/advanced/ema-crossover/analyze`

**参数**:
- `symbol`: 股票代码（必填）
- `fast_period`: 快线周期（默认12）
- `slow_period`: 慢线周期（默认26）
- `signal_period`: 信号线周期（默认9）
- `limit`: K线数量（默认200）

**示例**:
```bash
curl "http://localhost:8000/strategies/advanced/ema-crossover/analyze?symbol=AAPL.US&fast_period=12&slow_period=26"
```

**响应**:
```json
{
  "symbol": "AAPL.US",
  "strategy": "EMA 交叉策略",
  "parameters": {
    "fast_period": 12,
    "slow_period": 26
  },
  "trend": {
    "trend": "uptrend",
    "strength": 0.65,
    "fast_ema": 176.20,
    "slow_ema": 174.80
  },
  "current_signal": {
    "action": "BUY",
    "price": 176.50,
    "reason": "EMA12 金叉 EMA26",
    "confidence": 0.75
  },
  "chart_data": {...}
}
```

### 3. 多策略综合分析

**端点**: `GET /strategies/advanced/multi-strategy/analyze`

**参数**:
- `symbol`: 股票代码（必填）
- `limit`: K线数量（默认200）

**示例**:
```bash
curl "http://localhost:8000/strategies/advanced/multi-strategy/analyze?symbol=AAPL.US"
```

**响应**:
```json
{
  "symbol": "AAPL.US",
  "strategies": [
    {
      "name": "买低卖高策略",
      "signal": {...}
    },
    {
      "name": "EMA 交叉策略",
      "signal": {...}
    }
  ],
  "consensus": {
    "action": "BUY",
    "confidence": 0.68,
    "agreement": 1.0,
    "buy_count": 2,
    "sell_count": 0
  },
  "recommendation": "强烈建议买入 (100% 策略一致)，置信度 68%"
}
```

### 4. 获取监控列表信号

**端点**: `GET /strategies/advanced/watchlist/signals`

自动分析所有配置的监控股票，返回有信号的股票列表。

**示例**:
```bash
curl "http://localhost:8000/strategies/advanced/watchlist/signals"
```

**响应**:
```json
{
  "total": 3,
  "signals": [
    {
      "symbol": "AAPL.US",
      "current_price": 176.50,
      "signals": {
        "buy_low_sell_high": {...},
        "ema_crossover": {...}
      },
      "consensus": {
        "action": "BUY",
        "confidence": 0.70
      }
    },
    ...
  ],
  "generated_at": "2025-01-20T..."
}
```

## 前端使用

### 策略盯盘页面 🎯

访问前端 → 点击「策略盯盘」Tab

#### 功能特点

1. **信号概览表格**
   - 显示所有监控股票的实时信号
   - 买低卖高和 EMA 策略并列显示
   - 综合建议和置信度
   - 策略一致性指标

2. **实时 K 线图**
   - 每只股票独立的实时 K 线图
   - WebSocket 实时数据推送
   - 价格变动闪烁效果
   - 成交量柱状图

3. **信号详情**
   - 展开查看详细的信号原因
   - 置信度和风险提示
   - 止损止盈建议

### 使用流程

1. **配置监控股票**
   ```
   基础配置 → 添加股票代码 → 保存
   ```

2. **查看策略信号**
   ```
   策略盯盘 → 信号概览
   ```

3. **查看实时 K 线**
   ```
   策略盯盘 → 实时 K 线 Tab
   或
   点击「查看 K 线」按钮
   ```

4. **操作建议**
   - 🟢 **强烈买入**：置信度 > 70%，多策略一致
   - 🟡 **谨慎买入**：置信度 50-70%
   - 🔴 **建议卖出**：多策略发出卖出信号
   - ⚪ **观望**：无明确信号或策略冲突

## 策略组合建议

### 保守型
```
策略组合：EMA 交叉（慢参数）
参数：EMA(20, 50)
风险：低
适合：稳健投资者，长期持有
```

### 平衡型
```
策略组合：EMA 交叉 + 买低卖高
参数：EMA(12, 26) + 波段检测(5, 2%)
风险：中
适合：均衡型投资者，波段操作
```

### 激进型
```
策略组合：买低卖高（宽参数）
参数：波段检测(3, 1.5%)
风险：高
适合：激进投资者，短线交易
```

## 风险提示 ⚠️

1. **策略局限性**
   - 所有策略基于历史数据
   - 不保证未来表现
   - 需要结合基本面分析

2. **市场条件**
   - 震荡市可能产生假信号
   - 单边趋势市买低卖高效果较差
   - 需要根据市场环境选择策略

3. **止损止盈**
   - 严格执行止损
   - 及时锁定利润
   - 不要过度贪婪

4. **资金管理**
   - 分散投资
   - 控制单笔仓位
   - 留有充足现金储备

## 高级技巧

### 1. 参数优化

通过回测找到最优参数：
```python
# 测试不同的波段窗口
for window in [3, 5, 7, 10]:
    analyze_buy_low_sell_high(symbol, lookback_window=window)
    
# 测试不同的 EMA 周期
for fast, slow in [(5,10), (12,26), (20,50)]:
    analyze_ema_crossover(symbol, fast_period=fast, slow_period=slow)
```

### 2. 多时间周期分析

结合不同时间周期的信号：
```
日线：判断大趋势（EMA 策略）
小时线：寻找入场点（买低卖高）
```

### 3. 结合其他指标

- **RSI**：判断超买超卖
- **布林带**：判断价格异常
- **MACD**：趋势确认

## 常见问题

**Q: 为什么信号有时会延迟？**
A: 策略使用倒数第2根 K 线检测，避免使用未完成的 K 线导致虚假信号。

**Q: 置信度如何计算？**
A: 综合考虑波幅大小、成交量确认、趋势一致性等多个因素。

**Q: 多个策略信号冲突怎么办？**
A: 查看「综合建议」，系统会计算策略共识。建议以置信度高、一致性强的信号为准。

**Q: 可以自动交易吗？**
A: 可以集成到持仓监控的自动模式，但建议初期使用提醒模式，熟悉后再开启自动交易。

## 更新日志

- 2025-01-20：初始版本
  - 实现买低卖高策略
  - 实现 EMA 交叉策略
  - 多策略综合分析
  - 实时 K 线图组件
  - 策略盯盘页面

## 技术栈

- **后端**: Python 策略类，FastAPI 路由
- **前端**: React + TypeScript，Canvas K 线图
- **实时通信**: WebSocket
- **数据源**: DuckDB 缓存 + Longbridge API

## 文件结构

```
backend/app/
  ├── strategies/
  │   ├── __init__.py
  │   ├── buy_low_sell_high.py      # 买低卖高策略
  │   └── ema_crossover.py           # EMA 交叉策略
  └── routers/
      └── strategies_advanced.py     # 策略API路由

frontend/src/
  ├── components/
  │   └── RealTimeKLineChart.tsx    # 实时K线图组件
  └── pages/
      └── StrategyWatch.tsx          # 策略盯盘页面
```

## 下一步计划

- [ ] RSI 策略
- [ ] 布林带策略
- [ ] 回测系统优化
- [ ] 策略参数自动优化
- [ ] 机器学习增强

