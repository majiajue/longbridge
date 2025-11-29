# AI 交易 - "已有持仓"问题解决方案

## 问题描述

用户在 AI 交易页面：
1. 多次点击"立即分析"按钮
2. 系统已执行买入操作（可能是模拟买入）
3. 后续再触发分析时，提示"已有持仓，不能重复买入"
4. 配置保存似乎没有生效

## 问题根源

### 1. 重复买入保护机制

**代码位置：** `backend/app/ai_trading_engine.py:385-387`

```python
# 买入但已有持仓
if action == 'BUY' and has_position:
    return False, "已有持仓，不能重复买入"
```

**设计目的：** 防止对同一只股票重复买入，这是一个保护机制。

### 2. 模拟持仓 vs 真实持仓

- AI 交易引擎默认运行在 **模拟模式** 下
- 模拟买入会在 `ai_positions` 表中创建持仓记录
- 这些模拟持仓和真实持仓使用相同的数据表
- 即使切换到真实交易模式，已有的模拟持仓仍然存在

### 3. 配置保存流程

**配置保存逻辑：** `backend/app/routers/ai_trading.py:192-224`

```python
@router.put("/config")
async def update_config(config_update: AiTradingConfigUpdate):
    # 1. 获取现有配置
    current_config = get_ai_trading_config() or {}
    
    # 2. 更新配置
    update_data = config_update.dict(exclude_unset=True)
    current_config.update(update_data)
    
    # 3. 保存配置
    update_ai_trading_config(current_config)
    
    # 4. 重启引擎（如果正在运行）
    if engine.is_running():
        await engine.stop()
        await engine.start()
```

配置保存**通常是成功的**，但可能：
- 引擎重启需要几秒钟
- 前端没有正确显示配置状态
- 已有持仓阻止新的交易触发

## 解决方案

### 方案 1：清理持仓记录（推荐用于模拟数据）

#### 后端 API

**新增两个 endpoint：**

1. **删除单个持仓**
   ```bash
   DELETE /ai-trading/positions/{symbol}
   ```

2. **清空所有持仓**
   ```bash
   DELETE /ai-trading/positions
   ```

**代码位置：** `backend/app/routers/ai_trading.py:316-372`

#### 前端操作

**位置：** AI 交易页面 → 「💼 持仓管理」标签

**功能：**
1. 每个持仓行末尾有 **"删除"** 按钮
2. 顶部有 **"清空所有持仓"** 按钮
3. 操作前会显示确认对话框
4. 删除后自动刷新数据

**警告提示：**
```
⚠️ 注意：删除持仓仅清除数据库记录，不会触发真实卖出操作。
建议仅在清理模拟数据时使用。
```

### 方案 2：启用真实交易

**前提条件：**
1. Longbridge 凭据已配置
2. DeepSeek API Key 已配置
3. 账户资金充足
4. 已充分测试

**操作步骤：**

1. **打开配置对话框**
   - 点击 AI 交易页面右上角的 **⚙️ 设置** 按钮

2. **启用真实交易**
   - 找到 **"启用真实交易（⚠️ 谨慎操作）"** 开关
   - **打开开关**
   - 会显示警告提示

3. **保存配置**
   - 点击 **"保存配置"**
   - 系统会自动重启引擎

4. **验证配置**
   - 查看引擎状态卡片
   - 检查配置中的 `enable_real_trading: true`

### 方案 3：手动卖出现有持仓

如果模拟持仓需要"平仓"：

#### 选项 A：等待 AI 自动卖出
- AI 会定期评估持仓
- 当满足卖出条件时自动触发卖出
- 可能需要等待一段时间

#### 选项 B：清理持仓记录
- 前往「持仓管理」标签
- 点击对应持仓的"删除"按钮
- 仅清除记录，不影响实际资金

## 操作指南

### 场景 1：清理模拟数据，启用真实交易

```bash
# 步骤 1：清空所有模拟持仓
访问 AI 交易页面 → 持仓管理 → 清空所有持仓

# 步骤 2：启用真实交易
点击设置 → 启用真实交易 → 保存配置

# 步骤 3：触发新的分析
点击"⚡ 立即分析"按钮

# 步骤 4：查看交易记录
切换到「交易记录」标签，查看 status 字段
- SIMULATED = 模拟交易
- FILLED = 真实交易已成交
- SUBMITTED = 真实交易已提交
```

### 场景 2：仅清理特定股票的持仓

```bash
# 步骤 1：前往持仓管理
AI 交易页面 → 持仓管理标签

# 步骤 2：找到需要清理的股票
例如：AAPL

# 步骤 3：点击该行的"删除"按钮
确认删除

# 步骤 4：重新触发分析
点击"⚡ 立即分析"按钮
```

### 场景 3：检查配置是否生效

#### 方法 1：查看引擎状态

**前端显示：**
```typescript
// 在引擎状态卡片中
config: {
  enable_real_trading: true  // 或 false
}
```

#### 方法 2：查看交易日志

**模拟模式日志：**
```
💰 模拟买入: AAPL x 100 @ $150.00
✅ 模拟持仓已创建: AAPL x 100
```

**真实交易模式日志：**
```
💰 真实买入: AAPL x 100 @ 市价
📤 提交买入订单: AAPL...
✅ 订单已提交: order_12345
🎉 买入成功: AAPL x 100 @ $150.25
```

#### 方法 3：查看交易记录

**前端显示：**
```typescript
// 在交易记录表格中
{
  status: 'SIMULATED'        // 模拟交易
  // 或
  status: 'FILLED'           // 真实交易
  longbridge_order_id: '...' // 真实订单ID
}
```

## 数据库结构

### ai_positions 表

```sql
CREATE TABLE IF NOT EXISTS ai_positions (
    id INTEGER PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL,      -- 股票代码
    quantity INTEGER NOT NULL,         -- 持仓数量
    avg_cost DOUBLE NOT NULL,         -- 平均成本
    current_price DOUBLE,             -- 当前价格
    market_value DOUBLE,              -- 市值
    stop_loss_price DOUBLE,           -- 止损价
    take_profit_price DOUBLE,         -- 止盈价
    stop_order_id TEXT,               -- 止损单ID
    open_trade_id INTEGER NOT NULL,   -- 开仓交易ID
    open_time TIMESTAMP NOT NULL,     -- 开仓时间
    unrealized_pnl DOUBLE,            -- 浮动盈亏
    unrealized_pnl_percent DOUBLE,    -- 浮动盈亏百分比
    last_check_time TIMESTAMP         -- 最后检查时间
);
```

### ai_trades 表

```sql
CREATE TABLE IF NOT EXISTS ai_trades (
    id INTEGER PRIMARY KEY,
    analysis_id INTEGER NOT NULL,     -- 分析记录ID
    symbol TEXT NOT NULL,             -- 股票代码
    action TEXT NOT NULL,             -- BUY/SELL
    order_type TEXT DEFAULT 'MARKET', -- 订单类型
    order_quantity INTEGER NOT NULL,  -- 订单数量
    order_price DOUBLE,               -- 订单价格
    order_time TIMESTAMP,             -- 下单时间
    status TEXT NOT NULL,             -- 状态
    longbridge_order_id TEXT,         -- Longbridge 订单ID
    filled_quantity INTEGER,          -- 成交数量
    filled_price DOUBLE,              -- 成交价格
    filled_time TIMESTAMP,            -- 成交时间
    pnl DOUBLE,                       -- 盈亏
    pnl_percent DOUBLE,               -- 盈亏百分比
    ai_confidence DOUBLE,             -- AI 信心度
    ai_reasoning TEXT,                -- AI 推理
    error_message TEXT                -- 错误信息
);
```

**重要字段：**
- `status`: `SIMULATED` (模拟) / `FILLED` (成交) / `SUBMITTED` (已提交) / `FAILED` (失败)
- `longbridge_order_id`: 真实交易会有真实订单ID，模拟交易为 `SIMULATED_yyyyMMddHHmmss`

## API 参考

### 持仓管理

#### 获取所有持仓
```http
GET /ai-trading/positions
```

**响应：**
```json
{
  "total_value": 15000.0,
  "total_cost": 14500.0,
  "total_pnl": 500.0,
  "total_pnl_percent": 3.45,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 100,
      "avg_cost": 145.00,
      "current_price": 150.00,
      "market_value": 15000.00,
      "unrealized_pnl": 500.00,
      "unrealized_pnl_percent": 3.45,
      "open_time": "2025-10-27T10:30:00"
    }
  ]
}
```

#### 删除单个持仓
```http
DELETE /ai-trading/positions/{symbol}
```

**示例：**
```bash
curl -X DELETE http://localhost:8000/ai-trading/positions/AAPL
```

**响应：**
```json
{
  "status": "success",
  "message": "持仓已删除: AAPL"
}
```

#### 清空所有持仓
```http
DELETE /ai-trading/positions
```

**示例：**
```bash
curl -X DELETE http://localhost:8000/ai-trading/positions
```

**响应：**
```json
{
  "status": "success",
  "message": "已清空所有持仓",
  "deleted_count": 3
}
```

## 注意事项

### ⚠️ 删除持仓的影响

**仅删除数据库记录：**
- ✅ 清除持仓数据
- ✅ 允许重新触发买入
- ❌ **不会**触发真实卖出
- ❌ **不会**平仓真实持仓

**适用场景：**
- 清理模拟数据
- 清理错误记录
- 测试环境重置

**不适用场景：**
- 平仓真实持仓（请使用 AI 自动卖出或手动卖出）
- 止损/止盈（由 AI 引擎自动处理）

### 🔒 安全建议

1. **清理前备份数据**
   ```bash
   cp backend/data/quant.db backend/data/quant.db.backup
   ```

2. **分清模拟和真实**
   - 检查 `status` 字段
   - 查看 `longbridge_order_id`
   - 核对 Longbridge App 中的真实持仓

3. **谨慎删除真实持仓记录**
   - 如果对应有真实持仓，删除记录不会平仓
   - 可能导致数据不一致
   - 建议先通过 AI 或手动方式平仓

## 故障排查

### 问题 1：删除持仓后还是提示"已有持仓"

**可能原因：**
- 前端缓存未刷新
- 引擎缓存未更新
- 数据库操作失败

**解决方法：**
```bash
# 1. 刷新页面
按 F5 或 Ctrl+R

# 2. 重启引擎
停止引擎 → 启动引擎

# 3. 检查数据库
sqlite3 backend/data/quant.db "SELECT * FROM ai_positions;"
```

### 问题 2：配置保存后 enable_real_trading 还是 false

**可能原因：**
- 前端状态未同步
- 引擎重启失败
- 数据库写入失败

**解决方法：**
```bash
# 1. 重新打开配置对话框
点击设置按钮，查看当前配置

# 2. 检查引擎状态
查看引擎状态卡片中的 config

# 3. 查看后端日志
tail -f logs/backend.log | grep "enable_real_trading"
```

### 问题 3：清空持仓后无法触发新交易

**可能原因：**
- 达到每日交易次数限制
- 达到每日亏损限制
- AI 信心度不足
- 不满足其他交易条件

**解决方法：**
```bash
# 1. 查看引擎状态
today_trades: 20  # 检查是否达到上限
today_pnl: -5000  # 检查是否超过亏损限制

# 2. 查看分析记录
前往「AI 分析记录」标签
查看 skip_reason 字段

# 3. 调整配置
降低 min_confidence（如 0.70 → 0.65）
提高 max_daily_trades（如 20 → 30）
```

## 相关文档

- [AI_TRADING_ENABLE_REAL_TRADING.md](AI_TRADING_ENABLE_REAL_TRADING.md) - 启用真实交易指南
- [AI_TRADING_GUIDE.md](docs/AI_TRADING_GUIDE.md) - AI 交易完整指南
- [docs/TROUBLESHOOTING_STRATEGY_WATCH.md](docs/TROUBLESHOOTING_STRATEGY_WATCH.md) - 故障排查

## 更新日志

**2025-10-27**
- ✅ 新增删除单个持仓 API
- ✅ 新增清空所有持仓 API
- ✅ 前端持仓管理添加删除功能
- ✅ 添加操作警告提示

---

**最后更新：** 2025-10-27
**适用版本：** Longbridge Quant System v1.0









