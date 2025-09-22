"""
Automated Trading Strategy Engine
Monitors real-time K-line data and executes trading strategies
"""
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"

class StrategyStatus(Enum):
    IDLE = "idle"
    MONITORING = "monitoring"
    TRIGGERED = "triggered"
    EXECUTING = "executing"
    COOLDOWN = "cooldown"

@dataclass
class Position:
    symbol: str
    side: OrderSide
    quantity: int
    entry_price: float
    entry_time: datetime
    stop_loss: float
    take_profit: float
    strategy_id: str
    status: str = "open"
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: Optional[float] = None

@dataclass
class MarketData:
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    timestamp: datetime

@dataclass
class KLineBuffer:
    """Buffer to store historical K-line data for indicator calculations"""
    symbol: str
    data: List[MarketData] = field(default_factory=list)
    max_size: int = 200

    def add(self, bar: MarketData):
        self.data.append(bar)
        if len(self.data) > self.max_size:
            self.data.pop(0)

    def get_closes(self, period: int) -> np.ndarray:
        if len(self.data) < period:
            return np.array([])
        return np.array([d.close for d in self.data[-period:]])

    def get_volumes(self, period: int) -> np.ndarray:
        if len(self.data) < period:
            return np.array([])
        return np.array([d.volume for d in self.data[-period:]])

class TechnicalIndicators:
    """Technical indicator calculations"""

    @staticmethod
    def sma(prices: np.ndarray, period: int) -> float:
        """Simple Moving Average"""
        if len(prices) < period:
            return 0
        return np.mean(prices[-period:])

    @staticmethod
    def ema(prices: np.ndarray, period: int) -> float:
        """Exponential Moving Average"""
        if len(prices) < period:
            return 0
        alpha = 2 / (period + 1)
        ema_val = prices[-period]
        for price in prices[-period+1:]:
            ema_val = alpha * price + (1 - alpha) * ema_val
        return ema_val

    @staticmethod
    def rsi(prices: np.ndarray, period: int = 14) -> float:
        """Relative Strength Index"""
        if len(prices) < period + 1:
            return 50

        deltas = np.diff(prices[-period-1:])
        gains = deltas[deltas > 0]
        losses = -deltas[deltas < 0]

        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 0

        if avg_loss == 0:
            return 100

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    @staticmethod
    def bollinger_bands(prices: np.ndarray, period: int = 20, std_dev: float = 2):
        """Bollinger Bands"""
        if len(prices) < period:
            return None, None, None

        sma = np.mean(prices[-period:])
        std = np.std(prices[-period:])

        upper = sma + (std_dev * std)
        lower = sma - (std_dev * std)

        return upper, sma, lower

    @staticmethod
    def macd(prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9):
        """MACD indicator"""
        if len(prices) < slow + signal:
            return None, None, None

        ema_fast = TechnicalIndicators.ema(prices, fast)
        ema_slow = TechnicalIndicators.ema(prices, slow)

        macd_line = ema_fast - ema_slow
        signal_line = TechnicalIndicators.ema(np.array([macd_line]), signal)
        histogram = macd_line - signal_line

        return macd_line, signal_line, histogram

class StrategyEngine:
    """Main strategy execution engine"""

    def __init__(self, config_path: str = "config/strategies.json"):
        self.config_path = Path(config_path)
        self.strategies = {}
        self.positions: Dict[str, Position] = {}
        self.kline_buffers: Dict[str, KLineBuffer] = {}
        self.strategy_status: Dict[str, StrategyStatus] = {}
        self.last_trade_time: Dict[str, datetime] = {}
        self.daily_trade_count = 0
        self.indicators = TechnicalIndicators()
        self.global_settings: Dict[str, Any] = {}
        self.notification_settings: Dict[str, Any] = {}
        self.load_strategies()

    def load_strategies(self):
        """Load strategy configuration from JSON file"""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.strategies = {s['id']: s for s in config['strategies']}
                    self.global_settings = config.get('global_settings', {})
                    self.notification_settings = config.get('notification_settings', {})

                    # Initialize status for each strategy
                    for strategy_id in self.strategies:
                        self.strategy_status[strategy_id] = StrategyStatus.IDLE

                logger.info(f"Loaded {len(self.strategies)} strategies")
        except Exception as e:
            logger.error(f"Error loading strategies: {e}")
            self.strategies = {}

    def reload_strategies(self):
        """Reload strategies from configuration file"""
        self.load_strategies()
        logger.info("Strategies reloaded")

    async def process_kline(self, symbol: str, bar: Dict[str, Any]):
        """Process incoming K-line data and check strategies"""
        try:
            # Convert to MarketData object
            market_data = MarketData(
                symbol=symbol,
                open=bar.get('open', 0),
                high=bar.get('high', 0),
                low=bar.get('low', 0),
                close=bar.get('close', 0),
                volume=bar.get('volume', 0),
                timestamp=datetime.now()
            )

            # Update K-line buffer
            if symbol not in self.kline_buffers:
                self.kline_buffers[symbol] = KLineBuffer(symbol=symbol)
            self.kline_buffers[symbol].add(market_data)

            # Check all enabled strategies for this symbol
            for strategy_id, strategy in self.strategies.items():
                if not strategy.get('enabled', False):
                    continue

                if symbol not in strategy.get('symbols', []):
                    continue

                # Check if strategy is in cooldown
                if self.is_in_cooldown(strategy_id):
                    continue

                # Evaluate strategy conditions
                await self.evaluate_strategy(strategy_id, strategy, symbol, market_data)

        except Exception as e:
            logger.error(f"Error processing K-line for {symbol}: {e}")

    async def evaluate_strategy(self, strategy_id: str, strategy: Dict, symbol: str, market_data: MarketData):
        """Evaluate strategy conditions and execute trades"""
        try:
            buffer = self.kline_buffers.get(symbol)
            if not buffer or len(buffer.data) < 50:  # Need enough data for indicators
                return

            # Check existing positions
            position_key = f"{strategy_id}_{symbol}"
            existing_position = self.positions.get(position_key)

            if existing_position and existing_position.status == "open":
                # Check exit conditions (stop loss, take profit, sell signal)
                await self.check_exit_conditions(existing_position, market_data, strategy)
            else:
                # Check entry conditions
                if self.evaluate_conditions(strategy['conditions']['buy'], buffer, market_data):
                    await self.execute_buy(strategy_id, strategy, symbol, market_data)

        except Exception as e:
            logger.error(f"Error evaluating strategy {strategy_id} for {symbol}: {e}")

    def evaluate_conditions(self, conditions: List[Dict], buffer: KLineBuffer, market_data: MarketData) -> bool:
        """Evaluate a list of conditions"""
        if not conditions:
            return False

        for condition in conditions:
            if not self.evaluate_single_condition(condition, buffer, market_data):
                return False

        return True

    def evaluate_single_condition(self, condition: Dict, buffer: KLineBuffer, market_data: MarketData) -> bool:
        """Evaluate a single condition"""
        try:
            cond_type = condition['type']
            params = condition.get('params', {})

            if cond_type == 'ma_crossover':
                return self.check_ma_crossover(buffer, params)
            elif cond_type == 'rsi':
                return self.check_rsi(buffer, params)
            elif cond_type == 'volume':
                return self.check_volume(buffer, market_data, params)
            elif cond_type == 'price_breakout':
                return self.check_price_breakout(buffer, market_data, params)
            elif cond_type == 'bollinger_bands':
                return self.check_bollinger_bands(buffer, market_data, params)
            elif cond_type == 'macd':
                return self.check_macd(buffer, params)
            elif cond_type == 'price_change':
                return self.check_price_change(buffer, params)

            return False

        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False

    def check_ma_crossover(self, buffer: KLineBuffer, params: Dict) -> bool:
        """Check moving average crossover"""
        short_period = params.get('short_period', 5)
        long_period = params.get('long_period', 20)
        direction = params.get('direction', 'golden_cross')

        closes = buffer.get_closes(max(short_period, long_period) + 1)
        if len(closes) < max(short_period, long_period) + 1:
            return False

        # Calculate current and previous MAs
        short_ma_curr = self.indicators.sma(closes, short_period)
        long_ma_curr = self.indicators.sma(closes, long_period)
        short_ma_prev = self.indicators.sma(closes[:-1], short_period)
        long_ma_prev = self.indicators.sma(closes[:-1], long_period)

        if direction == 'golden_cross':
            # Short MA crosses above long MA
            return short_ma_prev <= long_ma_prev and short_ma_curr > long_ma_curr
        elif direction == 'death_cross':
            # Short MA crosses below long MA
            return short_ma_prev >= long_ma_prev and short_ma_curr < long_ma_curr

        return False

    def check_rsi(self, buffer: KLineBuffer, params: Dict) -> bool:
        """Check RSI condition"""
        period = params.get('period', 14)
        operator = params.get('operator', 'less_than')
        threshold = params.get('oversold', 30) if operator == 'less_than' else params.get('overbought', 70)

        closes = buffer.get_closes(period + 2)
        if len(closes) < period + 2:
            return False

        rsi = self.indicators.rsi(closes, period)

        if operator == 'less_than':
            return rsi < threshold
        elif operator == 'greater_than':
            return rsi > threshold

        return False

    def check_volume(self, buffer: KLineBuffer, market_data: MarketData, params: Dict) -> bool:
        """Check volume condition"""
        period = params.get('period', 5)
        multiplier = params.get('multiplier', 1.5)
        operator = params.get('operator', 'greater_than')

        volumes = buffer.get_volumes(period)
        if len(volumes) < period:
            return False

        avg_volume = np.mean(volumes)
        current_volume = market_data.volume

        if operator == 'greater_than':
            return current_volume > avg_volume * multiplier

        return False

    def check_price_breakout(self, buffer: KLineBuffer, market_data: MarketData, params: Dict) -> bool:
        """Check price breakout condition"""
        period = params.get('period', 20)
        breakout_type = params.get('breakout_type', 'resistance')
        confirmation_bars = params.get('confirmation_bars', 2)

        closes = buffer.get_closes(period + confirmation_bars)
        if len(closes) < period + confirmation_bars:
            return False

        if breakout_type == 'resistance':
            resistance = np.max(closes[:-confirmation_bars])
            # Check if last N bars are above resistance
            return all(price > resistance for price in closes[-confirmation_bars:])
        elif breakout_type == 'support':
            support = np.min(closes[:-confirmation_bars])
            # Check if last N bars are below support
            return all(price < support for price in closes[-confirmation_bars:])

        return False

    def check_bollinger_bands(self, buffer: KLineBuffer, market_data: MarketData, params: Dict) -> bool:
        """Check Bollinger Bands condition"""
        period = params.get('period', 20)
        std_dev = params.get('std_dev', 2)
        band = params.get('band', 'lower')
        operator = params.get('operator', 'touch')

        closes = buffer.get_closes(period + 1)
        if len(closes) < period + 1:
            return False

        upper, middle, lower = self.indicators.bollinger_bands(closes, period, std_dev)
        if upper is None:
            return False

        current_price = market_data.close

        if band == 'lower' and operator == 'touch':
            return current_price <= lower
        elif band == 'upper' and operator == 'touch':
            return current_price >= upper

        return False

    def check_macd(self, buffer: KLineBuffer, params: Dict) -> bool:
        """Check MACD condition"""
        fast_period = params.get('fast_period', 12)
        slow_period = params.get('slow_period', 26)
        signal_period = params.get('signal_period', 9)
        condition = params.get('condition', 'bullish_divergence')

        closes = buffer.get_closes(slow_period + signal_period + 10)
        if len(closes) < slow_period + signal_period + 10:
            return False

        # Calculate MACD for current and previous periods
        macd_curr, signal_curr, hist_curr = self.indicators.macd(closes, fast_period, slow_period, signal_period)
        macd_prev, signal_prev, hist_prev = self.indicators.macd(closes[:-1], fast_period, slow_period, signal_period)

        if macd_curr is None or macd_prev is None:
            return False

        if condition == 'bullish_divergence':
            # MACD crosses above signal line
            return macd_prev <= signal_prev and macd_curr > signal_curr
        elif condition == 'bearish_divergence':
            # MACD crosses below signal line
            return macd_prev >= signal_prev and macd_curr < signal_curr

        return False

    def check_price_change(self, buffer: KLineBuffer, params: Dict) -> bool:
        """Check price change condition"""
        period = params.get('period', 3)
        min_change = params.get('min_change', -0.05)

        closes = buffer.get_closes(period + 1)
        if len(closes) < period + 1:
            return False

        price_change = (closes[-1] - closes[0]) / closes[0]
        return price_change <= min_change

    async def execute_buy(self, strategy_id: str, strategy: Dict, symbol: str, market_data: MarketData):
        """Execute buy order"""
        try:
            # Check risk management rules
            risk_mgmt = strategy.get('risk_management', {})

            # Check max positions
            strategy_positions = [p for p in self.positions.values()
                                 if p.strategy_id == strategy_id and p.status == 'open']
            if len(strategy_positions) >= risk_mgmt.get('max_positions', 3):
                logger.info(f"Max positions reached for strategy {strategy_id}")
                return

            # Check daily trade limit
            if self.daily_trade_count >= self.global_settings.get('max_daily_trades', 10):
                logger.info("Daily trade limit reached")
                return

            # Calculate position size (simplified - should use actual account balance)
            position_size = risk_mgmt.get('position_size', 0.1)
            quantity = 100  # Simplified - should calculate based on account and position size

            # Calculate stop loss and take profit prices
            stop_loss_pct = risk_mgmt.get('stop_loss', 0.05)
            take_profit_pct = risk_mgmt.get('take_profit', 0.15)

            entry_price = market_data.close
            stop_loss = entry_price * (1 - stop_loss_pct)
            take_profit = entry_price * (1 + take_profit_pct)

            # Create position
            position = Position(
                symbol=symbol,
                side=OrderSide.BUY,
                quantity=quantity,
                entry_price=entry_price,
                entry_time=datetime.now(),
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_id=strategy_id
            )

            # Store position
            position_key = f"{strategy_id}_{symbol}"
            self.positions[position_key] = position

            # Update counters
            self.daily_trade_count += 1
            self.last_trade_time[strategy_id] = datetime.now()
            self.strategy_status[strategy_id] = StrategyStatus.EXECUTING

            # Send notification
            await self.send_notification({
                'type': 'order_placed',
                'strategy_id': strategy_id,
                'strategy_name': strategy.get('name', ''),
                'symbol': symbol,
                'side': 'BUY',
                'quantity': quantity,
                'price': entry_price,
                'stop_loss': stop_loss,
                'take_profit': take_profit,
                'timestamp': datetime.now().isoformat()
            })

            logger.info(f"Buy order placed: {symbol} @ {entry_price}, SL: {stop_loss}, TP: {take_profit}")

            # TODO: Integrate with Longbridge API to place actual order

        except Exception as e:
            logger.error(f"Error executing buy order: {e}")

    async def check_exit_conditions(self, position: Position, market_data: MarketData, strategy: Dict):
        """Check and execute exit conditions"""
        try:
            current_price = market_data.close

            # Check stop loss
            if current_price <= position.stop_loss:
                await self.execute_sell(position, current_price, "stop_loss")
                return

            # Check take profit
            if current_price >= position.take_profit:
                await self.execute_sell(position, current_price, "take_profit")
                return

            # Check trailing stop if configured
            risk_mgmt = strategy.get('risk_management', {})
            trailing_stop = risk_mgmt.get('trailing_stop')
            if trailing_stop:
                # Update stop loss if price has moved favorably
                new_stop_loss = current_price * (1 - trailing_stop)
                if new_stop_loss > position.stop_loss:
                    position.stop_loss = new_stop_loss
                    logger.info(f"Updated trailing stop for {position.symbol}: {new_stop_loss}")

            # Check sell signal conditions
            buffer = self.kline_buffers.get(position.symbol)
            if buffer and self.evaluate_conditions(strategy['conditions']['sell'], buffer, market_data):
                await self.execute_sell(position, current_price, "signal")

        except Exception as e:
            logger.error(f"Error checking exit conditions: {e}")

    async def execute_sell(self, position: Position, price: float, reason: str):
        """Execute sell order"""
        try:
            # Calculate PnL
            pnl = (price - position.entry_price) * position.quantity
            pnl_pct = ((price - position.entry_price) / position.entry_price) * 100

            # Update position
            position.exit_price = price
            position.exit_time = datetime.now()
            position.pnl = pnl
            position.status = "closed"

            # Send notification
            await self.send_notification({
                'type': 'order_filled',
                'strategy_id': position.strategy_id,
                'symbol': position.symbol,
                'side': 'SELL',
                'quantity': position.quantity,
                'price': price,
                'pnl': pnl,
                'pnl_pct': pnl_pct,
                'reason': reason,
                'timestamp': datetime.now().isoformat()
            })

            logger.info(f"Sell order executed: {position.symbol} @ {price}, PnL: {pnl:.2f} ({pnl_pct:.2f}%), Reason: {reason}")

            # Update strategy status
            self.strategy_status[position.strategy_id] = StrategyStatus.COOLDOWN

            # TODO: Integrate with Longbridge API to place actual sell order

        except Exception as e:
            logger.error(f"Error executing sell order: {e}")

    def is_in_cooldown(self, strategy_id: str) -> bool:
        """Check if strategy is in cooldown period"""
        if strategy_id not in self.last_trade_time:
            return False

        cooldown_period = self.global_settings.get('cooldown_period', 300)
        time_since_trade = (datetime.now() - self.last_trade_time[strategy_id]).seconds

        if time_since_trade < cooldown_period:
            return True

        # Reset status if cooldown is over
        if self.strategy_status[strategy_id] == StrategyStatus.COOLDOWN:
            self.strategy_status[strategy_id] = StrategyStatus.MONITORING

        return False

    async def send_notification(self, message: Dict):
        """Send notification through configured channels"""
        if not self.notification_settings.get('enabled', True):
            return

        event_type = message.get('type', '')
        if event_type not in self.notification_settings.get('events', []):
            return

        # Log the notification
        if 'log' in self.notification_settings.get('channels', []):
            logger.info(f"Strategy Notification: {json.dumps(message, ensure_ascii=False)}")

        # TODO: Send through WebSocket to frontend
        # TODO: Send email/SMS notifications if configured

    def get_status(self) -> Dict:
        """Get current status of all strategies and positions"""
        return {
            'strategies': {
                strategy_id: {
                    'name': strategy.get('name', ''),
                    'enabled': strategy.get('enabled', False),
                    'status': self.strategy_status.get(strategy_id, StrategyStatus.IDLE).value,
                    'last_trade': self.last_trade_time.get(strategy_id).isoformat()
                                if strategy_id in self.last_trade_time else None
                }
                for strategy_id, strategy in self.strategies.items()
            },
            'positions': {
                key: {
                    'symbol': pos.symbol,
                    'side': pos.side.value,
                    'quantity': pos.quantity,
                    'entry_price': pos.entry_price,
                    'current_price': 0,  # Should get from real-time data
                    'pnl': pos.pnl if pos.pnl else 0,
                    'status': pos.status
                }
                for key, pos in self.positions.items()
            },
            'daily_trades': self.daily_trade_count,
            'max_daily_trades': self.global_settings.get('max_daily_trades', 10)
        }

    def update_strategy(self, strategy_id: str, enabled: bool = None, params: Dict = None):
        """Update strategy configuration"""
        if strategy_id not in self.strategies:
            return False

        if enabled is not None:
            self.strategies[strategy_id]['enabled'] = enabled

        if params:
            # Update strategy parameters
            for key, value in params.items():
                if key in self.strategies[strategy_id]:
                    self.strategies[strategy_id][key] = value

        # Save updated configuration
        self.save_strategies()
        return True

    def save_strategies(self):
        """Save current strategies to configuration file"""
        try:
            config = {
                'strategies': list(self.strategies.values()),
                'global_settings': self.global_settings,
                'notification_settings': self.notification_settings
            }

            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)

            logger.info("Strategies saved to configuration file")
        except Exception as e:
            logger.error(f"Error saving strategies: {e}")

# Global strategy engine instance
strategy_engine = None

def get_strategy_engine() -> StrategyEngine:
    """Get or create strategy engine instance"""
    global strategy_engine
    if strategy_engine is None:
        strategy_engine = StrategyEngine()
    return strategy_engine
