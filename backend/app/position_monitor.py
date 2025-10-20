"""
Position-based monitoring and strategy execution
Monitors all positions and applies strategies based on individual configuration
"""
import asyncio
import logging
from typing import Dict, List, Optional, Set
from datetime import datetime, time
from dataclasses import dataclass

from .models import (
    PositionMonitoringConfig,
    GlobalMonitoringSettings,
    MonitoringStatus,
    StrategyMode,
    PositionWithMonitoring
)
from .repositories import (
    get_position_monitoring_config,
    get_all_monitoring_configs,
    get_global_monitoring_settings,
    save_position_monitoring_config,
    get_active_monitoring_symbols,
    save_monitoring_event
)
from .strategy_engine import get_strategy_engine, MarketData
from .services import get_portfolio_overview, get_positions

logger = logging.getLogger(__name__)

@dataclass
class MonitoredPosition:
    """Enhanced position with monitoring state"""
    symbol: str
    quantity: int
    avg_cost: float
    current_price: float
    market_value: float
    pnl: float
    pnl_ratio: float
    monitoring_config: PositionMonitoringConfig
    last_check: datetime
    signals_today: int = 0
    trades_today: int = 0

class PositionMonitor:
    """
    Main position monitoring system
    Tracks all positions and applies strategies based on configuration
    """

    def __init__(self):
        self.monitored_positions: Dict[str, MonitoredPosition] = {}
        self.global_settings = GlobalMonitoringSettings()
        self.strategy_engine = get_strategy_engine()
        self.daily_loss = 0.0
        self.daily_trades = 0
        self.is_running = False
        self._lock = asyncio.Lock()

    async def initialize(self):
        """Initialize monitoring system with current positions"""
        try:
            # Load global settings
            settings_data = get_global_monitoring_settings()
            if isinstance(settings_data, dict):
                self.global_settings = GlobalMonitoringSettings(**settings_data)
            else:
                self.global_settings = settings_data

            # Load all monitoring configs
            configs = get_all_monitoring_configs()

            # Get current positions from portfolio
            positions = await self.get_current_positions()

            # Setup monitoring for each position
            for position in positions:
                symbol = position['symbol']

                # Check if symbol is in excluded list
                if symbol in (self.global_settings.excluded_symbols or []):
                    logger.info(f"Skipping excluded symbol: {symbol}")
                    continue

                # Get or create monitoring config
                if symbol in configs:
                    config = configs[symbol]
                else:
                    # Create default config for new position
                    if getattr(self.global_settings, "auto_monitor_new_positions", False):
                        config = PositionMonitoringConfig(
                            symbol=symbol,
                            monitoring_status=MonitoringStatus.ACTIVE,
                            strategy_mode=getattr(self.global_settings, "default_strategy_mode", StrategyMode.BALANCED),
                            enabled_strategies=getattr(self.global_settings, "default_enabled_strategies", [])
                        )
                        save_position_monitoring_config(config)
                    else:
                        config = PositionMonitoringConfig(
                            symbol=symbol,
                            monitoring_status=MonitoringStatus.PAUSED
                        )

                # Create monitored position
                monitored_pos = MonitoredPosition(
                    symbol=symbol,
                    quantity=position.get('qty', position.get('quantity', 0)),
                    avg_cost=position.get('avg_price', position.get('avg_cost', 0)),
                    current_price=position.get('current_price', 0),
                    market_value=position.get('market_value', 0),
                    pnl=position.get('pnl', 0),
                    pnl_ratio=position.get('pnl_ratio', 0),
                    monitoring_config=config,
                    last_check=datetime.now()
                )

                self.monitored_positions[symbol] = monitored_pos

            logger.info(f"Initialized monitoring for {len(self.monitored_positions)} positions")

        except Exception as e:
            logger.error(f"Error initializing position monitor: {e}")

    async def get_current_positions(self) -> List[Dict]:
        """Get current positions from portfolio service"""
        try:
            # Get positions from portfolio service (run in thread to avoid blocking event loop)
            portfolio = await asyncio.to_thread(get_portfolio_overview)
            positions = portfolio.get('positions', [])

            # Enhance with real-time prices if available
            for position in positions:
                # Get latest price from strategy engine's K-line buffer
                buffer = self.strategy_engine.kline_buffers.get(position['symbol'])
                if buffer and buffer.data:
                    latest = buffer.data[-1]
                    position['current_price'] = latest.close
                    avg_cost = position.get('avg_price', position.get('avg_cost', 0))
                    quantity = position.get('qty', position.get('quantity', 0))
                    position['pnl'] = (latest.close - avg_cost) * quantity
                    position['pnl_ratio'] = (latest.close - avg_cost) / avg_cost if avg_cost != 0 else 0

            return positions

        except Exception as e:
            logger.error(f"Error getting current positions: {e}")
            return []

    async def process_quote(self, symbol: str, quote_data: Dict):
        """Process incoming quote for monitored position"""
        async with self._lock:
            if symbol not in self.monitored_positions:
                # Check if it's a new position
                await self.check_new_position(symbol)
                if symbol not in self.monitored_positions:
                    return

            position = self.monitored_positions[symbol]

            # Skip if not actively monitored
            if position.monitoring_config.monitoring_status != MonitoringStatus.ACTIVE:
                return

            # Check trading time restrictions
            if not self.is_trading_time_valid(position.monitoring_config):
                return

            # Check expiry
            if position.monitoring_config.expiry_date:
                if datetime.now() > position.monitoring_config.expiry_date:
                    position.monitoring_config.monitoring_status = MonitoringStatus.EXCLUDED
                    save_position_monitoring_config(position.monitoring_config)
                    return

            # Update current price and P&L
            current_price = quote_data.get('last_done', quote_data.get('close', 0))
            position.current_price = current_price
            position.pnl = (current_price - position.avg_cost) * position.quantity
            position.pnl_ratio = (current_price - position.avg_cost) / position.avg_cost
            position.market_value = current_price * position.quantity

            # Check price thresholds
            if not self.check_price_thresholds(position):
                return

            # Check volume requirements
            if not self.check_volume_requirements(position, quote_data.get('volume', 0)):
                return

            # Apply risk management checks
            if not await self.check_risk_limits(position):
                return

            # Process through enabled strategies
            await self.evaluate_strategies(position, quote_data)

            position.last_check = datetime.now()

    async def check_new_position(self, symbol: str):
        """Check if there's a new position to monitor"""
        try:
            positions = await self.get_current_positions()
            for pos in positions:
                if pos['symbol'] == symbol and symbol not in self.monitored_positions:
                    # New position detected
                    if getattr(self.global_settings, "auto_monitor_new_positions", False):
                        config = PositionMonitoringConfig(
                            symbol=symbol,
                            monitoring_status=MonitoringStatus.ACTIVE,
                            strategy_mode=getattr(self.global_settings, "default_strategy_mode", StrategyMode.BALANCED),
                            enabled_strategies=getattr(self.global_settings, "default_enabled_strategies", [])
                        )
                        save_position_monitoring_config(config)

                        monitored_pos = MonitoredPosition(
                            symbol=symbol,
                            quantity=pos.get('qty', pos.get('quantity', 0)),
                            avg_cost=pos.get('avg_price', pos.get('avg_cost', 0)),
                            current_price=pos.get('current_price', 0),
                            market_value=pos.get('market_value', 0),
                            pnl=pos.get('pnl', 0),
                            pnl_ratio=pos.get('pnl_ratio', 0),
                            monitoring_config=config,
                            last_check=datetime.now()
                        )

                        self.monitored_positions[symbol] = monitored_pos
                        logger.info(f"Added new position to monitoring: {symbol}")

        except Exception as e:
            logger.error(f"Error checking new position {symbol}: {e}")

    def is_trading_time_valid(self, config: PositionMonitoringConfig) -> bool:
        """Check if current time is within trading hours"""
        now = datetime.now()

        # Check custom time restrictions
        if config.monitoring_start_time and config.monitoring_end_time:
            start = time.fromisoformat(config.monitoring_start_time)
            end = time.fromisoformat(config.monitoring_end_time)
            current_time = now.time()

            if start <= end:
                if not (start <= current_time <= end):
                    return False
            else:  # Handles overnight periods
                if not (current_time >= start or current_time <= end):
                    return False

        # Check market hours based on symbol
        symbol = config.symbol
        if symbol.endswith('.HK'):
            # Hong Kong market hours
            if not self.is_hk_market_hours(now):
                return False
        elif symbol.endswith('.US'):
            # US market hours
            if not self.is_us_market_hours(now):
                return False

        return True

    def is_hk_market_hours(self, dt: datetime) -> bool:
        """Check if within HK market hours (9:30-16:00 HKT)"""
        # Simplified - should consider holidays and time zones
        market_open = time(9, 30)
        market_close = time(16, 0)
        return market_open <= dt.time() <= market_close

    def is_us_market_hours(self, dt: datetime) -> bool:
        """Check if within US market hours (9:30-16:00 EST/EDT)"""
        # Simplified - should consider holidays and time zones
        # Assuming we're in HKT, US market is 21:30-04:00 HKT
        current_time = dt.time()
        return (current_time >= time(21, 30) or current_time <= time(4, 0))

    def check_price_thresholds(self, position: MonitoredPosition) -> bool:
        """Check if price is within configured thresholds"""
        config = position.monitoring_config

        if config.min_price and position.current_price < config.min_price:
            return False

        if config.max_price and position.current_price > config.max_price:
            return False

        return True

    def check_volume_requirements(self, position: MonitoredPosition, volume: float) -> bool:
        """Check if volume meets requirements"""
        config = position.monitoring_config

        if config.min_volume and volume < config.min_volume:
            return False

        return True

    async def check_risk_limits(self, position: MonitoredPosition) -> bool:
        """Check global and position-specific risk limits"""
        # Check daily loss limit
        if self.daily_loss >= self.global_settings.max_daily_loss:
            logger.warning(f"Daily loss limit reached: {self.daily_loss:.2%}")
            return False

        # Check position size limit
        config = position.monitoring_config
        position_limit = config.custom_position_limit or self.global_settings.max_position_size

        # Get total portfolio value
        portfolio = get_portfolio_overview()
        total_value = portfolio.get('totals', {}).get('total_value', 1000000)  # Default 1M

        position_ratio = position.market_value / total_value
        if position_ratio > position_limit:
            logger.warning(f"Position size limit exceeded for {position.symbol}: {position_ratio:.2%}")
            return False

        # Check if high volatility pause is enabled
        if self.global_settings.pause_on_high_volatility:
            # Simple volatility check - can be enhanced
            if abs(position.pnl_ratio) > 0.10:  # 10% move
                logger.info(f"High volatility detected for {position.symbol}, pausing")
                return False

        return True

    async def evaluate_strategies(self, position: MonitoredPosition, quote_data: Dict):
        """Evaluate enabled strategies for the position"""
        config = position.monitoring_config

        # Skip if no strategies enabled
        if not config.enabled_strategies:
            return

        # Skip if strategy mode is disabled
        if config.strategy_mode == StrategyMode.DISABLED:
            return

        # Get strategy engine
        engine = self.strategy_engine

        # Convert to market data format
        market_data = MarketData(
            symbol=position.symbol,
            open=quote_data.get('open', 0),
            high=quote_data.get('high', 0),
            low=quote_data.get('low', 0),
            close=quote_data.get('last_done', quote_data.get('close', 0)),
            volume=quote_data.get('volume', 0),
            timestamp=datetime.now()
        )

        # Process through each enabled strategy
        for strategy_id in config.enabled_strategies:
            if strategy_id not in engine.strategies:
                continue

            strategy = engine.strategies[strategy_id]

            # Skip if strategy is globally disabled
            if not strategy.get('enabled', False):
                continue

            # Apply position-specific risk parameters
            risk_params = self.get_position_risk_params(position)

            # Evaluate strategy with custom parameters
            signal = await self.evaluate_single_strategy(
                position,
                strategy,
                market_data,
                risk_params
            )

            if signal:
                position.signals_today += 1
                
                # Record signal event
                self._record_event(
                    event_type='signal_generated',
                    symbol=position.symbol,
                    strategy_id=strategy_id,
                    strategy_name=strategy.get('name'),
                    signal_action=signal['action'],
                    price=signal.get('price'),
                    message=signal.get('reason'),
                    details=signal
                )

                if config.strategy_mode == StrategyMode.AUTO:
                    # Execute trade automatically
                    await self.execute_trade(position, signal, strategy_id)
                    position.trades_today += 1
                elif config.strategy_mode == StrategyMode.ALERT_ONLY:
                    # Send alert only
                    await self.send_alert(position, signal, strategy_id)

    def get_position_risk_params(self, position: MonitoredPosition) -> Dict:
        """Get risk parameters for position (custom or global)"""
        config = position.monitoring_config

        return {
            'stop_loss': config.custom_stop_loss or self.global_settings.global_stop_loss,
            'take_profit': config.custom_take_profit or self.global_settings.global_take_profit,
            'trailing_stop': config.trailing_stop,
            'position_size': position.quantity
        }

    async def evaluate_single_strategy(
        self,
        position: MonitoredPosition,
        strategy: Dict,
        market_data: MarketData,
        risk_params: Dict
    ) -> Optional[Dict]:
        """Evaluate a single strategy for a position"""
        try:
            engine = self.strategy_engine

            # Get K-line buffer for the symbol
            buffer = engine.kline_buffers.get(position.symbol)
            if not buffer or len(buffer.data) < 50:
                return None

            # Add current data to buffer
            buffer.add(market_data)

            # Check buy/sell conditions
            is_long = position.quantity > 0
            conditions = strategy['conditions']['sell'] if is_long else strategy['conditions']['buy']

            if engine.evaluate_conditions(conditions, buffer, market_data):
                return {
                    'action': 'SELL' if is_long else 'BUY',
                    'symbol': position.symbol,
                    'quantity': abs(position.quantity),
                    'price': market_data.close,
                    'reason': f"Strategy {strategy['name']} triggered",
                    'stop_loss': market_data.close * (1 - risk_params['stop_loss']),
                    'take_profit': market_data.close * (1 + risk_params['take_profit'])
                }

            # Check stop loss
            if is_long and market_data.close <= position.avg_cost * (1 - risk_params['stop_loss']):
                return {
                    'action': 'SELL',
                    'symbol': position.symbol,
                    'quantity': position.quantity,
                    'price': market_data.close,
                    'reason': 'Stop loss triggered'
                }

            # Check take profit
            if is_long and market_data.close >= position.avg_cost * (1 + risk_params['take_profit']):
                return {
                    'action': 'SELL',
                    'symbol': position.symbol,
                    'quantity': position.quantity,
                    'price': market_data.close,
                    'reason': 'Take profit triggered'
                }

            # Check trailing stop if configured
            if risk_params.get('trailing_stop'):
                # Implement trailing stop logic
                pass

            return None

        except Exception as e:
            logger.error(f"Error evaluating strategy for {position.symbol}: {e}")
            return None

    async def execute_trade(self, position: MonitoredPosition, signal: Dict, strategy_id: str):
        """Execute trade based on signal"""
        try:
            logger.info(f"Executing trade for {position.symbol}: {signal}")

            # Update daily counters
            self.daily_trades += 1

            # Calculate P&L if selling
            pnl = None
            pnl_ratio = None
            if signal['action'] == 'SELL':
                pnl = (signal['price'] - position.avg_cost) * signal['quantity']
                pnl_ratio = pnl / (position.avg_cost * signal['quantity']) if position.avg_cost > 0 else 0
                self.daily_loss += pnl if pnl < 0 else 0
            
            # Record trade execution event
            self._record_event(
                event_type='trade_executed',
                symbol=position.symbol,
                strategy_id=strategy_id,
                signal_action=signal['action'],
                price=signal.get('price'),
                quantity=signal.get('quantity'),
                pnl=pnl,
                pnl_ratio=pnl_ratio,
                message=f"自动执行交易: {signal['action']} {signal['quantity']} @ {signal['price']}",
                details=signal
            )

            # Send notification
            await self.send_notification({
                'type': 'trade_executed',
                'position': position.symbol,
                'signal': signal,
                'strategy_id': strategy_id,
                'timestamp': datetime.now().isoformat()
            })

            # TODO: Integrate with Longbridge API to execute actual trade

        except Exception as e:
            logger.error(f"Error executing trade for {position.symbol}: {e}")

    async def send_alert(self, position: MonitoredPosition, signal: Dict, strategy_id: str):
        """Send alert for trade signal"""
        try:
            await self.send_notification({
                'type': 'trade_alert',
                'position': position.symbol,
                'signal': signal,
                'strategy_id': strategy_id,
                'timestamp': datetime.now().isoformat(),
                'message': f"Trade signal for {position.symbol}: {signal['action']} @ {signal['price']}"
            })

        except Exception as e:
            logger.error(f"Error sending alert for {position.symbol}: {e}")

    async def send_notification(self, message: Dict):
        """Send notification through configured channels"""
        # Log notification
        logger.info(f"Position Monitor Notification: {message}")

        # Send through WebSocket to all connected clients
        from .streaming import quote_stream_manager
        
        notification_payload = {
            "type": "monitoring_alert",
            "alert_type": message.get('type', 'info'),
            "symbol": message.get('position'),
            "message": message.get('message', str(message)),
            "severity": self._get_severity_from_type(message.get('type')),
            "signal": message.get('signal'),
            "strategy_id": message.get('strategy_id'),
            "timestamp": message.get('timestamp', datetime.now().isoformat())
        }
        
        quote_stream_manager._broadcast(notification_payload)
        
        # TODO: Send through email, SMS etc.
    
    def _get_severity_from_type(self, alert_type: str) -> str:
        """Map alert type to severity level"""
        severity_map = {
            'trade_executed': 'success',
            'trade_alert': 'warning',
            'stop_loss': 'error',
            'take_profit': 'success',
            'risk_warning': 'warning',
            'strategy_signal': 'info'
        }
        return severity_map.get(alert_type, 'info')
    
    def _record_event(self, event_type: str, symbol: str, **kwargs):
        """Record a monitoring event to history"""
        try:
            event_data = {
                'timestamp': datetime.now(),
                'event_type': event_type,
                'symbol': symbol,
                **kwargs
            }
            save_monitoring_event(event_data)
        except Exception as e:
            logger.error(f"Error recording monitoring event: {e}")

    async def update_position_config(self, symbol: str, config: PositionMonitoringConfig):
        """Update monitoring configuration for a position"""
        async with self._lock:
            if symbol in self.monitored_positions:
                self.monitored_positions[symbol].monitoring_config = config
                save_position_monitoring_config(config)
                logger.info(f"Updated monitoring config for {symbol}")
            else:
                logger.warning(f"Position {symbol} not found in monitored positions")

    async def get_monitoring_status(self) -> Dict:
        """Get current monitoring status"""
        async with self._lock:
            active_positions = [
                p for p in self.monitored_positions.values()
                if p.monitoring_config.monitoring_status == MonitoringStatus.ACTIVE
            ]

            return {
                'total_positions': len(self.monitored_positions),
                'active_monitoring': len(active_positions),
                'daily_trades': self.daily_trades,
                'daily_loss': self.daily_loss,
                'positions': {
                    symbol: {
                        'symbol': pos.symbol,
                        'quantity': pos.quantity,
                        'avg_cost': pos.avg_cost,
                        'current_price': pos.current_price,
                        'pnl': pos.pnl,
                        'pnl_ratio': pos.pnl_ratio,
                        'monitoring_status': pos.monitoring_config.monitoring_status,
                        'strategy_mode': pos.monitoring_config.strategy_mode,
                        'enabled_strategies': pos.monitoring_config.enabled_strategies,
                        'signals_today': pos.signals_today,
                        'trades_today': pos.trades_today,
                        'last_check': pos.last_check.isoformat()
                    }
                    for symbol, pos in self.monitored_positions.items()
                }
            }

    async def start_monitoring(self):
        """Start monitoring loop"""
        self.is_running = True
        await self.initialize()

        while self.is_running:
            try:
                # Periodic position refresh
                await self.refresh_positions()
                await asyncio.sleep(30)  # Refresh every 30 seconds

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(5)

    async def refresh_positions(self):
        """Refresh position list and remove closed positions"""
        async with self._lock:
            current_positions = await self.get_current_positions()
            current_symbols = {p['symbol'] for p in current_positions}

            # Remove closed positions
            closed_symbols = set(self.monitored_positions.keys()) - current_symbols
            for symbol in closed_symbols:
                del self.monitored_positions[symbol]
                logger.info(f"Removed closed position: {symbol}")

            # Update existing positions
            for pos in current_positions:
                symbol = pos['symbol']
                if symbol in self.monitored_positions:
                    monitored = self.monitored_positions[symbol]
                    monitored.quantity = pos.get('qty', pos.get('quantity', 0))
                    monitored.avg_cost = pos.get('avg_price', pos.get('avg_cost', 0))
                    monitored.market_value = pos.get('market_value', 0)

    async def stop_monitoring(self):
        """Stop monitoring loop"""
        self.is_running = False


# Global position monitor instance
position_monitor = None

def get_position_monitor() -> PositionMonitor:
    """Get or create position monitor instance"""
    global position_monitor
    if position_monitor is None:
        position_monitor = PositionMonitor()
    return position_monitor
