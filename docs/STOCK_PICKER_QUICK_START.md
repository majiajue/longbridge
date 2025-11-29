# 智能选股系统 - 快速实施指南

## 🎯 核心功能概览

**一句话描述**：用户提供40只股票（做多20 + 做空20），系统自动分析并按推荐度排序。

## 📊 核心算法

### 推荐度计算公式

```python
# 做多池推荐度（0-100分）
recommendation_long = (
    量化评分 * 0.5 +              # 50%权重
    AI信心度 * 50 * 0.3 +          # 30%权重  
    信号强度 * 20 * 0.2            # 20%权重
)

# 做空池推荐度（0-100分）
# 注意：评分越低越适合做空
recommendation_short = (
    (100 - 量化评分) * 0.5 +
    AI信心度 * 50 * 0.3 +
    信号强度 * 20 * 0.2
)
```

### 信号强度计算

```python
def calculate_signal_strength(signals: List[str]) -> float:
    """
    计算信号强度（0-20分）
    
    信号分类：
    - 强信号（每个5分）: 多头排列、MACD强势金叉、红三兵、锤子线
    - 中信号（每个3分）: MACD金叉、适度放量、RSI健康
    - 弱信号（每个1分）: 成交量正常、价格在MA20上方
    """
    
    strong_signals = [
        "多头排列", "MACD强势金叉", "红三兵", "锤子线形态"
    ]
    medium_signals = [
        "MACD金叉", "适度放量", "RSI健康", "接近布林下轨"
    ]
    
    score = 0
    for signal in signals:
        if any(s in signal for s in strong_signals):
            score += 5
        elif any(s in signal for s in medium_signals):
            score += 3
        else:
            score += 1
    
    return min(20, score)  # 最高20分
```

## 🗄️ 数据库初始化

```sql
-- 1. 股票池表
CREATE TABLE IF NOT EXISTS stock_picker_pools (
    id INTEGER PRIMARY KEY,
    pool_type TEXT NOT NULL,          -- 'LONG' 或 'SHORT'
    symbol TEXT NOT NULL,
    name TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    UNIQUE(pool_type, symbol)
);

CREATE INDEX idx_pool_type ON stock_picker_pools(pool_type);
CREATE INDEX idx_is_active ON stock_picker_pools(is_active);

-- 2. 分析结果表
CREATE TABLE IF NOT EXISTS stock_picker_analysis (
    id INTEGER PRIMARY KEY,
    pool_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    analysis_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 价格
    current_price REAL,
    price_change_1d REAL,
    price_change_5d REAL,
    
    -- 评分
    score_total REAL,
    score_grade TEXT,
    score_trend REAL,
    score_momentum REAL,
    score_volume REAL,
    score_volatility REAL,
    score_pattern REAL,
    
    -- AI决策
    ai_action TEXT,
    ai_confidence REAL,
    ai_reasoning TEXT,
    
    -- 其他
    indicators TEXT,
    signals TEXT,
    recommendation_score REAL,
    recommendation_reason TEXT,
    klines_snapshot TEXT,
    
    FOREIGN KEY (pool_id) REFERENCES stock_picker_pools(id)
);

CREATE INDEX idx_analysis_pool ON stock_picker_analysis(pool_id);
CREATE INDEX idx_analysis_time ON stock_picker_analysis(analysis_time);
CREATE INDEX idx_recommendation ON stock_picker_analysis(recommendation_score DESC);

-- 3. 配置表
CREATE TABLE IF NOT EXISTS stock_picker_config (
    id INTEGER PRIMARY KEY,
    auto_refresh_enabled BOOLEAN DEFAULT FALSE,
    auto_refresh_interval INTEGER DEFAULT 300,
    max_pool_size INTEGER DEFAULT 20,
    cache_duration INTEGER DEFAULT 300,
    min_score_to_recommend INTEGER DEFAULT 65,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT INTO stock_picker_config (id) VALUES (1);
```

## 🔌 API 快速参考

### 1. 添加股票
```bash
curl -X POST http://localhost:8000/api/stock-picker/pools \
  -H "Content-Type: application/json" \
  -d '{
    "pool_type": "LONG",
    "symbol": "AAPL.US",
    "name": "Apple Inc.",
    "added_reason": "科技龙头"
  }'
```

### 2. 批量添加
```bash
curl -X POST http://localhost:8000/api/stock-picker/pools/batch \
  -H "Content-Type: application/json" \
  -d '{
    "pool_type": "LONG",
    "symbols": [
      {"symbol": "AAPL.US", "name": "Apple"},
      {"symbol": "MSFT.US", "name": "Microsoft"},
      {"symbol": "NVDA.US", "name": "NVIDIA"}
    ]
  }'
```

### 3. 触发分析
```bash
curl -X POST http://localhost:8000/api/stock-picker/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "pool_type": "LONG",
    "force_refresh": true
  }'
```

### 4. 获取分析结果
```bash
curl http://localhost:8000/api/stock-picker/analysis?pool_type=LONG&sort_by=recommendation
```

## 📋 实施检查清单

### 第一阶段：基础功能（2-3天）

**后端**：
- [ ] 创建数据库表
- [ ] 实现 `StockPickerService` 类
- [ ] 实现股票池管理API（增删查改）
- [ ] 实现批量分析API
- [ ] 集成现有的 `DeepSeekAnalyzer`
- [ ] 实现推荐度计算算法

**前端**：
- [ ] 创建 `StockPicker.tsx` 页面
- [ ] 实现股票池展示组件
- [ ] 实现添加股票对话框
- [ ] 实现分析结果展示
- [ ] 集成API调用

### 第二阶段：优化体验（1-2天）

- [ ] 批量导入功能
- [ ] 分析进度显示
- [ ] 结果缓存机制
- [ ] K线预览（复用现有组件）
- [ ] 详情弹窗

### 第三阶段：高级功能（可选）

- [ ] 自动刷新
- [ ] WebSocket 实时推送
- [ ] 历史记录
- [ ] 统计报表

## 💻 核心代码结构

### 后端 - stock_picker.py

```python
# backend/app/stock_picker.py

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import asyncio
import logging
from .ai_analyzer import DeepSeekAnalyzer
from .db import get_connection
from .services import get_cached_candlesticks

logger = logging.getLogger(__name__)


class StockPickerService:
    """智能选股服务"""
    
    def __init__(self):
        self.cache = {}  # 简单缓存，生产环境建议用 Redis
        self.cache_duration = 300  # 5分钟
    
    # ========== 股票池管理 ==========
    
    def add_stock(self, pool_type: str, symbol: str, **kwargs) -> int:
        """添加股票到池"""
        with get_connection() as conn:
            result = conn.execute("""
                INSERT INTO stock_picker_pools 
                (pool_type, symbol, name, added_reason, priority)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (pool_type, symbol) DO UPDATE SET
                is_active = TRUE
                RETURNING id
            """, (
                pool_type,
                symbol,
                kwargs.get('name'),
                kwargs.get('added_reason'),
                kwargs.get('priority', 0)
            ))
            return result.fetchone()['id']
    
    def batch_add_stocks(self, pool_type: str, symbols: List[Dict]) -> List[int]:
        """批量添加"""
        ids = []
        for sym_info in symbols:
            try:
                stock_id = self.add_stock(pool_type, **sym_info)
                ids.append(stock_id)
            except Exception as e:
                logger.error(f"添加股票失败 {sym_info.get('symbol')}: {e}")
        return ids
    
    def remove_stock(self, pool_id: int):
        """移除股票"""
        with get_connection() as conn:
            conn.execute("DELETE FROM stock_picker_pools WHERE id = ?", (pool_id,))
    
    def toggle_active(self, pool_id: int):
        """切换激活状态"""
        with get_connection() as conn:
            conn.execute("""
                UPDATE stock_picker_pools 
                SET is_active = NOT is_active 
                WHERE id = ?
            """, (pool_id,))
    
    def get_pools(self, pool_type: Optional[str] = None) -> Dict:
        """获取股票池"""
        with get_connection() as conn:
            if pool_type:
                query = "SELECT * FROM stock_picker_pools WHERE pool_type = ? AND is_active = TRUE"
                results = conn.execute(query, (pool_type,)).fetchall()
            else:
                results = conn.execute(
                    "SELECT * FROM stock_picker_pools WHERE is_active = TRUE"
                ).fetchall()
            
            pools = {'long_pool': [], 'short_pool': []}
            for row in results:
                pool = dict(row)
                if pool['pool_type'] == 'LONG':
                    pools['long_pool'].append(pool)
                else:
                    pools['short_pool'].append(pool)
            
            return pools
    
    # ========== 分析功能 ==========
    
    async def analyze_pool(
        self, 
        pool_type: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict:
        """批量分析股票池"""
        
        pools = self.get_pools(pool_type)
        all_stocks = []
        
        if not pool_type or pool_type == 'LONG':
            all_stocks.extend([(s, 'LONG') for s in pools['long_pool']])
        if not pool_type or pool_type == 'SHORT':
            all_stocks.extend([(s, 'SHORT') for s in pools['short_pool']])
        
        logger.info(f"开始分析 {len(all_stocks)} 只股票...")
        
        # 并发分析（限制并发数）
        tasks = []
        for stock, ptype in all_stocks:
            task = self._analyze_single_stock(
                stock['id'], 
                stock['symbol'], 
                ptype,
                force_refresh
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if not isinstance(r, Exception))
        
        return {
            'total': len(all_stocks),
            'success': success_count,
            'failed': len(all_stocks) - success_count
        }
    
    async def _analyze_single_stock(
        self,
        pool_id: int,
        symbol: str,
        pool_type: str,
        force_refresh: bool = False
    ) -> Dict:
        """分析单只股票"""
        
        # 1. 检查缓存
        cache_key = f"{symbol}_{pool_type}"
        if not force_refresh and cache_key in self.cache:
            cached = self.cache[cache_key]
            if datetime.now() - cached['time'] < timedelta(seconds=self.cache_duration):
                logger.info(f"使用缓存: {symbol}")
                return cached['data']
        
        try:
            # 2. 获取K线数据
            klines = get_cached_candlesticks(symbol, limit=100)
            if not klines or len(klines) < 20:
                raise ValueError(f"K线数据不足: {len(klines) if klines else 0}")
            
            # 3. 使用AI分析器
            from .ai_analyzer import DeepSeekAnalyzer
            # 注意：这里需要API key，可以从配置读取
            from .repositories import load_ai_credentials
            ai_creds = load_ai_credentials()
            api_key = ai_creds.get('DEEPSEEK_API_KEY', '')
            
            if api_key:
                analyzer = DeepSeekAnalyzer(api_key=api_key)
                analysis = analyzer.analyze_trading_opportunity(
                    symbol=symbol,
                    klines=klines,
                    scenario="buy_focus" if pool_type == 'LONG' else "sell_focus"
                )
            else:
                # 如果没有API key，只做量化评分
                from .ai_analyzer import DeepSeekAnalyzer
                temp_analyzer = DeepSeekAnalyzer.__new__(DeepSeekAnalyzer)
                indicators = temp_analyzer._calculate_indicators(klines)
                score = temp_analyzer._calculate_score(klines, indicators, "buy_focus")
                
                analysis = {
                    'action': 'HOLD',
                    'confidence': 0.5,
                    'reasoning': ['仅量化评分，未调用AI'],
                    'score': score,
                    'indicators': indicators
                }
            
            # 4. 计算推荐度
            recommendation_score = self.calculate_recommendation_score(
                analysis, pool_type
            )
            
            recommendation_reason = self._generate_recommendation_reason(
                analysis, pool_type, recommendation_score
            )
            
            # 5. 保存结果
            result = self._save_analysis_result(
                pool_id=pool_id,
                symbol=symbol,
                pool_type=pool_type,
                klines=klines,
                analysis=analysis,
                recommendation_score=recommendation_score,
                recommendation_reason=recommendation_reason
            )
            
            # 6. 更新缓存
            self.cache[cache_key] = {
                'time': datetime.now(),
                'data': result
            }
            
            logger.info(f"✅ 分析完成: {symbol} (推荐度: {recommendation_score:.1f})")
            return result
            
        except Exception as e:
            logger.error(f"❌ 分析失败: {symbol} - {e}")
            raise
    
    def calculate_recommendation_score(
        self, 
        analysis: Dict, 
        pool_type: str
    ) -> float:
        """
        计算推荐度（0-100）
        
        公式：
        - 做多: 评分*0.5 + 信心度*50*0.3 + 信号强度*0.2
        - 做空: (100-评分)*0.5 + 信心度*50*0.3 + 信号强度*0.2
        """
        
        score_total = analysis.get('score', {}).get('total', 50)
        confidence = analysis.get('confidence', 0.5)
        signals = analysis.get('score', {}).get('signals', [])
        
        # 计算信号强度（0-20）
        signal_strength = self._calculate_signal_strength(signals)
        
        if pool_type == 'LONG':
            # 做多：高分好
            recommendation = (
                score_total * 0.5 +
                confidence * 50 * 0.3 +
                signal_strength * 0.2
            )
        else:  # SHORT
            # 做空：低分好
            recommendation = (
                (100 - score_total) * 0.5 +
                confidence * 50 * 0.3 +
                signal_strength * 0.2
            )
        
        return min(100, max(0, recommendation))
    
    def _calculate_signal_strength(self, signals: List[str]) -> float:
        """计算信号强度（0-20）"""
        
        strong_patterns = [
            "多头排列", "MACD强势金叉", "红三兵", "锤子线形态",
            "空头排列", "MACD死叉", "黑三兵", "吊颈线形态"
        ]
        medium_patterns = [
            "MACD金叉", "适度放量", "明显放量", "RSI健康",
            "接近布林下轨", "RSI超卖"
        ]
        
        score = 0
        for signal in signals:
            if any(p in signal for p in strong_patterns):
                score += 5
            elif any(p in signal for p in medium_patterns):
                score += 3
            else:
                score += 1
        
        return min(20, score)
    
    def _generate_recommendation_reason(
        self,
        analysis: Dict,
        pool_type: str,
        recommendation_score: float
    ) -> str:
        """生成推荐理由"""
        
        grade = analysis.get('score', {}).get('grade', 'C')
        confidence = analysis.get('confidence', 0.5)
        action = analysis.get('action', 'HOLD')
        
        if pool_type == 'LONG':
            if recommendation_score >= 80:
                return f"强烈推荐买入：{grade}级评分 + 信心度{confidence:.0%} + AI建议{action}"
            elif recommendation_score >= 65:
                return f"推荐买入：{grade}级评分 + 信心度{confidence:.0%}"
            else:
                return f"谨慎观望：评分较低或信号不足"
        else:  # SHORT
            if recommendation_score >= 80:
                return f"强烈推荐做空：弱势形态 + 信心度{confidence:.0%}"
            elif recommendation_score >= 65:
                return f"推荐做空：技术面偏弱"
            else:
                return f"谨慎观望：做空信号不足"
    
    def _save_analysis_result(self, **kwargs) -> Dict:
        """保存分析结果"""
        
        analysis = kwargs['analysis']
        score = analysis.get('score', {})
        breakdown = score.get('breakdown', {})
        
        with get_connection() as conn:
            conn.execute("""
                INSERT INTO stock_picker_analysis (
                    pool_id, symbol, pool_type,
                    current_price, price_change_1d, price_change_5d,
                    score_total, score_grade,
                    score_trend, score_momentum, score_volume, 
                    score_volatility, score_pattern,
                    ai_action, ai_confidence, ai_reasoning,
                    signals, recommendation_score, recommendation_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                kwargs['pool_id'],
                kwargs['symbol'],
                kwargs['pool_type'],
                analysis.get('indicators', {}).get('current_price', 0),
                analysis.get('indicators', {}).get('price_change_1d', 0),
                analysis.get('indicators', {}).get('price_change_5d', 0),
                score.get('total', 0),
                score.get('grade', 'C'),
                breakdown.get('trend', 0),
                breakdown.get('momentum', 0),
                breakdown.get('volume', 0),
                breakdown.get('volatility', 0),
                breakdown.get('pattern', 0),
                analysis.get('action', 'HOLD'),
                analysis.get('confidence', 0),
                json.dumps(analysis.get('reasoning', []), ensure_ascii=False),
                json.dumps(score.get('signals', []), ensure_ascii=False),
                kwargs['recommendation_score'],
                kwargs['recommendation_reason']
            ))
        
        return {
            'symbol': kwargs['symbol'],
            'recommendation_score': kwargs['recommendation_score'],
            'score': score,
            'analysis': analysis
        }
    
    def get_analysis_results(
        self,
        pool_type: Optional[str] = None,
        sort_by: str = 'recommendation',
        limit: int = 20
    ) -> Dict:
        """获取分析结果（排序）"""
        
        with get_connection() as conn:
            # 获取最新的分析结果
            query = """
                SELECT 
                    a.*,
                    p.name,
                    p.added_reason
                FROM stock_picker_analysis a
                JOIN stock_picker_pools p ON a.pool_id = p.id
                WHERE p.is_active = TRUE
            """
            
            params = []
            if pool_type:
                query += " AND a.pool_type = ?"
                params.append(pool_type)
            
            # 只取每只股票最新的分析
            query += """
                AND a.id IN (
                    SELECT MAX(id) 
                    FROM stock_picker_analysis 
                    GROUP BY symbol, pool_type
                )
            """
            
            # 排序
            if sort_by == 'recommendation':
                query += " ORDER BY a.recommendation_score DESC"
            elif sort_by == 'score':
                query += " ORDER BY a.score_total DESC"
            elif sort_by == 'confidence':
                query += " ORDER BY a.ai_confidence DESC"
            
            query += f" LIMIT {limit}"
            
            results = conn.execute(query, params).fetchall()
            
            # 分组
            long_results = []
            short_results = []
            
            for row in results:
                data = dict(row)
                # 解析JSON字段
                data['ai_reasoning'] = json.loads(data['ai_reasoning'])
                data['signals'] = json.loads(data['signals'])
                
                if data['pool_type'] == 'LONG':
                    long_results.append(data)
                else:
                    short_results.append(data)
            
            return {
                'long_analysis': long_results,
                'short_analysis': short_results
            }


# 全局实例
_stock_picker_service = None

def get_stock_picker_service() -> StockPickerService:
    """获取选股服务单例"""
    global _stock_picker_service
    if _stock_picker_service is None:
        _stock_picker_service = StockPickerService()
    return _stock_picker_service
```

### 前端 - StockPicker.tsx

```typescript
// frontend/src/pages/StockPicker.tsx

import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, Progress } from '@/components/ui';

interface Stock {
  id: number;
  symbol: string;
  name: string;
  pool_type: string;
}

interface Analysis {
  symbol: string;
  current_price: number;
  price_change_1d: number;
  score_total: number;
  score_grade: string;
  ai_action: string;
  ai_confidence: number;
  ai_reasoning: string[];
  signals: string[];
  recommendation_score: number;
  recommendation_reason: string;
}

export default function StockPicker() {
  const [longPool, setLongPool] = useState<Stock[]>([]);
  const [shortPool, setShortPool] = useState<Stock[]>([]);
  const [longAnalysis, setLongAnalysis] = useState<Analysis[]>([]);
  const [shortAnalysis, setShortAnalysis] = useState<Analysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // 加载股票池
  const loadPools = async () => {
    const res = await fetch('/api/stock-picker/pools');
    const data = await res.json();
    setLongPool(data.long_pool);
    setShortPool(data.short_pool);
  };

  // 加载分析结果
  const loadAnalysis = async () => {
    const res = await fetch('/api/stock-picker/analysis');
    const data = await res.json();
    setLongAnalysis(data.long_analysis);
    setShortAnalysis(data.short_analysis);
  };

  // 触发分析
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch('/api/stock-picker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_refresh: true })
      });
      // 等待5秒后刷新结果
      setTimeout(loadAnalysis, 5000);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadPools();
    loadAnalysis();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📊 智能选股分析</h1>
        <div>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? '分析中...' : '🔄 分析全部'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 做多池 */}
        <StockPool
          title="做多股票池"
          type="LONG"
          stocks={longPool}
          analysis={longAnalysis}
          onRefresh={loadPools}
        />

        {/* 做空池 */}
        <StockPool
          title="做空股票池"
          type="SHORT"
          stocks={shortPool}
          analysis={shortAnalysis}
          onRefresh={loadPools}
        />
      </div>
    </div>
  );
}
```

---

**文档版本**: v1.0  
**创建日期**: 2025-10-24  
**预计工期**: 1-2周











