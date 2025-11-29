# AI 交易快速启动指南 ⚡

## 系统已升级到 V2.0 ✨

提示词已升级为加密货币交易风格，增强了：
- ✅ Chain of Thought（思考过程展示）
- ✅ 时间序列数据格式
- ✅ 更详细的技术指标分析
- ✅ 风险收益比计算

---

## 快速启动步骤（5分钟）

### 1️⃣ 配置 Longbridge 凭据

访问：http://localhost:5173/settings

在「Longbridge 凭据」区域填写：
- APP_KEY
- APP_SECRET  
- ACCESS_TOKEN

点击「验证凭据」确保连接正常。

### 2️⃣ 配置 DeepSeek API

在「AI 配置」区域填写：
- DeepSeek API Key

点击「测试 AI 连接」确认可用。

### 3️⃣ 配置 AI 交易参数

访问：http://localhost:5173/ai-trading

点击右上角 ⚙️ **设置** 按钮：

```json
{
  "enabled": true,
  "symbols": ["AAPL", "TSLA", "MSFT"],  // 你要监控的股票
  "check_interval_minutes": 5,
  "min_confidence": 0.70,
  "max_daily_trades": 10,
  "max_loss_per_day": 2000,
  "fixed_amount_per_trade": 5000,
  "enable_real_trading": false  // ⚠️ 先用模拟模式测试
}
```

### 4️⃣ 清空之前的模拟持仓（如有）

切换到「💼 持仓管理」标签，点击「清空所有持仓」。

### 5️⃣ 启动 AI 交易引擎

点击 **「▶️ 启动引擎」** 按钮。

### 6️⃣ 立即触发一次分析

点击 **「⚡ 立即分析」** 按钮，观察：
- 实时日志（📝 AI 分析过程）
- AI 决策结果
- 是否触发买入

---

## 查看 AI 的思考过程

升级到 V2.0 后，AI 会展示详细的思考逻辑。查看方式：

### 方法 1：前端日志
在「AI 分析记录」标签中，展开任意一条分析记录，查看：
- `chain_of_thought`: AI 的完整思考过程
- `reasoning`: 决策理由
- `technical_signals`: 技术信号状态

### 方法 2：后端日志
```bash
tail -f logs/backend.log | grep "AI 思考过程"
```

---

## V2.0 提示词特色

### 1. 时间序列格式
```
【价格时间序列】（最近10根K线，oldest → latest）
收盘价序列: [$150.00, $151.20, $152.50, ..., $156.60]
```

### 2. Chain of Thought（强制要求）
```json
{
  "chain_of_thought": "1) 市场环境：上升趋势 2) MA5金叉MA20，MACD即将金叉 3) RSI=45中性偏多 4) 成交量放大1.5倍 5) 风险收益比2.5:1 6) 决策：BUY，信心度0.85",
  "action": "BUY",
  ...
}
```

### 3. 技术信号详情
```json
{
  "technical_signals": {
    "ma_trend": "突破MA20",
    "macd_status": "即将金叉",
    "rsi_status": "45 中性偏多",
    "volume_status": "放量1.5倍"
  }
}
```

---

## 模拟 vs 真实交易对比

| 模式 | enable_real_trading | 行为 | 风险 |
|------|---------------------|------|------|
| 模拟 | false | 记录交易但不下单 | 无风险 |
| 真实 | true | 通过 Longbridge API 真实下单 | ⚠️ 有风险 |

### 启用真实交易前检查清单

- [ ] 在模拟模式下测试至少1天
- [ ] AI 决策准确率 > 60%
- [ ] 理解每笔交易的逻辑
- [ ] 账户有足够资金
- [ ] 设置了合理的止损止盈
- [ ] 单笔交易金额适中（建议 ≤ $5000）

### 启用真实交易

```bash
# 方法 1：前端界面
AI 交易页面 → 设置 → 启用真实交易（⚠️ 谨慎操作）→ 保存

# 方法 2：API 调用
curl -X PUT http://localhost:8000/ai-trading/config \
  -H "Content-Type: application/json" \
  -d '{"enable_real_trading": true}'
```

---

## 监控 AI 交易

### 1. 实时日志
```bash
# 查看 AI 分析过程
tail -f logs/backend.log | grep "AI 思考"

# 查看交易决策
tail -f logs/backend.log | grep "AI 决策"

# 查看订单状态
tail -f logs/backend.log | grep "订单"
```

### 2. 前端界面

- **AI 分析记录**：每次分析的详细数据
- **交易记录**：买入/卖出历史
- **持仓管理**：当前持仓和盈亏
- **实时K线图**：价格走势可视化

### 3. 性能指标

在引擎状态卡片中查看：
- 今日交易次数
- 今日盈亏
- 当前持仓数
- 总收益率

---

## 常见问题

### Q1：AI 一直返回 HOLD，不买入？

**可能原因：**
1. 信心度阈值太高（建议设置为 0.70）
2. 股票没有明显的买入信号
3. K线数据不足（需要至少20根）

**解决方法：**
```bash
# 1. 降低信心度阈值
配置中将 min_confidence 从 0.75 降到 0.70

# 2. 检查K线数据
访问 /quotes/history?symbol=AAPL&period=1Day&count=100

# 3. 查看 AI 思考过程
展开分析记录，查看 chain_of_thought 字段
```

### Q2：提示"已有持仓，不能重复买入"？

**原因：** 系统检测到该股票已有持仓（可能是之前的模拟持仓）。

**解决方法：**
```bash
前往「持仓管理」标签 → 找到对应股票 → 点击「删除」
# 或
点击「清空所有持仓」清理所有模拟数据
```

### Q3：真实交易订单失败？

**检查：**
1. Longbridge 凭据是否正确
2. 账户资金是否充足
3. 股票代码是否正确
4. 是否在交易时间内
5. 查看错误信息：`logs/backend.log`

### Q4：Chain of Thought 没有内容？

**可能原因：**
1. AI 模型版本不支持
2. API 返回格式不正确

**解决方法：**
```bash
# 检查后端日志
tail -f logs/backend.log | grep "AI 思考过程"

# 如果为空，检查 AI 原始响应
# 查看 ai_raw_response 字段
```

---

## 性能优化建议

### 1. 监控股票数量
- 建议：3-5只股票
- 过多会导致分析过慢

### 2. 检查间隔
- 日内交易：5-15分钟
- 长线持有：30-60分钟

### 3. API 调用限制
- DeepSeek API 有速率限制
- 如果失败，增加检查间隔

---

## 下一步

1. **观察AI决策**：在模拟模式下运行1-2天
2. **分析准确率**：统计AI的胜率和盈亏比
3. **调整参数**：根据表现调整信心度阈值
4. **启用真实交易**：确认无误后开启真实模式
5. **持续监控**：每天检查交易记录和持仓状态

---

## 技术支持

遇到问题？

1. 查看文档：
   - `AI_TRADING_GUIDE.md` - 完整指南
   - `AI_TRADING_ENABLE_REAL_TRADING.md` - 真实交易配置
   - `AI_TRADING_POSITION_CONFLICT.md` - 持仓冲突解决

2. 检查日志：
   ```bash
   tail -f logs/backend.log
   ```

3. 诊断脚本：
   ```bash
   python diagnose_ai_trading.py
   ```

---

**最后更新：** 2025-10-27
**版本：** V2.0
**提示词风格：** 加密货币交易（Chain of Thought）









