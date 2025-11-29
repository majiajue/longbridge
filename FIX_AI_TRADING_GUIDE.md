# AI 交易真实交易问题修复指南

## 问题现象

✅ 勾选了"启用真实交易"
❌ 但是没有实际执行交易
🤖 AI 显示了 BUY 信号，但没有下单

## 根本原因

通过诊断脚本 `check_real_trading.py` 检查发现：
- AI 交易配置不存在
- 没有任何交易记录
- 没有任何 AI 分析记录

**结论**：配置可能没有成功保存到数据库，导致引擎无法启动。

---

## 📋 完整修复步骤

### 步骤 1：检查后端服务是否正常运行

```bash
# 方法 1：检查进程
ps aux | grep uvicorn

# 方法 2：测试 API 是否响应
curl http://localhost:8000/health
```

**预期结果**：应该看到 uvicorn 进程正在运行，API 返回 200

**如果失败**：
```bash
# 启动后端
cd /Volumes/SamSung/longbridge/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 步骤 2：检查前端是否正常运行

```bash
# 检查前端进程
ps aux | grep vite

# 访问前端
open http://localhost:5173
```

**如果失败**：
```bash
# 启动前端
cd /Volumes/SamSung/longbridge/frontend
npm run dev
```

---

### 步骤 3：完整配置 AI 交易（重要！）

#### 3.1 访问 AI Trading 页面
打开浏览器：http://localhost:5173/ai-trading

#### 3.2 点击「设置」按钮（⚙️ 图标）

#### 3.3 填写完整配置（**每一项都要填写**）：

```
✅ 启用 AI 交易引擎          [勾选]
✅ 启用真实交易（⚠️ 谨慎操作） [勾选]

监控股票代码：
  例如：AAPL,TSLA,MSFT,EDUC.US

检查间隔（分钟）：
  建议：5

AI 模型：
  deepseek-chat

AI API Key：
  sk-xxxxxxxxxxxxxxxxxxxx  [必填！]

AI Temperature：
  0.3

最小信心度阈值：
  0.75

单股最大仓位（USD）：
  50000

每日最大交易次数：
  20

每日最大亏损（USD）：
  5000

仓位计算方法：
  - 固定金额 [推荐]
  - 百分比

单次交易金额（USD）：
  10000  [或更小，如 5000]

启用止损：
  [勾选]

默认止损百分比：
  5.0
```

#### 3.4 点击「保存配置」

**关键**：等待页面显示"配置已保存"或看到成功提示！

---

### 步骤 4：验证配置已保存

运行诊断脚本：
```bash
cd /Volumes/SamSung/longbridge
python check_real_trading.py
```

**预期输出**：
```
✅ 配置信息:
  - 引擎启用: ✅ 是
  - 真实交易: ⚠️  已启用
  - AI 模型: deepseek-chat
  - 监控股票: ["AAPL","TSLA","MSFT"]
```

**如果还是显示"配置不存在"**：
- 检查浏览器开发者工具（F12）的 Network 标签
- 看保存配置时是否有报错
- 检查后端日志：`tail -f logs/backend.log`

---

### 步骤 5：启动 AI 交易引擎

回到 AI Trading 页面，点击「启动引擎」按钮。

**观察日志区域**，应该看到：
```
🤖 AI 交易引擎已启动
检查间隔: 5分钟 | 最小信心度: 75%
真实交易: ⚠️ 已启用 | AI模型: deepseek-chat
监控股票: AAPL, TSLA, MSFT
==========================================
```

---

### 步骤 6：触发一次分析（测试）

点击「立即分析」按钮，观察日志输出：

**模拟模式的日志（错误）**：
```
💰 模拟买入: AAPL x 10 @ $150.25
✅ 模拟持仓已创建
```

**真实交易模式的日志（正确）**：
```
💰 真实买入: AAPL x 10 @ 市价
📤 提交买入订单: AAPL...
✅ 订单已提交: order_12345
⏳ 等待成交...
🎉 买入成功: AAPL x 10 @ $150.25
```

---

### 步骤 7：验证交易记录

再次运行诊断脚本：
```bash
python check_real_trading.py
```

**应该看到**：
```
📊 最近10条交易记录:
✅ 2025-11-07 14:30:00 | BUY AAPL x10 @ $150.25
   状态: FILLED | 订单: order_12345
```

或如果还是模拟（说明配置未生效）：
```
💰 2025-11-07 14:30:00 | BUY AAPL x10 @ $150.25
   状态: SIMULATED | 订单: (无订单ID)
```

---

## 🔧 常见问题排查

### 问题 1：保存配置后，引擎启动失败

**可能原因**：
- AI API Key 无效
- Longbridge 凭据未配置
- 监控股票代码格式错误

**解决方法**：
```bash
# 查看后端日志
tail -50 /Volumes/SamSung/longbridge/logs/backend.log

# 查找错误信息
grep "ERROR" logs/backend.log | tail -20
```

---

### 问题 2：引擎启动了，但一直是模拟模式

**原因**：配置中 `enable_real_trading` 未正确保存

**解决方法**：
1. 停止引擎
2. 重新打开设置对话框
3. **再次勾选**「启用真实交易」
4. **点击保存配置**
5. 重新启动引擎

---

### 问题 3：真实交易订单提交失败

**可能原因**：
- Longbridge 凭据错误或过期
- 账户资金不足
- 股票代码错误
- 市场休市

**解决方法**：
```bash
# 前往基础配置页面
# 点击「验证凭据」按钮
# 确保返回 ✅ 验证成功

# 检查 Longbridge 账户余额
# 确保有足够的可用资金
```

---

### 问题 4：配置保存时前端报错

**打开浏览器开发者工具（F12）**：
1. 切换到 Console 标签
2. 查看是否有红色错误信息
3. 切换到 Network 标签
4. 找到 `/ai-trading/config` 的 PUT 请求
5. 查看 Response 内容

**常见错误**：
- 401：未授权（检查登录状态）
- 500：服务器内部错误（查看后端日志）
- 422：参数验证失败（检查配置项是否完整）

---

## ✅ 最终验证清单

在确认真实交易已启用之前，请逐项检查：

- [ ] 后端服务正常运行（端口 8000）
- [ ] 前端服务正常运行（端口 5173）
- [ ] Longbridge 凭据已配置并验证成功
- [ ] DeepSeek API Key 已配置
- [ ] AI 交易配置已完整填写
- [ ] 「启用真实交易」已勾选
- [ ] 配置已成功保存（有成功提示）
- [ ] 运行 `check_real_trading.py` 显示配置存在
- [ ] 真实交易开关显示为 ⚠️ 已启用
- [ ] AI 引擎已启动
- [ ] 点击「立即分析」触发一次测试
- [ ] 查看日志显示「真实买入」而非「模拟买入」
- [ ] 交易记录状态为 `FILLED` 或 `SUBMITTED`
- [ ] Longbridge Order ID 存在（不是 SIMULATED_xxx）

---

## 🔄 快速重置方法

如果问题仍然存在，可以尝试完全重置：

### 方法 1：重启所有服务

```bash
cd /Volumes/SamSung/longbridge

# 停止所有服务
./stop.sh

# 等待 3 秒
sleep 3

# 重新启动
./start.sh
```

### 方法 2：清除配置重新设置

```bash
# ⚠️ 警告：此操作会删除 AI 交易配置（但保留交易记录）
cd /Volumes/SamSung/longbridge/backend
python -c "
import sys
sys.path.insert(0, '.')
from app.db import get_connection

with get_connection() as conn:
    conn.execute('DELETE FROM ai_trading_config WHERE id = 1')
    print('✅ 配置已清除，请重新保存配置')
"
```

然后重新按步骤 3 配置。

---

## 📞 获取帮助

如果以上步骤都无法解决问题，请提供以下信息：

1. **诊断脚本输出**：
   ```bash
   python check_real_trading.py > diagnosis.txt
   ```

2. **后端日志最后 100 行**：
   ```bash
   tail -100 logs/backend.log > backend_recent.log
   ```

3. **浏览器控制台错误**（F12 → Console 标签截图）

4. **配置保存时的网络请求详情**（F12 → Network 标签）

---

## 📚 相关文档

- [AI_TRADING_ENABLE_REAL_TRADING.md](./AI_TRADING_ENABLE_REAL_TRADING.md) - 真实交易启用指南
- [BUGFIX_ENABLE_REAL_TRADING.md](./BUGFIX_ENABLE_REAL_TRADING.md) - 已知 BUG 修复记录
- [QUICK_START_AI_TRADING.md](./QUICK_START_AI_TRADING.md) - 快速启动指南
- [docs/AI_TRADING_GUIDE.md](./docs/AI_TRADING_GUIDE.md) - 完整使用指南

---

**最后更新**：2025-11-07
**适用版本**：Longbridge Quant System v2.0+


