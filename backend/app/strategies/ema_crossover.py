"""
EMA 交叉策略 (Exponential Moving Average Crossover Strategy)
基于快慢线交叉产生买卖信号
"""
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class EMACrossoverStrategy:
    """
    EMA 指数移动平均线交叉策略
    
    核心逻辑：
    1. 快线（短期 EMA）上穿慢线（长期 EMA）→ 买入信号
    2. 快线下穿慢线 → 卖出信号
    3. 结合成交量和动量确认
    """
    
    def __init__(
        self,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
        volume_confirmation: bool = True,
        min_crossover_gap: float = 0.001,  # 最小交叉间距（避免假信号）
    ):
        """
        初始化策略参数
        
        Args:
            fast_period: 快线周期
            slow_period: 慢线周期
            signal_period: 信号线周期（MACD 用）
            volume_confirmation: 是否需要成交量确认
            min_crossover_gap: 最小交叉间距
        """
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period
        self.volume_confirmation = volume_confirmation
        self.min_crossover_gap = min_crossover_gap
        self.name = "EMA 交叉策略"
        self.description = f"EMA{fast_period}/{slow_period} 交叉，适合趋势跟踪"
    
    def calculate_ema(self, prices: List[float], period: int) -> List[float]:
        """
        计算指数移动平均线 (EMA)
        
        EMA = Price(t) * k + EMA(t-1) * (1 - k)
        k = 2 / (period + 1)
        
        Args:
            prices: 价格序列
            period: EMA 周期
            
        Returns:
            EMA 序列
        """
        if len(prices) < period:
            return []
        
        k = 2 / (period + 1)
        ema_values = []
        
        # 第一个 EMA 值使用 SMA
        sma = sum(prices[:period]) / period
        ema_values.append(sma)
        
        # 后续使用 EMA 公式
        for i in range(period, len(prices)):
            ema = prices[i] * k + ema_values[-1] * (1 - k)
            ema_values.append(ema)
        
        return ema_values
    
    def calculate_macd(
        self,
        prices: List[float]
    ) -> Dict[str, List[float]]:
        """
        计算 MACD 指标
        
        MACD Line = EMA(12) - EMA(26)
        Signal Line = EMA(9) of MACD Line
        Histogram = MACD Line - Signal Line
        
        Args:
            prices: 价格序列
            
        Returns:
            包含 macd_line, signal_line, histogram 的字典
        """
        fast_ema = self.calculate_ema(prices, self.fast_period)
        slow_ema = self.calculate_ema(prices, self.slow_period)
        
        if not fast_ema or not slow_ema:
            return {"macd_line": [], "signal_line": [], "histogram": []}
        
        # 对齐长度（slow_ema 更短）
        offset = len(prices) - len(slow_ema)
        fast_ema_aligned = fast_ema[offset:]
        
        # MACD Line
        macd_line = [fast - slow for fast, slow in zip(fast_ema_aligned, slow_ema)]
        
        # Signal Line (MACD 的 EMA)
        signal_line = self.calculate_ema(macd_line, self.signal_period)
        
        # Histogram
        histogram_offset = len(macd_line) - len(signal_line)
        macd_line_aligned = macd_line[histogram_offset:]
        histogram = [macd - signal for macd, signal in zip(macd_line_aligned, signal_line)]
        
        return {
            "macd_line": macd_line,
            "signal_line": signal_line,
            "histogram": histogram
        }
    
    def detect_crossover(
        self,
        fast_values: List[float],
        slow_values: List[float],
        index: int
    ) -> Optional[str]:
        """
        检测交叉
        
        Args:
            fast_values: 快线值
            slow_values: 慢线值
            index: 当前位置
            
        Returns:
            "golden" (金叉), "death" (死叉), 或 None
        """
        if index < 1:
            return None
        
        # 当前状态
        current_fast = fast_values[index]
        current_slow = slow_values[index]
        
        # 前一状态
        prev_fast = fast_values[index - 1]
        prev_slow = slow_values[index - 1]
        
        # 计算交叉间距
        gap = abs(current_fast - current_slow) / current_slow
        
        # 金叉：快线从下向上穿过慢线
        if prev_fast <= prev_slow and current_fast > current_slow:
            if gap >= self.min_crossover_gap:
                return "golden"
        
        # 死叉：快线从上向下穿过慢线
        if prev_fast >= prev_slow and current_fast < current_slow:
            if gap >= self.min_crossover_gap:
                return "death"
        
        return None
    
    def check_volume_confirmation(
        self,
        volumes: List[float],
        index: int,
        signal_type: str
    ) -> bool:
        """
        成交量确认
        
        Args:
            volumes: 成交量序列
            index: 当前位置
            signal_type: "buy" 或 "sell"
            
        Returns:
            是否通过成交量确认
        """
        if not self.volume_confirmation or not volumes or index < 10:
            return True
        
        current_volume = volumes[index]
        avg_volume = sum(volumes[max(0, index - 10):index]) / min(10, index)
        
        if avg_volume == 0:
            return True
        
        volume_ratio = current_volume / avg_volume
        
        # 买入时希望成交量放大
        if signal_type == "buy":
            return volume_ratio > 1.0
        
        # 卖出时也希望成交量配合
        if signal_type == "sell":
            return volume_ratio > 0.8
        
        return True
    
    def calculate_momentum(self, prices: List[float], period: int = 5) -> float:
        """
        计算动量指标
        
        Args:
            prices: 价格序列
            period: 计算周期
            
        Returns:
            动量值 (百分比)
        """
        if len(prices) < period:
            return 0.0
        
        return (prices[-1] - prices[-period]) / prices[-period]
    
    def generate_signal(
        self,
        prices: List[float],
        volumes: List[float],
        current_position: Optional[int] = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        生成交易信号
        
        Args:
            prices: 收盘价列表
            volumes: 成交量列表
            current_position: 当前持仓
            
        Returns:
            交易信号字典或 None
        """
        if len(prices) < self.slow_period + self.signal_period:
            return None
        
        # 计算 EMA
        fast_ema = self.calculate_ema(prices, self.fast_period)
        slow_ema = self.calculate_ema(prices, self.slow_period)
        
        if not fast_ema or not slow_ema:
            return None
        
        # 对齐数据
        offset = len(prices) - len(slow_ema)
        fast_ema_aligned = fast_ema[offset:]
        
        # 检测交叉（使用倒数第2个点，最新点可能还在形成）
        check_index = len(fast_ema_aligned) - 2
        crossover = self.detect_crossover(fast_ema_aligned, slow_ema, check_index)
        
        current_price = prices[-1]
        
        # 金叉 → 买入信号
        if crossover == "golden" and current_position == 0:
            if self.check_volume_confirmation(volumes, len(prices) - 2, "buy"):
                momentum = self.calculate_momentum(prices)
                
                # 计算 MACD 作为额外确认
                macd_data = self.calculate_macd(prices)
                macd_histogram = macd_data["histogram"]
                macd_positive = macd_histogram[-1] > 0 if macd_histogram else False
                
                return {
                    "action": "BUY",
                    "price": current_price,
                    "reason": f"EMA{self.fast_period} 金叉 EMA{self.slow_period}",
                    "confidence": self._calculate_confidence(
                        fast_ema_aligned,
                        slow_ema,
                        check_index,
                        momentum,
                        macd_positive,
                        "buy"
                    ),
                    "indicators": {
                        "fast_ema": fast_ema_aligned[-1],
                        "slow_ema": slow_ema[-1],
                        "momentum": momentum,
                        "macd_positive": macd_positive
                    },
                    "stop_loss": current_price * 0.95,  # 5% 止损
                    "take_profit": current_price * 1.08,  # 8% 止盈
                }
        
        # 死叉 → 卖出信号
        elif crossover == "death" and current_position > 0:
            if self.check_volume_confirmation(volumes, len(prices) - 2, "sell"):
                momentum = self.calculate_momentum(prices)
                
                macd_data = self.calculate_macd(prices)
                macd_histogram = macd_data["histogram"]
                macd_negative = macd_histogram[-1] < 0 if macd_histogram else False
                
                return {
                    "action": "SELL",
                    "price": current_price,
                    "reason": f"EMA{self.fast_period} 死叉 EMA{self.slow_period}",
                    "confidence": self._calculate_confidence(
                        fast_ema_aligned,
                        slow_ema,
                        check_index,
                        momentum,
                        macd_negative,
                        "sell"
                    ),
                    "indicators": {
                        "fast_ema": fast_ema_aligned[-1],
                        "slow_ema": slow_ema[-1],
                        "momentum": momentum,
                        "macd_negative": macd_negative
                    },
                    "type": "trend_reversal",
                }
        
        return None
    
    def _calculate_confidence(
        self,
        fast_ema: List[float],
        slow_ema: List[float],
        index: int,
        momentum: float,
        macd_confirm: bool,
        signal_type: str
    ) -> float:
        """
        计算信号置信度
        """
        confidence = 0.5
        
        # 1. 交叉间距（越大越可靠）
        gap = abs(fast_ema[index] - slow_ema[index]) / slow_ema[index]
        confidence += min(gap / 0.02, 0.2)  # 最多贡献 0.2
        
        # 2. 动量方向
        if (signal_type == "buy" and momentum > 0) or \
           (signal_type == "sell" and momentum < 0):
            confidence += 0.15
        
        # 3. MACD 确认
        if macd_confirm:
            confidence += 0.15
        
        return min(confidence, 1.0)
    
    def get_current_trend(
        self,
        prices: List[float]
    ) -> Dict[str, Any]:
        """
        获取当前趋势信息
        
        Returns:
            趋势方向、强度等信息
        """
        if len(prices) < self.slow_period:
            return {"trend": "unknown", "strength": 0.0}
        
        fast_ema = self.calculate_ema(prices, self.fast_period)
        slow_ema = self.calculate_ema(prices, self.slow_period)
        
        if not fast_ema or not slow_ema:
            return {"trend": "unknown", "strength": 0.0}
        
        offset = len(prices) - len(slow_ema)
        fast_current = fast_ema[-1]
        slow_current = slow_ema[-1]
        
        gap = (fast_current - slow_current) / slow_current
        
        if gap > 0.01:
            trend = "uptrend"
            strength = min(gap / 0.05, 1.0)
        elif gap < -0.01:
            trend = "downtrend"
            strength = min(abs(gap) / 0.05, 1.0)
        else:
            trend = "sideways"
            strength = 0.0
        
        return {
            "trend": trend,
            "strength": strength,
            "fast_ema": fast_current,
            "slow_ema": slow_current,
            "gap_percent": gap * 100
        }

