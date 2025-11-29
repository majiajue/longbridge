# BUG修复：真实交易开关无效问题

## 问题描述

用户在 AI 交易配置页面勾选了"启用真实交易"，但是下单后订单状态仍然显示 `SIMULATED`（模拟交易）。

## 根本原因

在 `backend/app/repositories.py` 中的 `update_ai_trading_config()` 函数存在 BUG：

- **UPDATE 语句**（第904-940行）：没有包含 `enable_real_trading` 字段
- **INSERT 语句**（第942-966行）：也没有包含 `enable_real_trading` 字段

虽然：
1. 数据库表 `ai_trading_config` 中有 `enable_real_trading` 列（通过迁移添加）
2. 前端会正确发送 `enable_real_trading: true` 参数
3. 但后端保存配置时**忽略了这个字段**

因此，当引擎重新启动并读取配置时：
```python
enable_real_trading = self.config.get('enable_real_trading', False)
```
由于数据库中没有保存这个值，`get()` 返回默认值 `False`，导致一直走模拟交易逻辑。

## 修复内容

### 修改文件：`backend/app/repositories.py`

1. **UPDATE 语句**（第918行）：
   ```sql
   UPDATE ai_trading_config SET
       ...
       enable_real_trading = ?,  -- ✅ 新增
       ...
   ```

2. **INSERT 语句**（第947行）：
   ```sql
   INSERT INTO ai_trading_config (
       ...
       enable_real_trading,  -- ✅ 新增
       ...
   ) VALUES (1, ?, ?, ?, ...)
   ```

3. **参数绑定**（UPDATE 第936行，INSERT 第963行）：
   ```python
   config.get('enable_real_trading', False),  -- ✅ 新增
   ```

## 使用步骤

修复后，用户需要：

1. **重启后端服务**
   ```bash
   # 停止后端
   # 根据你的启动方式停止服务
   
   # 重新启动后端
   cd backend
   uvicorn app.main:app --reload
   ```

2. **重新保存配置**
   - 前往 AI Trading 页面
   - 点击「设置」按钮
   - 重新勾选「启用真实交易」
   - 点击「保存配置」
   
3. **重启 AI 引擎**
   - 如果引擎正在运行，配置保存时会自动重启
   - 如果引擎已停止，点击「启动引擎」

4. **验证修复**
   - 点击「立即分析」触发一次交易
   - 查看交易记录中的「状态」列
   - 应该显示 `SUBMITTED` 或 `FILLED`，而不是 `SIMULATED`

## 注意事项

⚠️ **真实交易风险提示**：

1. 启用真实交易后，系统会通过 Longbridge API 执行**真实的买卖订单**
2. 建议先在**模拟模式下充分测试** 1-2 天
3. 初次启用真实交易时，建议：
   - 单笔交易金额 ≤ $5,000
   - 监控股票数量 ≤ 3-5 只
   - 设置合理的止损止盈
   - 密切监控交易记录

4. 确保 Longbridge 账户：
   - 凭据配置正确（Settings 页面）
   - 账户资金充足
   - 了解交易佣金和费用

## 验证修复是否成功

### 方法 1：查看后端日志

```bash
tail -f logs/backend.log | grep "真实"
```

**预期输出**（真实交易模式）：
```
💰 真实买入: AAPL x 10 @ 市价
📤 提交买入订单: AAPL...
✅ 订单已提交: ORDER_ID_123
🎉 买入成功: AAPL x 10 @ $150.25
```

**如果还是模拟**（说明配置未生效）：
```
💰 模拟买入: AAPL x 10 @ $150.25
✅ 模拟持仓已创建: AAPL x 10
```

### 方法 2：检查数据库

```bash
# 进入 backend 目录
cd backend

# 使用 DuckDB CLI 查看配置
duckdb ../data/quant.db "SELECT enable_real_trading FROM ai_trading_config WHERE id = 1"
```

**预期输出**：
```
┌──────────────────────┐
│ enable_real_trading  │
│       boolean        │
├──────────────────────┤
│ true                 │
└──────────────────────┘
```

### 方法 3：前端 API 调用

打开浏览器开发者工具（F12），在 Console 中执行：

```javascript
fetch('http://localhost:8000/ai-trading/config')
  .then(r => r.json())
  .then(d => console.log('enable_real_trading:', d.enable_real_trading))
```

**预期输出**：
```
enable_real_trading: true
```

## 技术细节

### 代码流程

1. **前端保存配置**：
   ```typescript
   // frontend/src/pages/AiTrading.tsx
   const configToSave = {
     ...config,
     enable_real_trading: true  // ✅ 前端发送
   };
   
   fetch(`${API_BASE}/ai-trading/config`, {
     method: 'PUT',
     body: JSON.stringify(configToSave)
   });
   ```

2. **后端保存配置**：
   ```python
   # backend/app/routers/ai_trading.py
   @router.put("/config")
   async def update_config(config_update: AiTradingConfigUpdate):
       update_ai_trading_config(current_config)  # ✅ 调用仓库层
   ```

3. **仓库层持久化**：
   ```python
   # backend/app/repositories.py (修复后)
   def update_ai_trading_config(config: Dict):
       conn.execute("""
           UPDATE ai_trading_config SET
               enable_real_trading = ?,  -- ✅ 现在会保存
               ...
       """, (
           config.get('enable_real_trading', False),  -- ✅ 绑定参数
           ...
       ))
   ```

4. **引擎读取配置**：
   ```python
   # backend/app/ai_trading_engine.py
   async def start(self):
       self.config = get_ai_trading_config()  # ✅ 从数据库读取
   ```

5. **执行交易时判断**：
   ```python
   # backend/app/ai_trading_engine.py
   async def _execute_buy(self, ...):
       enable_real_trading = self.config.get('enable_real_trading', False)
       
       if enable_real_trading:
           # ✅ 真实交易逻辑
           trading_api = get_trading_api()
           order_response = await trading_api.place_order(...)
       else:
           # 模拟交易逻辑
           save_ai_trade(..., status='SIMULATED')
   ```

## 版本信息

- **修复日期**：2025-10-29
- **影响版本**：V2.0 及之前所有版本
- **修复版本**：V2.0.1
- **修复文件**：`backend/app/repositories.py`

## 相关文档

- [AI_TRADING_ENABLE_REAL_TRADING.md](./AI_TRADING_ENABLE_REAL_TRADING.md) - 真实交易启用指南
- [AI_TRADING_V2_SUMMARY.md](./AI_TRADING_V2_SUMMARY.md) - AI 交易系统 V2.0 说明
- [QUICK_START_AI_TRADING.md](./QUICK_START_AI_TRADING.md) - 快速启动指南

---

**问题反馈**：如果修复后仍然有问题，请检查：
1. 后端服务是否已重启
2. 配置是否已重新保存
3. AI 引擎是否已重启
4. 数据库中 `enable_real_trading` 是否为 `true`



