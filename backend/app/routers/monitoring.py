"""
API endpoints for position monitoring configuration
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

from ..models import (
    PositionMonitoringConfig,
    GlobalMonitoringSettings,
    MonitoringStatus,
    StrategyMode,
    MonitoringConfigResponse,
    UpdateMonitoringConfigRequest,
    BatchMonitoringUpdateRequest,
    GlobalMonitoringUpdateRequest,
    PositionWithMonitoring
)
from ..repositories import (
    get_position_monitoring_config,
    save_position_monitoring_config,
    get_all_monitoring_configs,
    get_global_monitoring_settings,
    save_global_monitoring_settings,
    get_active_monitoring_symbols
)
from ..position_monitor import get_position_monitor
from ..services import get_portfolio_overview

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


def _load_config_map() -> Dict[str, PositionMonitoringConfig]:
    """Return monitoring configs keyed by symbol as Pydantic models."""
    raw_configs = get_all_monitoring_configs()
    configs: Dict[str, PositionMonitoringConfig] = {}
    for item in raw_configs:
        if isinstance(item, PositionMonitoringConfig):
            configs[item.symbol] = item
        elif isinstance(item, dict) and item.get('symbol'):
            try:
                configs[item['symbol']] = PositionMonitoringConfig(**item)
            except Exception:
                logger.warning("Skipping invalid monitoring config for %s", item.get('symbol'))
    return configs


def _load_global_settings_model() -> GlobalMonitoringSettings:
    settings_data = get_global_monitoring_settings()
    if isinstance(settings_data, GlobalMonitoringSettings):
        return settings_data
    return GlobalMonitoringSettings(**settings_data)

class MonitoringUpdate(BaseModel):
    monitoring_status: Optional[MonitoringStatus] = None
    strategy_mode: Optional[StrategyMode] = None
    enabled_strategies: Optional[List[str]] = None
    custom_stop_loss: Optional[float] = None
    custom_take_profit: Optional[float] = None
    custom_position_limit: Optional[float] = None
    trailing_stop: Optional[float] = None
    notes: Optional[str] = None

class BatchMonitoringUpdate(BaseModel):
    symbols: List[str]
    monitoring_status: Optional[MonitoringStatus] = None
    strategy_mode: Optional[StrategyMode] = None
    enabled_strategies: Optional[List[str]] = None

@router.get("/positions")
async def get_monitored_positions() -> Dict[str, Any]:
    """Get all positions with their monitoring configuration"""
    try:
        # Get current positions
        portfolio = get_portfolio_overview()
        positions = portfolio.get('positions', [])

        # Get monitoring configs and global settings
        configs = _load_config_map()
        global_settings = _load_global_settings_model()

        # Combine position and monitoring data
        monitored_positions = []
        for position in positions:
            symbol = position['symbol']

            # Get or create config
            if symbol in configs:
                config = configs[symbol]
            else:
                config = PositionMonitoringConfig(
                    symbol=symbol,
                    monitoring_status=(
                        MonitoringStatus.PAUSED
                        if symbol in (global_settings.excluded_symbols or [])
                        else MonitoringStatus.ENABLED
                    ),
                )

            monitored_positions.append({
                'symbol': symbol,
                'name': position.get('symbol_name', symbol),
                'quantity': position.get('qty', 0),
                'avg_cost': position.get('avg_price', 0),
                'current_price': position.get('last_price', 0),
                'market_value': position.get('market_value', 0),
                'pnl': position.get('pnl', 0),
                'pnl_ratio': position.get('pnl_percent', 0),
                'monitoring_status': config.monitoring_status,
                'strategy_mode': config.strategy_mode,
                'enabled_strategies': config.enabled_strategies,
                'stop_loss_ratio': config.stop_loss_ratio,
                'take_profit_ratio': config.take_profit_ratio,
                'max_position_ratio': config.max_position_ratio,
                'cooldown_minutes': config.cooldown_minutes,
                'notes': config.notes
            })

        return {
            'positions': monitored_positions,
            'total_positions': len(positions),
            'active_monitoring': len([p for p in monitored_positions
                                    if p['monitoring_status'] == MonitoringStatus.ENABLED]),
            'global_settings': global_settings.model_dump()
        }

    except Exception as e:
        logger.error(f"Error getting monitored positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/position/{symbol}")
async def get_position_monitoring(symbol: str) -> PositionMonitoringConfig:
    """Get monitoring configuration for a specific position"""
    try:
        config = get_position_monitoring_config(symbol)
        if config:
            return config
        else:
            # Return default config
            return PositionMonitoringConfig(symbol=symbol)

    except Exception as e:
        logger.error(f"Error getting monitoring config for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/position/{symbol}")
async def update_position_monitoring(
    symbol: str,
    update: MonitoringUpdate
) -> Dict[str, str]:
    """Update monitoring configuration for a position"""
    try:
        # Get existing config or create new one
        existing = get_position_monitoring_config(symbol)
        if isinstance(existing, PositionMonitoringConfig):
            config = existing
        elif isinstance(existing, dict):
            config = PositionMonitoringConfig(**existing)
        else:
            config = PositionMonitoringConfig(symbol=symbol)

        # Update fields
        if update.monitoring_status is not None:
            config.monitoring_status = update.monitoring_status
        if update.strategy_mode is not None:
            config.strategy_mode = update.strategy_mode
        if update.enabled_strategies is not None:
            config.enabled_strategies = update.enabled_strategies
        if update.custom_stop_loss is not None:
            config.stop_loss_ratio = update.custom_stop_loss
        if update.custom_take_profit is not None:
            config.take_profit_ratio = update.custom_take_profit
        if update.custom_position_limit is not None:
            config.max_position_ratio = update.custom_position_limit
        # trailing_stop 字段当前模型未定义，忽略以保持兼容
        if update.notes is not None:
            config.notes = update.notes

        # Save to database
        save_position_monitoring_config(config.model_dump())

        # Update in position monitor
        monitor = get_position_monitor()
        await monitor.update_position_config(symbol, config)

        return {"message": f"Monitoring configuration updated for {symbol}"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating monitoring config for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-update")
async def batch_update_monitoring(update: BatchMonitoringUpdate) -> Dict[str, str]:
    """Batch update monitoring settings for multiple positions"""
    try:
        updated = 0
        monitor = get_position_monitor()

        for symbol in update.symbols:
            existing = get_position_monitoring_config(symbol)
            if isinstance(existing, PositionMonitoringConfig):
                config = existing
            elif isinstance(existing, dict):
                config = PositionMonitoringConfig(**existing)
            else:
                config = PositionMonitoringConfig(symbol=symbol)

            if update.monitoring_status is not None:
                config.monitoring_status = update.monitoring_status
            if update.strategy_mode is not None:
                config.strategy_mode = update.strategy_mode
            if update.enabled_strategies is not None:
                config.enabled_strategies = update.enabled_strategies

            save_position_monitoring_config(config.model_dump())
            await monitor.update_position_config(symbol, config)
            updated += 1

        return {"message": f"Updated {updated} positions"}

    except Exception as e:
        logger.error(f"Error batch updating monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/global-settings")
async def get_global_settings() -> GlobalMonitoringSettings:
    """Get global monitoring settings"""
    try:
        return _load_global_settings_model()

    except Exception as e:
        logger.error(f"Error getting global settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/global-settings")
async def update_global_settings(settings: GlobalMonitoringSettings) -> Dict[str, str]:
    """Update global monitoring settings"""
    try:
        save_global_monitoring_settings(settings.model_dump())

        # Update in position monitor
        monitor = get_position_monitor()
        monitor.global_settings = settings

        return {"message": "Global settings updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating global settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/enable-all")
async def enable_all_monitoring() -> Dict[str, str]:
    """Enable monitoring for all positions"""
    try:
        configs = _load_config_map()
        monitor = get_position_monitor()

        for symbol, config in configs.items():
            config.monitoring_status = MonitoringStatus.ACTIVE
            save_position_monitoring_config(config.model_dump())
            await monitor.update_position_config(symbol, config)

        return {"message": f"Enabled monitoring for {len(configs)} positions"}

    except Exception as e:
        logger.error(f"Error enabling all monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/disable-all")
async def disable_all_monitoring() -> Dict[str, str]:
    """Disable monitoring for all positions"""
    try:
        configs = _load_config_map()
        monitor = get_position_monitor()

        for symbol, config in configs.items():
            config.monitoring_status = MonitoringStatus.PAUSED
            save_position_monitoring_config(config.model_dump())
            await monitor.update_position_config(symbol, config)

        return {"message": f"Disabled monitoring for {len(configs)} positions"}

    except Exception as e:
        logger.error(f"Error disabling all monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_monitoring_status() -> Dict[str, Any]:
    """Get current monitoring system status"""
    try:
        monitor = get_position_monitor()
        status = await monitor.get_monitoring_status()

        return status

    except Exception as e:
        logger.error(f"Error getting monitoring status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/exclude/{symbol}")
async def exclude_from_monitoring(symbol: str) -> Dict[str, str]:
    """Exclude a position from monitoring permanently"""
    try:
        existing = get_position_monitoring_config(symbol)
        if isinstance(existing, PositionMonitoringConfig):
            config = existing
        elif isinstance(existing, dict):
            config = PositionMonitoringConfig(**existing)
        else:
            config = PositionMonitoringConfig(symbol=symbol)
        config.monitoring_status = MonitoringStatus.DISABLED

        save_position_monitoring_config(config.model_dump())

        # Also add to global excluded list
        global_settings = _load_global_settings_model()
        if symbol not in (global_settings.excluded_symbols or []):
            global_settings.excluded_symbols.append(symbol)
            save_global_monitoring_settings(global_settings.model_dump())

        # Update in position monitor
        monitor = get_position_monitor()
        await monitor.update_position_config(symbol, config)

        return {"message": f"{symbol} excluded from monitoring"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error excluding {symbol} from monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/include/{symbol}")
async def include_in_monitoring(symbol: str) -> Dict[str, str]:
    """Include a previously excluded position back to monitoring"""
    try:
        existing = get_position_monitoring_config(symbol)
        if isinstance(existing, PositionMonitoringConfig):
            config = existing
        elif isinstance(existing, dict):
            config = PositionMonitoringConfig(**existing)
        else:
            config = PositionMonitoringConfig(symbol=symbol)
        config.monitoring_status = MonitoringStatus.ENABLED

        save_position_monitoring_config(config.model_dump())

        # Remove from global excluded list
        global_settings = _load_global_settings_model()
        if symbol in (global_settings.excluded_symbols or []):
            global_settings.excluded_symbols.remove(symbol)
            save_global_monitoring_settings(global_settings.model_dump())

        # Update in position monitor
        monitor = get_position_monitor()
        await monitor.update_position_config(symbol, config)

        return {"message": f"{symbol} included in monitoring"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error including {symbol} in monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))
