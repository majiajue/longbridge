"""
最佳买卖点识别系统
结合多种技术指标和市场因素，识别最优的买卖时机
"""
import numpy as np
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from .strategy_engine import MarketData, KLineBuffer, TechnicalIndicators

logger = logging.getLogger(__name__)

class SignalStrength(Enum):
    """信号强度枚举"""
    VERY_WEAK = 0
    WEAK = 1
    NEUTRAL = 2
    STRONG = 3
    VERY_STRONG = 4

class TrendDirection(Enum):
    """趋势方向"""
    STRONG_BEARISH = -2
    BEARISH = -1
    SIDEWAYS = 0
    BULLISH = 1
    STRONG_BULLISH = 2

@dataclass
class TradingSignal:
    """交易信号数据结构"""
    symbol: str
    timestamp: datetime
    signal_type: str  # 'buy' or 'sell'
    strength: SignalStrength
    confidence: float  # 0.0 - 1.0
    price: float
    factors: Dict[str, float]  # 各因子的评分
    reason: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    position_size: Optional[float] = None

@dataclass
class MarketContext:
    """市场环境上下文"""
    trend_direction: TrendDirection
    volatility: float
    volume_trend: str
    support_level: float
    resistance_level: float
    momentum: float
    market_sentiment: float

class OptimalTradingSignals:
    """最佳买卖点识别器"""

    def __init__(self):
        self.indicators = TechnicalIndicators()
        self.signal_history: Dict[str, List[TradingSignal]] = {}

        # 各因子权重配置
        self.buy_weights = {
            'trend_alignment': 0.25,     # 趋势一致性
            'momentum': 0.20,            # 动量指标
            'mean_reversion': 0.15,      # 均值回归
            'volume_confirmation': 0.15, # 成交量确认
            'support_resistance': 0.15,  # 支撑阻力
            'market_sentiment': 0.10     # 市场情绪
        }

        self.sell_weights = {
            'profit_taking': 0.30,       # 获利了结
            'trend_reversal': 0.25,      # 趋势反转
            'momentum_divergence': 0.20, # 动量背离
            'resistance_rejection': 0.15, # 阻力位拒绝
            'risk_management': 0.10      # 风险管理
        }

    def analyze_optimal_entry(
        self,
        symbol: str,
        buffer: KLineBuffer,
        market_data: MarketData,
        strategy_config: Dict
    ) -> Optional[TradingSignal]:
        """分析最佳入场点"""
        try:
            if len(buffer.data) < 50:
                return None

            # 分析市场环境
            market_context = self._analyze_market_context(buffer, market_data)

            # 计算各个买入因子的得分
            factors = self._calculate_buy_factors(buffer, market_data, market_context)

            # 计算综合信号强度
            signal_strength, confidence = self._calculate_signal_strength(factors, self.buy_weights)

            # 判断是否为有效买入信号
            if confidence < 0.6:  # 置信度阈值
                return None

            # 计算止损止盈位置
            stop_loss, take_profit = self._calculate_dynamic_stops(
                market_data.close, market_context, 'buy', strategy_config
            )

            # 计算建议仓位大小
            position_size = self._calculate_position_size(
                confidence, market_context.volatility, strategy_config
            )

            # 生成买入信号
            signal = TradingSignal(
                symbol=symbol,
                timestamp=datetime.now(),
                signal_type='buy',
                strength=signal_strength,
                confidence=confidence,
                price=market_data.close,
                factors=factors,
                reason=self._generate_signal_reason(factors, 'buy'),
                stop_loss=stop_loss,
                take_profit=take_profit,
                position_size=position_size
            )

            # 记录信号历史
            if symbol not in self.signal_history:
                self.signal_history[symbol] = []
            self.signal_history[symbol].append(signal)

            logger.info(f"Generated buy signal for {symbol}: confidence={confidence:.2f}, reason={signal.reason}")
            return signal

        except Exception as e:
            logger.error(f"Error analyzing optimal entry for {symbol}: {e}")
            return None

    def analyze_optimal_exit(
        self,
        symbol: str,
        buffer: KLineBuffer,
        market_data: MarketData,
        entry_price: float,
        entry_time: datetime,
        strategy_config: Dict
    ) -> Optional[TradingSignal]:
        """分析最佳出场点"""
        try:
            if len(buffer.data) < 20:
                return None

            # 分析市场环境
            market_context = self._analyze_market_context(buffer, market_data)

            # 计算各个卖出因子的得分
            factors = self._calculate_sell_factors(
                buffer, market_data, market_context, entry_price, entry_time
            )

            # 计算综合信号强度
            signal_strength, confidence = self._calculate_signal_strength(factors, self.sell_weights)

            # 判断是否为有效卖出信号
            if confidence < 0.7:  # 卖出信号需要更高置信度
                return None

            # 生成卖出信号
            signal = TradingSignal(
                symbol=symbol,
                timestamp=datetime.now(),
                signal_type='sell',
                strength=signal_strength,
                confidence=confidence,
                price=market_data.close,
                factors=factors,
                reason=self._generate_signal_reason(factors, 'sell')
            )

            logger.info(f"Generated sell signal for {symbol}: confidence={confidence:.2f}, reason={signal.reason}")
            return signal

        except Exception as e:
            logger.error(f"Error analyzing optimal exit for {symbol}: {e}")
            return None

    def _analyze_market_context(self, buffer: KLineBuffer, market_data: MarketData) -> MarketContext:
        """分析市场环境上下文"""
        closes = buffer.get_closes(50)
        volumes = buffer.get_volumes(20)

        # 趋势方向分析
        trend_direction = self._analyze_trend_direction(closes)

        # 波动率计算
        volatility = self._calculate_volatility(closes)

        # 成交量趋势
        volume_trend = self._analyze_volume_trend(volumes)

        # 支撑阻力位
        support_level, resistance_level = self._find_support_resistance(buffer)

        # 动量分析
        momentum = self._calculate_momentum(closes)

        # 市场情绪（简化版）
        market_sentiment = self._calculate_market_sentiment(buffer, market_data)

        return MarketContext(
            trend_direction=trend_direction,
            volatility=volatility,
            volume_trend=volume_trend,
            support_level=support_level,
            resistance_level=resistance_level,
            momentum=momentum,
            market_sentiment=market_sentiment
        )

    def _calculate_buy_factors(
        self,
        buffer: KLineBuffer,
        market_data: MarketData,
        context: MarketContext
    ) -> Dict[str, float]:
        """计算买入相关因子得分"""
        closes = buffer.get_closes(50)
        current_price = market_data.close

        factors = {}

        # 1. 趋势一致性 (0-100)
        trend_score = 0
        if context.trend_direction in [TrendDirection.BULLISH, TrendDirection.STRONG_BULLISH]:
            trend_score = 80 + (context.momentum * 20)
        elif context.trend_direction == TrendDirection.SIDEWAYS:
            trend_score = 40
        else:
            trend_score = 20
        factors['trend_alignment'] = min(100, max(0, trend_score))

        # 2. 动量指标综合
        rsi = self.indicators.rsi(closes, 14)
        macd_line, signal_line, histogram = self.indicators.macd(closes)

        momentum_score = 0
        if 30 <= rsi <= 50:  # RSI在健康买入区间
            momentum_score += 30
        if macd_line and signal_line and macd_line > signal_line:  # MACD金叉
            momentum_score += 40
        if context.momentum > 0:  # 正向动量
            momentum_score += 30
        factors['momentum'] = min(100, momentum_score)

        # 3. 均值回归机会
        price_position = self._calculate_price_position(closes, current_price)
        if price_position < 30:  # 价格在低位，有回归机会
            factors['mean_reversion'] = 70 + (30 - price_position)
        else:
            factors['mean_reversion'] = max(0, 50 - price_position)

        # 4. 成交量确认
        volume_score = 50
        if context.volume_trend == 'increasing':
            volume_score = 80
        elif context.volume_trend == 'high':
            volume_score = 90
        factors['volume_confirmation'] = volume_score

        # 5. 支撑阻力位置
        distance_from_support = abs(current_price - context.support_level) / current_price
        if distance_from_support < 0.02:  # 接近支撑位
            factors['support_resistance'] = 90
        elif distance_from_support < 0.05:
            factors['support_resistance'] = 70
        else:
            factors['support_resistance'] = 40

        # 6. 市场情绪
        factors['market_sentiment'] = max(0, min(100, context.market_sentiment * 100))

        return factors

    def _calculate_sell_factors(
        self,
        buffer: KLineBuffer,
        market_data: MarketData,
        context: MarketContext,
        entry_price: float,
        entry_time: datetime
    ) -> Dict[str, float]:
        """计算卖出相关因子得分"""
        closes = buffer.get_closes(50)
        current_price = market_data.close

        factors = {}

        # 1. 获利了结评估
        profit_pct = (current_price - entry_price) / entry_price
        holding_days = (datetime.now() - entry_time).days

        profit_score = 0
        if profit_pct > 0.15:  # 超过15%收益
            profit_score = 80 + min(20, profit_pct * 100)
        elif profit_pct > 0.08:  # 8-15%收益
            profit_score = 60
        elif profit_pct > 0.03:  # 3-8%收益
            profit_score = 40
        elif profit_pct < -0.05:  # 超过5%亏损
            profit_score = 70  # 止损信号

        # 持有时间调整
        if holding_days > 10:
            profit_score += 20

        factors['profit_taking'] = min(100, profit_score)

        # 2. 趋势反转信号
        reversal_score = 0
        if context.trend_direction in [TrendDirection.BEARISH, TrendDirection.STRONG_BEARISH]:
            reversal_score = 80
        elif context.momentum < -0.3:  # 强烈负动量
            reversal_score = 60
        factors['trend_reversal'] = reversal_score

        # 3. 动量背离
        rsi = self.indicators.rsi(closes, 14)
        divergence_score = 0
        if rsi > 70:  # 超买
            divergence_score = 70
        elif rsi > 60 and context.momentum < 0:  # RSI高位但动量转负
            divergence_score = 80
        factors['momentum_divergence'] = divergence_score

        # 4. 阻力位拒绝
        distance_from_resistance = abs(current_price - context.resistance_level) / current_price
        if distance_from_resistance < 0.01:  # 非常接近阻力位
            factors['resistance_rejection'] = 90
        elif distance_from_resistance < 0.03:
            factors['resistance_rejection'] = 70
        else:
            factors['resistance_rejection'] = 30

        # 5. 风险管理
        risk_score = 0
        if profit_pct < -0.03:  # 亏损超过3%
            risk_score = 60
        if profit_pct < -0.05:  # 亏损超过5%
            risk_score = 90
        if context.volatility > 0.3:  # 高波动环境
            risk_score += 30
        factors['risk_management'] = min(100, risk_score)

        return factors

    def _calculate_signal_strength(
        self,
        factors: Dict[str, float],
        weights: Dict[str, float]
    ) -> Tuple[SignalStrength, float]:
        """计算信号强度和置信度"""
        # 加权平均计算综合得分
        total_score = 0
        total_weight = 0

        for factor, score in factors.items():
            if factor in weights:
                total_score += score * weights[factor]
                total_weight += weights[factor]

        if total_weight == 0:
            return SignalStrength.NEUTRAL, 0.0

        confidence = total_score / total_weight / 100  # 转换为0-1的置信度

        # 根据得分确定信号强度
        if confidence >= 0.85:
            strength = SignalStrength.VERY_STRONG
        elif confidence >= 0.70:
            strength = SignalStrength.STRONG
        elif confidence >= 0.50:
            strength = SignalStrength.NEUTRAL
        elif confidence >= 0.30:
            strength = SignalStrength.WEAK
        else:
            strength = SignalStrength.VERY_WEAK

        return strength, confidence

    def _analyze_trend_direction(self, closes: np.ndarray) -> TrendDirection:
        """分析趋势方向"""
        if len(closes) < 20:
            return TrendDirection.SIDEWAYS

        # 使用多重移动平均线判断趋势
        ma5 = self.indicators.sma(closes, 5)
        ma10 = self.indicators.sma(closes, 10)
        ma20 = self.indicators.sma(closes, 20)

        current_price = closes[-1]

        if current_price > ma5 > ma10 > ma20:
            return TrendDirection.STRONG_BULLISH
        elif current_price > ma5 and ma5 > ma10:
            return TrendDirection.BULLISH
        elif current_price < ma5 < ma10 < ma20:
            return TrendDirection.STRONG_BEARISH
        elif current_price < ma5 and ma5 < ma10:
            return TrendDirection.BEARISH
        else:
            return TrendDirection.SIDEWAYS

    def _calculate_volatility(self, closes: np.ndarray) -> float:
        """计算波动率"""
        if len(closes) < 20:
            return 0.0

        returns = np.diff(np.log(closes))
        return np.std(returns) * np.sqrt(252)  # 年化波动率

    def _analyze_volume_trend(self, volumes: np.ndarray) -> str:
        """分析成交量趋势"""
        if len(volumes) < 10:
            return 'normal'

        recent_avg = np.mean(volumes[-5:])
        historical_avg = np.mean(volumes[:-5])

        ratio = recent_avg / historical_avg

        if ratio > 1.5:
            return 'high'
        elif ratio > 1.2:
            return 'increasing'
        elif ratio < 0.8:
            return 'decreasing'
        else:
            return 'normal'

    def _find_support_resistance(self, buffer: KLineBuffer) -> Tuple[float, float]:
        """寻找支撑和阻力位"""
        if len(buffer.data) < 20:
            return 0.0, 0.0

        closes = buffer.get_closes(20)
        highs = np.array([d.high for d in buffer.data[-20:]])
        lows = np.array([d.low for d in buffer.data[-20:]])

        # 简化的支撑阻力位计算
        support_level = np.percentile(lows, 25)  # 下四分位数作为支撑
        resistance_level = np.percentile(highs, 75)  # 上四分位数作为阻力

        return support_level, resistance_level

    def _calculate_momentum(self, closes: np.ndarray) -> float:
        """计算价格动量"""
        if len(closes) < 10:
            return 0.0

        # 使用ROC (Rate of Change) 计算动量
        roc = (closes[-1] - closes[-10]) / closes[-10]
        return roc

    def _calculate_market_sentiment(self, buffer: KLineBuffer, market_data: MarketData) -> float:
        """计算市场情绪指标（简化版）"""
        if len(buffer.data) < 10:
            return 0.5

        # 使用最近K线的涨跌比例作为情绪指标
        recent_data = buffer.data[-10:]
        bullish_candles = sum(1 for d in recent_data if d.close > d.open)
        sentiment = bullish_candles / len(recent_data)

        return sentiment

    def _calculate_price_position(self, closes: np.ndarray, current_price: float) -> float:
        """计算价格在历史区间的位置百分比"""
        if len(closes) < 20:
            return 50.0

        min_price = np.min(closes)
        max_price = np.max(closes)

        if max_price == min_price:
            return 50.0

        position = (current_price - min_price) / (max_price - min_price) * 100
        return position

    def _calculate_dynamic_stops(
        self,
        entry_price: float,
        context: MarketContext,
        signal_type: str,
        strategy_config: Dict
    ) -> Tuple[float, float]:
        """动态计算止损止盈位置"""
        base_stop_loss = strategy_config.get('risk_management', {}).get('stop_loss', 0.05)
        base_take_profit = strategy_config.get('risk_management', {}).get('take_profit', 0.15)

        # 根据波动率调整止损止盈
        volatility_multiplier = max(0.5, min(2.0, context.volatility / 0.2))

        if signal_type == 'buy':
            stop_loss = entry_price * (1 - base_stop_loss * volatility_multiplier)
            take_profit = entry_price * (1 + base_take_profit * volatility_multiplier)
        else:  # sell
            stop_loss = entry_price * (1 + base_stop_loss * volatility_multiplier)
            take_profit = entry_price * (1 - base_take_profit * volatility_multiplier)

        return stop_loss, take_profit

    def _calculate_position_size(
        self,
        confidence: float,
        volatility: float,
        strategy_config: Dict
    ) -> float:
        """根据信号质量动态调整仓位大小"""
        base_position = strategy_config.get('risk_management', {}).get('position_size', 0.1)

        # 根据置信度调整
        confidence_multiplier = confidence

        # 根据波动率调整（波动率高则减仓）
        volatility_adjustment = max(0.3, 1.0 - volatility)

        dynamic_position = base_position * confidence_multiplier * volatility_adjustment

        # 限制在合理范围内
        return max(0.01, min(0.3, dynamic_position))

    def _generate_signal_reason(self, factors: Dict[str, float], signal_type: str) -> str:
        """生成信号原因说明"""
        # 找出最强的几个因子
        sorted_factors = sorted(factors.items(), key=lambda x: x[1], reverse=True)
        top_factors = sorted_factors[:3]

        if signal_type == 'buy':
            factor_names = {
                'trend_alignment': '趋势向上',
                'momentum': '动量指标积极',
                'mean_reversion': '均值回归机会',
                'volume_confirmation': '成交量放大',
                'support_resistance': '接近支撑位',
                'market_sentiment': '市场情绪乐观'
            }
        else:
            factor_names = {
                'profit_taking': '获利了结时机',
                'trend_reversal': '趋势反转信号',
                'momentum_divergence': '动量背离',
                'resistance_rejection': '阻力位压制',
                'risk_management': '风险控制需要'
            }

        reasons = [factor_names.get(factor, factor) for factor, _ in top_factors if factor in factor_names]

        return f"{signal_type.upper()}信号: " + "、".join(reasons[:2])

# 全局实例
_optimal_signals = None

def get_optimal_signals() -> OptimalTradingSignals:
    """获取最佳交易信号分析器实例"""
    global _optimal_signals
    if _optimal_signals is None:
        _optimal_signals = OptimalTradingSignals()
    return _optimal_signals