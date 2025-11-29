"""
买低卖高策略 (Buy Low Sell High Strategy)
基于波段检测，在局部最低点买入，局部最高点卖出
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class BuyLowSellHighStrategy:
    """
    买低卖高策略
    
    核心逻辑：
    1. 检测局部最低点（波谷）：价格低于前后 N 根 K 线
    2. 检测局部最高点（波峰）：价格高于前后 N 根 K 线
    3. 结合成交量和趋势确认
    """
    
    def __init__(
        self,
        lookback_window: int = 5,
        min_wave_amplitude: float = 0.02,  # 最小波幅 2%
        volume_threshold: float = 1.2,     # 成交量阈值（相对平均值）
        trend_confirmation: bool = True,    # 是否需要趋势确认
    ):
        """
        初始化策略参数
        
        Args:
            lookback_window: 回看窗口（检测波峰波谷用）
            min_wave_amplitude: 最小波幅（防止噪音）
            volume_threshold: 成交量确认阈值
            trend_confirmation: 是否需要趋势确认
        """
        self.lookback_window = lookback_window
        self.min_wave_amplitude = min_wave_amplitude
        self.volume_threshold = volume_threshold
        self.trend_confirmation = trend_confirmation
        self.name = "买低卖高策略"
        self.description = "在局部最低点买入，局部最高点卖出"
    
    def detect_local_bottom(self, prices: List[float], volumes: List[float], index: int) -> bool:
        """
        检测局部最低点（波谷）
        
        Args:
            prices: 价格列表（通常使用收盘价）
            volumes: 成交量列表
            index: 当前检测位置
            
        Returns:
            是否为局部最低点
        """
        if index < self.lookback_window or index >= len(prices) - self.lookback_window:
            return False
        
        current_price = prices[index]
        
        # 1. 检查是否为局部最低点
        # 当前价格应低于前后窗口内的所有价格
        is_local_min = True
        for i in range(index - self.lookback_window, index + self.lookback_window + 1):
            if i != index and prices[i] <= current_price:
                is_local_min = False
                break
        
        if not is_local_min:
            return False
        
        # 2. 检查波幅（避免在平盘中交易）
        window_max = max(prices[index - self.lookback_window:index + self.lookback_window + 1])
        amplitude = (window_max - current_price) / current_price
        if amplitude < self.min_wave_amplitude:
            return False
        
        # 3. 成交量确认（可选）
        if volumes and len(volumes) > index:
            avg_volume = sum(volumes[max(0, index - 10):index]) / min(10, index)
            if avg_volume > 0 and volumes[index] < avg_volume * 0.5:
                # 成交量过低，可能不是真实底部
                return False
        
        return True
    
    def detect_local_top(self, prices: List[float], volumes: List[float], index: int) -> bool:
        """
        检测局部最高点（波峰）
        
        Args:
            prices: 价格列表
            volumes: 成交量列表
            index: 当前检测位置
            
        Returns:
            是否为局部最高点
        """
        if index < self.lookback_window or index >= len(prices) - self.lookback_window:
            return False
        
        current_price = prices[index]
        
        # 1. 检查是否为局部最高点
        is_local_max = True
        for i in range(index - self.lookback_window, index + self.lookback_window + 1):
            if i != index and prices[i] >= current_price:
                is_local_max = False
                break
        
        if not is_local_max:
            return False
        
        # 2. 检查波幅
        window_min = min(prices[index - self.lookback_window:index + self.lookback_window + 1])
        amplitude = (current_price - window_min) / window_min
        if amplitude < self.min_wave_amplitude:
            return False
        
        # 3. 成交量确认（顶部通常伴随放量）
        if volumes and len(volumes) > index and self.volume_threshold > 0:
            avg_volume = sum(volumes[max(0, index - 10):index]) / min(10, index)
            if avg_volume > 0 and volumes[index] < avg_volume * self.volume_threshold:
                # 成交量不足，可能不是真实顶部
                return False
        
        return True
    
    def check_trend(self, prices: List[float], index: int, direction: str = "up") -> bool:
        """
        检查趋势确认
        
        Args:
            prices: 价格列表
            index: 当前位置
            direction: 期望的趋势方向 ("up" 或 "down")
            
        Returns:
            是否符合趋势
        """
        if not self.trend_confirmation or index < 20:
            return True
        
        # 使用简单的移动平均线判断趋势
        short_ma = sum(prices[index - 5:index]) / 5
        long_ma = sum(prices[index - 20:index]) / 20
        
        if direction == "up":
            return short_ma > long_ma  # 短期均线在长期均线上方
        else:
            return short_ma < long_ma  # 短期均线在长期均线下方
    
    def generate_signal(
        self,
        prices: List[float],
        volumes: List[float],
        highs: List[float],
        lows: List[float],
        current_position: Optional[int] = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        生成交易信号
        
        Args:
            prices: 收盘价列表
            volumes: 成交量列表
            highs: 最高价列表
            lows: 最低价列表
            current_position: 当前持仓（>0 表示持有，0 表示空仓）
            
        Returns:
            交易信号字典或 None
        """
        if len(prices) < self.lookback_window * 2 + 1:
            return None
        
        # 检查最近的数据点（倒数第2个，因为最新的可能还在形成中）
        check_index = len(prices) - 2
        current_price = prices[-1]
        
        # 如果空仓，寻找买入信号（局部最低点）
        if current_position == 0:
            if self.detect_local_bottom(prices, volumes, check_index):
                # 额外确认：价格应该开始反弹
                if prices[-1] > prices[check_index]:
                    # 趋势确认
                    if self.check_trend(prices, check_index, "up"):
                        return {
                            "action": "BUY",
                            "price": current_price,
                            "reason": f"检测到局部最低点 {prices[check_index]:.2f}，当前反弹至 {current_price:.2f}",
                            "confidence": self._calculate_confidence(prices, volumes, check_index, "buy"),
                            "stop_loss": lows[check_index] * 0.98,  # 止损设在波谷下方 2%
                            "take_profit": current_price * 1.05,     # 止盈设在当前价 5% 以上
                        }
        
        # 如果持仓，寻找卖出信号（局部最高点）
        elif current_position > 0:
            if self.detect_local_top(prices, volumes, check_index):
                # 额外确认：价格应该开始回落
                if prices[-1] < prices[check_index]:
                    return {
                        "action": "SELL",
                        "price": current_price,
                        "reason": f"检测到局部最高点 {prices[check_index]:.2f}，当前回落至 {current_price:.2f}",
                        "confidence": self._calculate_confidence(prices, volumes, check_index, "sell"),
                        "type": "profit_taking",
                    }
        
        return None
    
    def _calculate_confidence(
        self,
        prices: List[float],
        volumes: List[float],
        index: int,
        signal_type: str
    ) -> float:
        """
        计算信号置信度 (0-1)
        
        综合考虑：
        - 波幅大小
        - 成交量确认程度
        - 趋势一致性
        """
        confidence = 0.5
        
        # 1. 波幅贡献（越大越可靠）
        if signal_type == "buy":
            window_max = max(prices[max(0, index - self.lookback_window):index + self.lookback_window + 1])
            amplitude = (window_max - prices[index]) / prices[index]
        else:
            window_min = min(prices[max(0, index - self.lookback_window):index + self.lookback_window + 1])
            amplitude = (prices[index] - window_min) / window_min
        
        confidence += min(amplitude / 0.1, 0.3)  # 最多贡献 0.3
        
        # 2. 成交量贡献
        if volumes and len(volumes) > index:
            avg_volume = sum(volumes[max(0, index - 10):index]) / min(10, index)
            if avg_volume > 0:
                volume_ratio = volumes[index] / avg_volume
                if signal_type == "buy" and volume_ratio > 0.8:
                    confidence += 0.1
                elif signal_type == "sell" and volume_ratio > 1.2:
                    confidence += 0.1
        
        # 3. 趋势贡献
        if index >= 20:
            short_ma = sum(prices[index - 5:index]) / 5
            long_ma = sum(prices[index - 20:index]) / 20
            if (signal_type == "buy" and short_ma > long_ma) or \
               (signal_type == "sell" and short_ma < long_ma):
                confidence += 0.1
        
        return min(confidence, 1.0)
    
    def backtest_summary(
        self,
        prices: List[float],
        volumes: List[float],
        highs: List[float],
        lows: List[float]
    ) -> Dict[str, Any]:
        """
        策略回测摘要
        
        Returns:
            包含买入点、卖出点、预期收益等信息
        """
        buy_points = []
        sell_points = []
        
        for i in range(self.lookback_window, len(prices) - self.lookback_window):
            if self.detect_local_bottom(prices, volumes, i):
                buy_points.append({
                    "index": i,
                    "price": prices[i],
                    "confidence": self._calculate_confidence(prices, volumes, i, "buy")
                })
            
            if self.detect_local_top(prices, volumes, i):
                sell_points.append({
                    "index": i,
                    "price": prices[i],
                    "confidence": self._calculate_confidence(prices, volumes, i, "sell")
                })
        
        # 简单配对计算预期收益
        expected_return = 0.0
        trades = 0
        
        for buy in buy_points:
            # 找到买入后的第一个卖出点
            next_sells = [s for s in sell_points if s["index"] > buy["index"]]
            if next_sells:
                sell = next_sells[0]
                profit = (sell["price"] - buy["price"]) / buy["price"]
                expected_return += profit
                trades += 1
        
        avg_return = expected_return / trades if trades > 0 else 0.0
        
        return {
            "strategy": self.name,
            "total_buy_signals": len(buy_points),
            "total_sell_signals": len(sell_points),
            "completed_trades": trades,
            "average_return": avg_return,
            "buy_points": buy_points[-5:],  # 最近5个买点
            "sell_points": sell_points[-5:],  # 最近5个卖点
        }




















