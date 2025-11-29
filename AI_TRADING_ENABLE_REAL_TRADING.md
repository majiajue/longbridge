# AI 交易 - 启用真实交易模式

## 问题说明

AI 交易引擎默认运行在 **模拟模式** 下，只记录交易决策但不会真实下单。如果需要执行真实交易，必须手动启用"真实交易模式"。

## 配置位置

真实交易开关在代码中的位置：

### 1. 后端引擎检查 (ai_trading_engine.py)

```python
# 第 463 行 (买入)
enable_real_trading = self.config.get('enable_real_trading', False)

if enable_real_trading:
    # 执行真实交易
    trading_api = get_trading_api()
    order_response = await trading_api.place_order(order_request)
else:
    # 模拟交易
    logger.info(f"💰 模拟买入: {symbol} x {quantity} @ ${price:.2f}")
```

### 2. 数据库配置表 (ai_trading_config)

```sql
CREATE TABLE IF NOT EXISTS ai_trading_config (
    ...
    enable_real_trading BOOLEAN DEFAULT false,
    ...
)
```

### 3. 前端配置界面 (AiTrading.tsx)

```tsx
<FormControlLabel
  control={
    <Switch
      checked={config?.enable_real_trading || false}
      onChange={(e) => setConfig({ ...config, enable_real_trading: e.target.checked })}
    />
  }
  label="启用真实交易（⚠️ 谨慎操作）"
/>
```

## 启用步骤

### 方法 1：通过前端界面（推荐）

1. 访问 AI 交易页面：http://localhost:5173/ai-trading
2. 点击右上角的 **"设置"** 按钮（⚙️ 图标）
3. 在配置对话框中找到 **"启用真实交易（⚠️ 谨慎操作）"** 开关
4. **开启开关**
5. 点击 **"保存配置"**
6. 系统会自动重启引擎以应用新配置

### 方法 2：通过 API 调用

```bash
# 获取当前配置
curl http://localhost:8000/ai-trading/config

# 更新配置启用真实交易
curl -X PUT http://localhost:8000/ai-trading/config \
  -H "Content-Type: application/json" \
  -d '{
    "enable_real_trading": true
  }'
```

### 方法 3：直接修改数据库

```bash
# 停止后端服务
# 然后执行 SQL
sqlite3 backend/data/quant.db "UPDATE ai_trading_config SET enable_real_trading = 1;"

# 重启后端服务
```

## 验证配置

### 1. 查看配置状态

运行诊断脚本：

```bash
cd /Volumes/SamSung/longbridge
python diagnose_ai_trading.py
```

查看输出中的：
```
真实交易模式: ✅ 已启用  # 或 ❌ 模拟模式
```

### 2. 查看日志输出

启用真实交易后，日志会显示：
```
💰 真实买入: AAPL x 100 @ 市价
📤 提交买入订单: AAPL...
✅ 订单已提交: order_12345
⏳ 等待成交: AAPL...
🎉 买入成功: AAPL x 100 @ $150.25
```

模拟模式下，日志会显示：
```
💰 模拟买入: AAPL x 100 @ $150.00
✅ 模拟持仓已创建: AAPL x 100
```

## 安全检查清单

在启用真实交易之前，请确认：

- [ ] **Longbridge 凭据已正确配置**
  - 前往「基础配置」页面
  - 确认 APP_KEY、APP_SECRET、ACCESS_TOKEN 已填写
  - 点击「验证凭据」确保连接正常

- [ ] **DeepSeek API Key 已配置**
  - AI 分析需要 DeepSeek API
  - 在「基础配置」页面设置 AI 配置

- [ ] **监控股票池已设置**
  - 在 AI 交易配置中设置要监控的股票代码
  - 例如：`AAPL, TSLA, MSFT`

- [ ] **风险参数已合理设置**
  - 最小信心度阈值（建议 ≥ 0.70）
  - 每日最大交易次数（建议 ≤ 20）
  - 每日最大亏损（建议设置保护值）
  - 单次交易金额（根据资金量设置）

- [ ] **已在模拟模式下充分测试**
  - 观察 AI 决策的准确性
  - 验证交易逻辑是否符合预期
  - 确认没有异常错误

- [ ] **账户资金充足**
  - 确保 Longbridge 账户有足够的可用资金
  - 预留一定的安全边际

- [ ] **理解交易风险**
  - 实盘交易有资金损失风险
  - AI 决策不保证盈利
  - 建议先用小资金测试

## 真实交易 vs 模拟模式对比

| 特性 | 模拟模式 | 真实交易模式 |
|------|---------|-------------|
| 下单 | 不下单，仅记录 | 通过 Longbridge API 真实下单 |
| 持仓 | 虚拟持仓 | 真实持仓 |
| 盈亏 | 模拟盈亏 | 真实盈亏 |
| 风险 | 无资金风险 | 有资金风险 |
| 数据库记录 | `status='SIMULATED'` | `status='FILLED'` |
| Order ID | `SIMULATED_20251027...` | 真实 Longbridge Order ID |

## 故障排查

### 问题 1：开关已打开但还是模拟交易

**解决方法：**
1. 检查配置是否保存成功
2. 确认引擎已重启（配置更新后会自动重启）
3. 查看后端日志确认配置加载

```bash
tail -f logs/backend.log | grep "enable_real_trading"
```

### 问题 2：真实交易但订单失败

**可能原因：**
- Longbridge 凭据错误或过期
- 账户资金不足
- 股票代码错误或不支持
- 市场休市或非交易时间
- 超过交易限制（单笔最小/最大金额）

**查看详细错误：**
- 前往「AI 交易」页面的「交易记录」标签
- 查看失败订单的 `error_message` 字段
- 检查后端日志：`logs/backend.log`

### 问题 3：订单提交成功但未成交

**说明：**
- 市价单通常会很快成交
- 如果使用限价单，可能需要等待
- 可以在 Longbridge App 中查看订单状态

## 代码实现细节

### 买入流程 (ai_trading_engine.py:429-651)

```python
async def _execute_buy(self, symbol: str, analysis: Dict, analysis_id: int):
    # 1. 检查真实交易开关
    enable_real_trading = self.config.get('enable_real_trading', False)
    
    if enable_real_trading:
        # 2. 真实交易流程
        trading_api = get_trading_api()
        
        # 3. 创建订单请求
        order_request = OrderRequest(
            symbol=symbol,
            side=OrderSide.BUY,
            quantity=quantity,
            order_type=OrderType.MARKET,
            remark=f"AI Trading - Confidence: {confidence:.2%}"
        )
        
        # 4. 提交订单
        order_response = await trading_api.place_order(order_request)
        
        # 5. 查询订单状态
        final_status = await trading_api.get_order_status(order_response.order_id)
        
        # 6. 保存交易记录
        trade_id = save_ai_trade(..., status='FILLED', longbridge_order_id=...)
        
        # 7. 创建持仓记录
        if final_status.status == 'filled':
            create_ai_position(...)
    else:
        # 模拟交易流程
        trade_id = save_ai_trade(..., status='SIMULATED', ...)
```

### 卖出流程 (ai_trading_engine.py:652-872)

类似买入流程，也会检查 `enable_real_trading` 开关。

## 监控与日志

### 实时日志

前端会显示实时交易日志：
- 📊 开始分析
- 📥 获取K线数据
- 🤖 DeepSeek分析中
- ✅ AI决策
- 💰 真实买入 / 模拟买入
- 📤 提交订单
- ✅ 订单已提交
- 🎉 买入成功

### 后端日志

```bash
# 查看所有 AI 交易日志
tail -f logs/backend.log | grep "AI Trading"

# 查看订单日志
tail -f logs/backend.log | grep "Order"
```

## 推荐配置

```json
{
  "enabled": true,
  "symbols": ["AAPL", "TSLA", "MSFT"],  // 从熟悉的股票开始
  "check_interval_minutes": 5,
  "ai_model": "deepseek-chat",
  "ai_temperature": 0.3,
  "min_confidence": 0.75,              // 较高的信心度阈值
  "max_daily_trades": 10,              // 限制交易次数
  "max_loss_per_day": 2000,            // 设置止损
  "fixed_amount_per_trade": 5000,      // 小金额测试
  "enable_real_trading": true          // 启用真实交易
}
```

## 相关文档

- [AI_TRADING_GUIDE.md](docs/AI_TRADING_GUIDE.md) - AI 交易完整指南
- [AUTO_POSITION_REAL_TRADING.md](docs/AUTO_POSITION_REAL_TRADING.md) - 自动仓位管理真实交易
- [TROUBLESHOOTING_STRATEGY_WATCH.md](docs/TROUBLESHOOTING_STRATEGY_WATCH.md) - 故障排查

## 注意事项

⚠️ **重要提醒：**

1. **真实交易有风险，启用前请充分了解和测试**
2. **建议先用小资金测试几天，观察效果**
3. **定期检查交易记录和盈亏情况**
4. **设置合理的风险控制参数**
5. **保持 Longbridge 账户资金充足**
6. **关注市场变化，必要时手动干预**
7. **真实交易模式下，所有交易都会产生真实成本（佣金、印花税等）**
8. **AI 决策基于历史数据，无法保证未来收益**

---

**最后更新：** 2025-10-27
**适用版本：** Longbridge Quant System v1.0









