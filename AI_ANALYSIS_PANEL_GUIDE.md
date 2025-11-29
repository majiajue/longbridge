# AI 实时分析面板使用指南

## 🎨 功能概述

新增了**类似 RockAlpha 的 AI 实时分析面板**，在 AI Trading 页面右侧显示完整的 AI 思考过程和技术分析。

### 灵感来源

参考 Rockflow RockAlpha 平台的 "Model Chats" 功能，我们实现了：
- ✅ 实时显示 AI 分析文本
- ✅ 完整的思考过程（Chain of Thought）
- ✅ 技术指标详情
- ✅ 时间戳标记
- ✅ 可展开/折叠的详细分析
- ✅ WebSocket 实时推送

## 📊 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│                    🤖 AI 自动交易                            │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│   📈 实时K线图        │     🤖 AI 实时分析                   │
│   (7列宽度)          │     (5列宽度)                        │
│                      │                                      │
│   [K线图表]          │   ┌─────────────────────────┐        │
│                      │   │ AAPL      BUY  19:22    │        │
│                      │   │ 💰 $150.25  🎯 88%      │        │
│                      │   │ ⚖️ 风险收益比: 2.5      │        │
│                      │   │                         │        │
│                      │   │ MA: 突破MA20            │        │
│                      │   │ MACD: 金叉              │        │
│                      │   │ RSI: 45 中性偏多        │        │
│                      │   │                         │        │
│                      │   │ • 技术指标共振...       │        │
│                      │   │ • 成交量放大...         │        │
│                      │   │                         │        │
│                      │   │ [查看完整思考过程 ▼]    │        │
│                      │   └─────────────────────────┘        │
│                      │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

## 🎯 主要功能

### 1. 实时推送

- 通过 WebSocket (`/ws/ai-trading`) 实时接收 AI 分析
- 无需刷新页面，自动滚动到最新消息
- 最多显示 30 条历史消息（可配置）

### 2. 分析卡片

每条分析显示：
- **头部**：股票代码、操作类型（BUY/SELL/HOLD）、时间戳
- **价格信息**：当前价格、信心度、风险收益比
- **技术指标**：MA、MACD、RSI、成交量、K线形态
- **简短推理**：默认显示前 2 条关键要点
- **完整思考过程**：可展开查看详细的 Chain of Thought

### 3. 视觉设计

- **颜色编码**：
  - 🟢 绿色 - BUY 操作
  - 🔴 红色 - SELL 操作
  - ⚪ 灰色 - HOLD 操作
- **左侧彩条**：根据操作类型显示不同颜色
- **悬停效果**：鼠标悬停时卡片向左移动并加深阴影
- **平滑滚动**：新消息自动滚动到底部

## 🚀 使用步骤

### 1. 启动后端服务

```bash
cd /Volumes/SamSung/longbridge/backend
uvicorn app.main:app --reload
```

### 2. 启动前端服务

```bash
cd /Volumes/SamSung/longbridge/frontend
npm run dev
```

### 3. 配置 AI 交易

1. 打开 AI Trading 页面
2. 点击「设置」按钮
3. 配置：
   - 添加监控股票（如 AAPL, TSLA, GOOGL）
   - 设置 AI 模型和参数
   - 保存配置

### 4. 启动引擎

- 点击「启动引擎」按钮
- 右侧面板会显示 "等待 AI 分析中..."

### 5. 触发分析

- 点击「立即分析」按钮
- 或等待定时分析触发
- 右侧面板实时显示 AI 分析过程

## 📱 组件说明

### AiAnalysisPanel 组件

**位置**：`frontend/src/components/AiAnalysisPanel.tsx`

**Props**：
```typescript
interface AiAnalysisPanelProps {
  wsUrl: string;        // WebSocket URL
  maxMessages?: number; // 最多显示消息数（默认 20）
}
```

**特性**：
- 自动连接 WebSocket
- 断线自动重连（3秒后）
- 消息队列管理
- 平滑滚动
- 展开/折叠控制

## 🔧 技术实现

### 前端

1. **WebSocket 连接**
```typescript
const ws = new WebSocket(resolveWsUrl('/ws/ai-trading'));
```

2. **消息处理**
```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'ai_analysis') {
    // 处理 AI 分析消息
  }
};
```

3. **状态管理**
- `messages`: 存储所有分析消息
- `expandedId`: 当前展开的消息 ID
- 自动滚动到底部

### 后端

**WebSocket 端点**：`/ws/ai-trading`

**消息格式**：
```json
{
  "type": "ai_analysis",
  "data": {
    "id": 123,
    "symbol": "AAPL",
    "analysis_time": "2025-10-29T19:22:00",
    "action": "BUY",
    "confidence": 0.88,
    "chain_of_thought": "完整的思考过程文本...",
    "reasoning": ["要点1", "要点2"],
    "current_price": 150.25,
    "technical_signals": {
      "ma_trend": "突破MA20",
      "macd_status": "金叉",
      "rsi_status": "45 中性偏多",
      "volume_status": "放量1.5倍"
    },
    "kline_pattern": "早晨之星",
    "risk_reward_ratio": 2.5
  }
}
```

## 📊 数据流程

```
AI Trading Engine
       ↓
  分析股票并生成决策
       ↓
  await _broadcast({
    type: 'ai_analysis',
    data: { ... }
  })
       ↓
  WebSocket (/ws/ai-trading)
       ↓
  前端 AiAnalysisPanel
       ↓
  显示在右侧面板
```

## 🎨 自定义样式

### 修改卡片颜色

编辑 `AiAnalysisPanel.tsx`：
```typescript
const getActionColor = (action: string) => {
  switch (action) {
    case 'BUY':
      return '#4caf50';  // 修改为你想要的颜色
    case 'SELL':
      return '#f44336';
    default:
      return '#9e9e9e';
  }
};
```

### 修改消息数量

在 `AiTrading.tsx` 中：
```typescript
<AiAnalysisPanel 
  wsUrl={resolveWsUrl('/ws/ai-trading')} 
  maxMessages={50}  // 修改为你想要的数量
/>
```

### 修改面板高度

在 `AiTrading.tsx` 中：
```typescript
<Card sx={{ height: '800px' }}>  // 修改高度
  <AiAnalysisPanel ... />
</Card>
```

## 🐛 故障排查

### 1. 面板显示"等待 AI 分析中..."

**原因**：
- AI 引擎未启动
- 未配置监控股票
- WebSocket 未连接

**解决**：
1. 检查引擎状态（应该显示"运行中"）
2. 点击「启动引擎」
3. 点击「立即分析」触发一次分析

### 2. WebSocket 连接失败

**原因**：
- 后端未启动
- CORS 配置问题
- 网络问题

**解决**：
```bash
# 查看后端日志
tail -f logs/backend.log | grep WebSocket

# 预期看到：
# INFO:app.main:📡 AI trading WebSocket connected
```

### 3. 消息不显示

**原因**：
- 消息格式不匹配
- `type` 字段不是 `ai_analysis`

**调试**：
```typescript
// 在 AiAnalysisPanel.tsx 中添加日志
ws.onmessage = (event) => {
  console.log('Received message:', event.data);
  // ...
};
```

### 4. Chain of Thought 为空

**原因**：
- AI 分析器未返回该字段
- AI 模型版本不支持

**解决**：
1. 检查 `backend/app/ai_analyzer.py`
2. 确认 System Prompt 中要求返回 `chain_of_thought`
3. 查看后端日志：
```bash
tail -f logs/backend.log | grep "AI 思考过程"
```

## 📈 性能优化

### 1. 消息限制

默认最多显示 30 条消息，超过后自动删除最旧的：
```typescript
if (updated.length > maxMessages) {
  return updated.slice(-maxMessages);
}
```

### 2. 虚拟滚动

如果消息很多，可以使用 `react-window` 实现虚拟滚动：
```bash
npm install react-window
```

### 3. WebSocket 心跳

添加心跳机制防止连接超时：
```typescript
setInterval(() => {
  if (ws.current?.readyState === WebSocket.OPEN) {
    ws.current.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

## 🎯 未来改进

- [ ] 支持筛选特定股票的分析
- [ ] 支持导出分析记录
- [ ] 支持分析记录搜索
- [ ] 添加语音播报功能
- [ ] 支持多个 AI 模型对比（类似 RockAlpha 的多模型）
- [ ] 添加分析统计图表
- [ ] 支持自定义消息模板

## 📚 相关文档

- [AI_TRADING_V2_SUMMARY.md](./AI_TRADING_V2_SUMMARY.md) - AI 交易系统 V2.0 说明
- [BUGFIX_ENABLE_REAL_TRADING.md](./BUGFIX_ENABLE_REAL_TRADING.md) - 真实交易配置修复
- [QUICK_START_AI_TRADING.md](./QUICK_START_AI_TRADING.md) - 快速启动指南

## 🙏 致谢

感谢 Rockflow RockAlpha 平台提供的界面设计灵感！

---

**版本**：V1.0
**创建日期**：2025-10-29
**作者**：AI Trading Team



