# 智能仓位管理 - 真实交易功能说明

## 功能概述

智能仓位管理现已完全集成 Longbridge 真实交易 API，支持模拟模式和真实交易模式，并提供完整的交易日志记录和 K 线图查看功能。

## 主要改进

### 1. 真实交易集成

#### 后端改进（`backend/app/auto_position_manager.py`）

- **集成 Longbridge Trading API**
  - `_execute_buy` 方法现在支持真实买入订单
  - `_execute_sell` 方法现在支持真实卖出订单
  - 使用 `trading_api` 模块的 `place_order` 方法提交订单

- **交易模式控制**
  ```python
  if not self.config.get('enable_real_trading', False):
      # 模拟模式
      self._record_trade('BUY', symbol, qty, price, reason, 'SIMULATION', None)
  else:
      # 真实交易模式
      result = trading_api.place_order(order_request)
      if result.success:
          self._record_trade('BUY', symbol, qty, price, reason, 'FILLED', result.order_id)
  ```

- **错误处理**
  - 捕获真实交易失败情况
  - 记录详细的错误信息
  - 状态包括：`SIMULATION`, `FILLED`, `FAILED`, `ERROR`

### 2. 增强的交易日志

#### 新增字段

交易记录表 `auto_position_trades` 增加了以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | TEXT | 交易状态：SIMULATION（模拟）/ FILLED（已成交）/ FAILED（失败）/ ERROR（错误） |
| `order_id` | TEXT | Longbridge 订单 ID（真实交易时） |
| `error_message` | TEXT | 错误信息（交易失败时） |

#### 后端接口更新

- **`GET /position-manager/auto/trades`**
  - 返回完整的交易记录，包括新增字段
  - 支持 `limit` 参数控制返回数量
  - 按时间倒序排列

### 3. K 线图查看功能

#### 新增接口

**`GET /position-manager/klines/{symbol}`**

查询参数：
- `period`: K线周期，默认 `day`
- `count`: 返回数量，默认 100

返回数据：
```json
{
  "symbol": "AAPL.US",
  "period": "day",
  "count": 100,
  "klines": [
    {
      "ts": "2025-01-15",
      "open": 150.0,
      "high": 152.0,
      "low": 149.0,
      "close": 151.5,
      "volume": 1000000
    }
  ]
}
```

### 4. 前端改进

#### 智能仓位页面（`frontend/src/pages/SmartPosition.tsx`）

**交易记录表增强**
- 显示交易状态（带颜色标识）
  - 绿色：FILLED（已成交）
  - 红色：FAILED / ERROR（失败）
  - 灰色：SIMULATION（模拟）
- 显示订单 ID
- 每条记录提供"K线"按钮

**K 线图对话框**
- 点击交易记录中的"K线"按钮可查看该股票的 K 线数据
- 以表格形式展示最近 100 根 K 线
- 包含：日期、开盘、最高、最低、收盘、成交量

**状态提示优化**
- 无交易记录时显示"暂无交易记录"
- 无 K 线数据时提示先同步历史数据

## 使用流程

### 1. 配置真实交易

1. 进入"智能仓位"页面
2. 点击"配置"按钮
3. 在配置对话框中：
   - 设置"启用自动仓位管理"为"是"
   - 配置风险参数（止损、止盈、补仓等）
   - 在"高级设置"中，将"启用真实交易"设置为"是"
4. 保存配置

### 2. 启动自动管理

1. 确认配置已启用
2. 点击"启动"按钮
3. 系统开始自动监控持仓

### 3. 查看交易日志

- 在"自动仓位管理"卡片中可以看到最近的交易记录
- 记录包括：
  - 时间戳
  - 操作类型（买入/卖出）
  - 股票代码
  - 数量和价格
  - 交易原因
  - **交易状态**（新增）
  - **订单 ID**（新增）

### 4. 查看 K 线图

1. 在交易记录表中找到想查看的股票
2. 点击该记录的"K线"按钮
3. 在弹出的对话框中查看 K 线数据

## 配置说明

### 真实交易相关配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enabled` | false | 总开关，必须启用才能运行 |
| `enable_real_trading` | false | 真实交易开关 |
| `check_interval_minutes` | 30 | 检查间隔（分钟） |
| `auto_stop_loss_percent` | -5.0 | 止损阈值（%） |
| `auto_take_profit_percent` | 15.0 | 止盈阈值（%） |
| `auto_rebalance_percent` | -10.0 | 补仓触发阈值（%） |
| `sell_ratio` | 1.0 | 卖出比例（1.0 = 100%） |
| `use_ai_analysis` | true | 启用 AI 分析 |
| `min_ai_confidence` | 0.7 | AI 最小信心度 |

## 安全提示

⚠️ **重要警告**

1. **测试充分**：在启用真实交易前，请先使用模拟模式充分测试
2. **参数谨慎**：止损/止盈参数需根据自己的风险承受能力设置
3. **小额测试**：建议先用小额资金测试
4. **监控运行**：定期检查交易日志，确保系统按预期运行
5. **API 密钥**：确保 Longbridge API 凭据安全存储

## 技术架构

### 数据流

```
持仓监控 → 价格检查 → 决策引擎 → 交易执行 → 记录日志
                              ↓
                       [AI分析可选]
                              ↓
                    规则引擎/AI决策
                              ↓
                    真实交易/模拟模式
```

### 核心组件

1. **AutoPositionManager**: 自动仓位管理主控制器
2. **PositionCalculator**: 仓位计算器
3. **DeepSeekAnalyzer**: AI 分析器（可选）
4. **LongbridgeTradingAPI**: 长桥交易 API 封装

## 故障排除

### 问题：真实交易不执行

**检查项**：
1. `enable_real_trading` 是否设置为 `true`
2. Longbridge API 凭据是否配置正确
3. 检查后端日志查看错误信息

### 问题：K 线数据为空

**解决方案**：
1. 进入"历史数据"页面
2. 同步该股票的历史数据
3. 再次查看 K 线图

### 问题：订单提交失败

**可能原因**：
1. 账户资金不足
2. 股票停牌
3. 不在交易时间
4. 价格超出涨跌停限制

**查看详情**：
- 在交易记录中查看 `error_message` 字段
- 检查后端日志文件

## 后续优化建议

1. **图表可视化**
   - 使用专业 K 线图表库（如 echarts）绘制蜡烛图
   - 添加技术指标叠加显示

2. **实时推送**
   - WebSocket 实时推送交易记录更新
   - 实时显示持仓变化

3. **报表功能**
   - 交易统计分析
   - 收益曲线图
   - 胜率分析

4. **风控增强**
   - 每日最大交易次数限制
   - 总资产风险敞口控制
   - 异常情况自动停止

## 参考文档

- [AI 交易指南](./AI_TRADING_GUIDE.md)
- [智能仓位指南](./SMART_POSITION_GUIDE.md)
- [错误处理规范](./ERROR_HANDLING.md)
- [Longbridge API 文档](https://open.longportapp.com/docs)

---

最后更新：2025-10-22



