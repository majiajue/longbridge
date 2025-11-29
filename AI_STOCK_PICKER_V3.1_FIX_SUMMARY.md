# AI选股 V3.1 舆情增强版 - 问题修复总结

📅 **修复日期**: 2025-11-05  
🎯 **版本**: V3.1 舆情增强版  
✅ **状态**: 已完成

---

## 🐛 问题汇总

### 1. 数据库锁问题
**现象**: DuckDB被多个进程锁定，导致系统无法启动  
**根源**: 
- 多个Python进程同时访问quant.db
- WAL文件未正确清理

**解决方案**:
```bash
# 强制终止所有锁定进程
pkill -9 -f "uvicorn.*app.main:app"
pkill -9 -f "Python.*backend"

# 清理WAL文件
rm -f backend/data/quant.db.wal

# 重启服务
./start.sh
```

### 2. Tavily API Key保存失败
**现象**: 前端保存提示成功，但刷新后配置丢失  
**根源**: `backend/app/repositories.py` 中 `AI_CRED_KEYS` 字典缺少 `TAVILY_API_KEY` 定义

**修复**:
```python
# 修改前
AI_CRED_KEYS = {
    "DEEPSEEK_API_KEY": "deepseek_api_key",
}

# 修改后
AI_CRED_KEYS = {
    "DEEPSEEK_API_KEY": "deepseek_api_key",
    "TAVILY_API_KEY": "tavily_api_key",  # ← 新增
}
```

同时更新了SQL查询占位符：
```python
# backend/app/repositories.py line 106
rows = conn.execute(
    "SELECT key, value FROM settings WHERE key IN (?, ?)",  # 1个→2个
    list(AI_CRED_KEYS.values()),
).fetchall()
```

### 3. 前端缺少新闻舆情显示
**现象**: 后端返回了news评分数据，但前端"评分细节"中看不到  
**根源**: `frontend/src/pages/StockPicker.tsx` 只显示了5个维度，缺少第6个维度（新闻舆情）

**修复**:
1. 添加新闻舆情评分条
2. 调整显示顺序（按权重从高到低）
3. 增加未启用提示
4. 增强ScoreBar组件支持自定义颜色

```tsx
// 修改后的显示顺序
<ScoreBar label="波动" value={analysis.score.breakdown.volatility} max={25} color="purple" />
<ScoreBar label="新闻舆情" value={analysis.score.breakdown.news || 0} max={20} color="blue" />
<ScoreBar label="动量" value={analysis.score.breakdown.momentum} max={18} />
<ScoreBar label="趋势" value={analysis.score.breakdown.trend} max={15} />
<ScoreBar label="量能" value={analysis.score.breakdown.volume} max={12} />
<ScoreBar label="形态" value={analysis.score.breakdown.pattern} max={10} />

{!analysis.score.breakdown.news && (
  <p className="text-xs text-gray-500 mt-2">
    🔍 未启用新闻分析 - 请在"设置"页面配置Tavily API Key
  </p>
)}
```

---

## 📋 修改的文件

### 后端
1. **backend/app/repositories.py**
   - 第17-20行：添加 `TAVILY_API_KEY` 到 `AI_CRED_KEYS`
   - 第106行：更新SQL查询占位符（1个→2个）

### 前端
1. **frontend/src/pages/Settings.tsx**
   - 第395行：更新提示文字（10分→20分）

2. **frontend/src/pages/StockPicker.tsx**
   - 第559行：更新标题"评分细节（V3.1 舆情增强版）"
   - 第561-566行：添加新闻舆情评分条，调整显示顺序
   - 第568-572行：添加未启用新闻分析提示
   - 第607-645行：增强ScoreBar组件支持自定义颜色

---

## 🎯 AI选股判断逻辑

### 1. 后端判断流程（backend/app/stock_picker.py）

```python
# 第310行：检查Tavily配置
tavily_api_key = ai_creds.get('TAVILY_API_KEY')
logger.info(f"🤖 DeepSeek分析: {symbol} (搜索引擎: {'✅' if tavily_api_key else '❌'})")

# 第318行：传递给AI分析器
analyzer = DeepSeekAnalyzer(
    api_key=api_key,
    base_url=base_url,
    tavily_api_key=tavily_api_key  # ⬆️ 传递Tavily API Key
)
```

### 2. AI分析器判断（backend/app/ai_analyzer.py）

```python
# 初始化时（第51-59行）
self.news_analyzer = None
if tavily_api_key:
    try:
        from .news_analyzer import get_news_analyzer
        self.news_analyzer = get_news_analyzer(tavily_api_key)
        if self.news_analyzer:
            logger.info("✅ 新闻分析器已集成")
    except Exception as e:
        logger.warning(f"⚠️ 新闻分析器初始化失败: {e}")

# 分析时（第104-114行）
news_analysis = None
if self.news_analyzer:
    try:
        logger.info(f"🔍 获取{symbol}的新闻分析...")
        news_analysis = self.news_analyzer.search_stock_news(
            symbol=symbol,
            days=7  # 最近7天
        )
        logger.info(f"✅ 新闻分析完成: {news_analysis['news_count']}条新闻")
    except Exception as e:
        logger.warning(f"⚠️ 新闻分析失败: {e}")
        news_analysis = None

# 计算评分（第541-567行）
news_score = 0
if news_analysis:
    impact_score = news_analysis.get('impact_score', 5)
    news_score = impact_score * 2  # 满分20分
    
    # 根据影响度生成信号
    if impact_score >= 8:
        signals.append("📰 重大正面新闻")
    elif impact_score >= 6:
        signals.append("📰 正面新闻")
    elif impact_score <= 2:
        signals.append("📰 重大负面新闻")
    elif impact_score <= 4:
        signals.append("📰 负面新闻")
```

### 3. 前端显示判断（frontend/src/pages/StockPicker.tsx）

```tsx
// 显示评分（第561-566行）
<ScoreBar label="新闻舆情" value={analysis.score.breakdown.news || 0} max={20} color="blue" />

// 判断是否显示提示（第568-572行）
{!analysis.score.breakdown.news && (
  <p className="text-xs text-gray-500 mt-2">
    🔍 未启用新闻分析 - 请在"设置"页面配置Tavily API Key
  </p>
)}
```

---

## ✨ V3.1 舆情增强版特性

### 评分系统升级

| 排名 | 维度 | 满分 | 权重 | 变化 |
|------|------|------|------|------|
| 🥇 | 波动性 | 25分 | 25% | 保持（最高权重） |
| 🥈 | 新闻舆情 | 20分 | 20% | ⬆️⬆️ 翻倍（10→20） |
| 🥉 | 动量 | 18分 | 18% | ⬇️ 降低（20→18） |
| 4️⃣ | 趋势 | 15分 | 15% | ⬇️ 降低（20→15） |
| 5️⃣ | 量能 | 12分 | 12% | ⬇️ 降低（15→12） |
| 6️⃣ | 形态 | 10分 | 10% | 保持 |

### 技术改进

- ✅ K线数据深度：200根 → 1000根
- ✅ 新闻搜索：Tavily实时集成（7天内）
- ✅ 优先策略：高波动性 + 强新闻影响
- ✅ 前端显示：6个评分维度，彩色评分条
- ✅ 智能提示：自动判断是否启用新闻分析

---

## 📱 使用指南

### 1. 配置Tavily API Key

```
步骤1: 访问 http://localhost:5173
步骤2: 进入"设置" → "AI配置"
步骤3: 输入Tavily API Key
步骤4: 点击"💾 保存 AI 配置"
步骤5: 刷新页面验证（F5）
```

### 2. 开始AI选股

```
步骤1: 进入"AI选股"页面
步骤2: 添加股票到做多池或做空池
步骤3: 点击"🔍 分析"按钮
步骤4: 等待分析完成
```

### 3. 查看判断结果

```
步骤1: 点击"▼ 查看详情"展开
步骤2: 查看"评分细节（V3.1 舆情增强版）"
步骤3: 观察新闻舆情评分（X/20）
```

### 4. 解读新闻评分

| 分数范围 | 含义 | 交易信号 |
|---------|------|---------|
| 18-20分 | 重大正面新闻 | 强烈做多 |
| 12-17分 | 正面新闻 | 温和做多 |
| 8-11分 | 中性新闻 | 观望 |
| 0-7分 | 负面新闻 | 做空或回避 |

---

## 🔍 判断逻辑检查清单

### 后端日志检查

```bash
# 查看后端日志中的判断信息
tail -f logs/backend.log | grep -E "搜索引擎|新闻分析|DeepSeek分析"

# 预期输出（已配置）:
🤖 DeepSeek分析: AAPL.US (搜索引擎: ✅)
✅ 新闻分析器已集成
🔍 获取AAPL.US的新闻分析...
✅ 新闻分析完成: 5条新闻

# 预期输出（未配置）:
🤖 DeepSeek分析: AAPL.US (搜索引擎: ❌)
```

### 前端显示检查

**已配置Tavily的情况**:
- ✅ 评分细节显示6个维度
- ✅ 新闻舆情评分条为蓝色
- ✅ 新闻舆情显示具体分数（如 15/20）
- ✅ 无"未启用新闻分析"提示

**未配置Tavily的情况**:
- ✅ 评分细节显示6个维度
- ✅ 新闻舆情评分条为蓝色
- ✅ 新闻舆情显示 0/20
- ✅ 显示提示："🔍 未启用新闻分析 - 请在'设置'页面配置Tavily API Key"

---

## 🎉 总结

本次修复完成了以下工作：

1. ✅ 解决了DuckDB数据库锁问题
2. ✅ 修复了Tavily API Key无法保存的bug
3. ✅ 补全了前端新闻舆情评分的显示
4. ✅ 完善了AI选股判断逻辑的可视化
5. ✅ 提升了用户体验（彩色评分条、智能提示）

现在，用户可以清晰地看到：
- ✨ 新闻舆情是否启用
- ✨ 新闻舆情的具体评分
- ✨ 如何配置Tavily API Key
- ✨ 6个评分维度的详细信息

AI选股V3.1舆情增强版已经完全就绪！🚀






