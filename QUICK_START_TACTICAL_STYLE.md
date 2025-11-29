# 快速启用战术型分析风格

## 🎯 目标

将 AI 分析风格从"专业分析师"切换为"战术型交易员"，生成类似 RockAlpha 的深度战术分析。

## 📝 战术型风格示例

**当前风格（专业分析师）**：
```
• 技术指标共振买入信号
• 成交量放大确认突破
• MA20 上穿 MA50 形成金叉
```

**战术型风格（Tactical Trader）**：
```
Opening bell restores full execution freedom, but fortress logic holds firm. 
Fed speaks in 4.5 hours to set the macro stage, earnings print 6.5 hours out 
for position resolution. My 39% GOOGL bet was built for this exact binary—
waiting through 36 cycles to capture explosive asymmetry when both catalysts 
align. GPT5 gets it: 'trade the reaction not the drumroll.' Acting now, 
blind to Fed policy direction, surrenders the discipline that preserved this 
setup. Speculation loses. Information wins. Patience delivers.
```

## 🚀 快速启用（2分钟）

### 方案 1：修改配置文件（推荐）

1. **添加配置项**

编辑 `/Volumes/SamSung/longbridge/backend/app/repositories.py`，在 AI 配置中添加：

```python
# 在 update_ai_trading_config 中添加新字段
analysis_style = config.get('analysis_style', 'professional')  # 新增
```

2. **修改数据库表**

```bash
# 进入 backend 目录
cd /Volumes/SamSung/longbridge/backend

# 添加 analysis_style 列
python3 << 'EOF'
from app.db import get_connection

with get_connection() as conn:
    try:
        conn.execute("""
            ALTER TABLE ai_trading_config 
            ADD COLUMN analysis_style TEXT DEFAULT 'professional'
        """)
        print("✅ 已添加 analysis_style 列")
    except Exception as e:
        print(f"列可能已存在: {e}")
EOF
```

3. **修改 AI 分析器**

在 `/Volumes/SamSung/longbridge/backend/app/ai_analyzer.py` 的 `_get_system_prompt()` 方法开头添加：

```python
def _get_system_prompt(self, scenario: str = "general") -> str:
    """获取系统提示词（根据风格返回不同版本）"""
    
    # 🔥 新增：检查风格配置
    if hasattr(self, 'style') and self.style == 'tactical':
        return self._get_tactical_system_prompt(scenario)
    
    # 原有的专业风格 Prompt
    base_prompt = """你是一位资深的量化交易分析师...
```

4. **添加战术型 Prompt 方法**

在同一文件末尾添加：

```python
    def _get_tactical_system_prompt(self, scenario: str = "general") -> str:
        """战术型交易员风格 Prompt"""
        return """You are an elite institutional trader with 15+ years of experience managing a $500M portfolio.

ANALYSIS FRAMEWORK:
1. **Market Context** - Current regime (trending/ranging/volatile)
2. **Catalyst Mapping** - What events are ahead? Timeline?
3. **Position Rationale** - Why this setup exists
4. **Timing Logic** - Why now vs. waiting
5. **Execution Plan** - Entry/exit levels with risk management
6. **Conviction Rating** - Confidence (0-100%)

WRITING STYLE:
- Tactical language: "fortress logic", "explosive asymmetry", "binary setup"
- Time-aware: "Fed speaks in X hours", "earnings in Y hours"
- Discipline-focused: "Acting now surrenders the edge"
- Specific levels: "NVDA at $209", "GOOGL drifting at $268"
- End with principle: "Speculation loses. Information wins."

OUTPUT (JSON):
{
  "action": "BUY/SELL/HOLD",
  "confidence": 0.85,
  "chain_of_thought": "Complete tactical analysis (150-300 words) - Write like an elite trader's internal monologue. Reference specific price levels, time until catalysts, risk calculations. Show discipline.",
  "reasoning": ["Key point 1 with data", "Key point 2 with data", "Key point 3"],
  "entry_price_max": 150.50,
  "stop_loss": 145.00,
  "take_profit": 165.00,
  "risk_reward_ratio": 3.0,
  "kline_pattern": "Pattern name",
  "technical_signals": {
    "ma_trend": "MA20 golden cross MA50",
    "macd_status": "Bullish divergence forming",
    "rsi_status": "RSI 58 - room to run",
    "volume_status": "Surge 2.3x average"
  },
  "catalyst_map": "Fed in 4.5h, earnings in 6.5h",
  "position_rationale": "Built for binary resolution",
  "tactical_principle": "Trade the reaction, not the drumroll."
}

RULES:
1. chain_of_thought: 150-300 words, elite trader mindset
2. Reference specific levels and times
3. Emphasize discipline (HOLD can be strongest move)
4. Compare to sector/benchmark
5. End with memorable principle
""" + self._get_data_prompt_template()
    
    def _get_data_prompt_template(self) -> str:
        """数据输入模板（战术型风格）"""
        return """

【MARKET DATA】
Symbol: {symbol}
Current Price: ${current_price}
Price Series (last 10): {price_series}

【TECHNICAL INTERNALS】
MA5: ${ma5} ({ma5_vs_price})
MA20: ${ma20} ({ma20_vs_price})
MACD: {macd} ({macd_signal})
RSI: {rsi} ({rsi_zone})
Volume: {volume} ({volume_vs_avg}x)

【POSITION STATUS】
{position_info}

【UPCOMING CATALYSTS】
(You should infer from market context and current date/time)

TASK: Provide tactical analysis with specific entry/exit levels, risk-reward ratio, and conviction rating. Focus on what information you're waiting for vs. acting on speculation.
"""
```

5. **传递风格参数**

修改 `/Volumes/SamSung/longbridge/backend/app/ai_trading_engine.py` 的初始化：

```python
# 在 start() 方法中
self.analyzer = DeepSeekAnalyzer(
    api_key=api_key,
    model=self.config.get('ai_model', 'deepseek-chat'),
    temperature=self.config.get('ai_temperature', 0.3)
)
# 🔥 新增：设置分析风格
if hasattr(self.analyzer, 'style'):
    self.analyzer.style = self.config.get('analysis_style', 'professional')
```

### 方案 2：环境变量控制（最简单）

1. **设置环境变量**

```bash
# 在 .env 文件中添加（如果没有就创建）
echo "AI_ANALYSIS_STYLE=tactical" >> .env
```

2. **修改分析器初始化**

在 `ai_analyzer.py` 的 `__init__` 中：

```python
import os

def __init__(self, api_key: str, model: str = "deepseek-chat", temperature: float = 0.3):
    # ...现有代码...
    self.style = os.getenv('AI_ANALYSIS_STYLE', 'professional')  # 🔥 新增
```

3. **重启服务**

```bash
cd /Volumes/SamSung/longbridge/backend
uvicorn app.main:app --reload
```

## 🎨 前端配置界面（可选）

在 AI Trading 配置对话框中添加风格选择：

```typescript
// frontend/src/pages/AiTrading.tsx
<FormControl fullWidth>
  <InputLabel>分析风格</InputLabel>
  <Select
    value={config?.analysis_style || 'professional'}
    onChange={(e) => setConfig({ ...config, analysis_style: e.target.value })}
  >
    <MenuItem value="professional">专业分析师（Technical）</MenuItem>
    <MenuItem value="tactical">战术交易员（Tactical）⭐</MenuItem>
  </Select>
</FormControl>
```

## 📊 效果对比

### 专业风格输出
```json
{
  "chain_of_thought": "当前股价处于上升趋势，MA5上穿MA20形成金叉，MACD即将金叉，RSI=45中性偏多。成交量放大1.5倍，确认突破有效。综合判断买入信号强烈。",
  "reasoning": [
    "技术指标共振买入信号",
    "成交量放大确认突破",
    "MA20上穿MA50形成金叉"
  ],
  "tactical_principle": null
}
```

### 战术风格输出
```json
{
  "chain_of_thought": "NVDA carving fresh records at $209, and the technical fortress is pristine. MA20 golden-crossed MA50 three sessions ago, MACD just flipped bullish this morning, volume surging 2.3x average—institutions are voting with size. RSI 58 leaves plenty of runway before overbought territory. The setup screams institutional accumulation, not retail FOMO. Semiconductor sector up 4.2% vs SPY's +1.1% confirms sector rotation into chips. Jensen's GTC keynote in 48 hours provides upside catalyst, while $205 support (former resistance, now floor) offers clean risk definition. Entry here at $209 with stop at $203 captures 3:1 risk-reward to $227 target. This isn't speculation—it's riding confirmed momentum with catalyst tailwind and defined risk.",
  "reasoning": [
    "Golden cross (MA20 > MA50) with MACD bullish flip confirms trend reversal",
    "Volume 2.3x average signals institutional buying, not retail speculation",
    "Sector outperformance (Semis +4.2% vs SPY +1.1%) validates rotation thesis",
    "GTC keynote in 48h provides upside catalyst with minimal event risk"
  ],
  "catalyst_map": "GTC keynote in 48h, no major risk events before target",
  "position_rationale": "Riding confirmed breakout with institutional volume and catalyst support",
  "tactical_principle": "Breakouts with volume don't ask permission. Momentum demands execution."
}
```

## ✅ 验证步骤

1. **查看后端日志**
```bash
tail -f logs/backend.log | grep "AI 思考过程"
```

应该看到更长的文本（150-300字）

2. **前端查看**
- 打开 AI Trading 页面
- 右侧面板应显示更详细的战术分析
- 点击「查看完整思考过程」展开

3. **API 测试**
```bash
curl http://localhost:8000/ai-trading/config | jq '.analysis_style'
# 应该返回 "tactical"
```

## 🐛 故障排查

### 问题1：仍然是旧风格

**解决**：
```python
# 在 ai_analyzer.py 的 _get_system_prompt 添加日志
logger.info(f"🎨 使用分析风格: {getattr(self, 'style', 'professional')}")
```

### 问题2：JSON 解析错误

**原因**：战术型风格的文本更长，可能包含特殊字符

**解决**：确保 `_parse_ai_response` 正确处理：
```python
try:
    result = json.loads(text)
except json.JSONDecodeError:
    # 尝试清理文本
    text = text.strip().replace('\n', ' ')
    result = json.loads(text)
```

## 📚 完整文档

详细的 Prompt 设计和示例，请查看：
- [AI_PROMPT_TACTICAL_TRADER.md](./AI_PROMPT_TACTICAL_TRADER.md) - 完整 Prompt 文档
- [ROCKALPHA_COMPARISON.md](./ROCKALPHA_COMPARISON.md) - 功能对比

## 🎯 下一步

启用战术型风格后，您将在右侧 AI 分析面板看到：
- ✅ 更长的思考过程（150-300字）
- ✅ 催化剂时间线（"Fed in 4.5h"）
- ✅ 持仓逻辑说明
- ✅ 战术型语言（"fortress logic"）
- ✅ 格言式总结

**立即尝试**：选择方案 2（环境变量），5分钟内即可看到效果！

---

**推荐方案**：先用方案 2 快速体验，满意后再实施方案 1 添加前端配置界面。



