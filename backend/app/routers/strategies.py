"""
Strategy management API endpoints
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import json
import logging

from ..strategy_engine import get_strategy_engine, StrategyStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategies", tags=["strategies"])

class StrategyUpdate(BaseModel):
    enabled: Optional[bool] = None
    symbols: Optional[List[str]] = None
    risk_management: Optional[Dict[str, Any]] = None

class StrategyResponse(BaseModel):
    id: str
    name: str
    enabled: bool
    description: str
    symbols: List[str]
    status: str
    last_trade: Optional[str] = None

@router.get("/")
async def get_strategies() -> List[StrategyResponse]:
    """Get all configured strategies"""
    try:
        engine = get_strategy_engine()
        strategies = []

        for strategy_id, strategy in engine.strategies.items():
            strategies.append(StrategyResponse(
                id=strategy_id,
                name=strategy.get('name', ''),
                enabled=strategy.get('enabled', False),
                description=strategy.get('description', ''),
                symbols=strategy.get('symbols', []),
                status=engine.strategy_status.get(strategy_id, StrategyStatus.IDLE).value,
                last_trade=engine.last_trade_time.get(strategy_id).isoformat()
                          if strategy_id in engine.last_trade_time else None
            ))

        return strategies
    except Exception as e:
        logger.error(f"Error getting strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{strategy_id}")
async def update_strategy(strategy_id: str, update: StrategyUpdate) -> Dict[str, str]:
    """Update strategy configuration"""
    try:
        engine = get_strategy_engine()

        if strategy_id not in engine.strategies:
            raise HTTPException(status_code=404, detail="Strategy not found")

        # Update strategy
        if update.enabled is not None:
            engine.strategies[strategy_id]['enabled'] = update.enabled

        if update.symbols is not None:
            engine.strategies[strategy_id]['symbols'] = update.symbols

        if update.risk_management is not None:
            engine.strategies[strategy_id]['risk_management'].update(update.risk_management)

        # Save changes
        engine.save_strategies()

        return {"message": f"Strategy {strategy_id} updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{strategy_id}/enable")
async def enable_strategy(strategy_id: str) -> Dict[str, str]:
    """Enable a strategy"""
    try:
        engine = get_strategy_engine()

        if strategy_id not in engine.strategies:
            raise HTTPException(status_code=404, detail="Strategy not found")

        engine.strategies[strategy_id]['enabled'] = True
        engine.strategy_status[strategy_id] = StrategyStatus.MONITORING
        engine.save_strategies()

        return {"message": f"Strategy {strategy_id} enabled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enabling strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{strategy_id}/disable")
async def disable_strategy(strategy_id: str) -> Dict[str, str]:
    """Disable a strategy"""
    try:
        engine = get_strategy_engine()

        if strategy_id not in engine.strategies:
            raise HTTPException(status_code=404, detail="Strategy not found")

        engine.strategies[strategy_id]['enabled'] = False
        engine.strategy_status[strategy_id] = StrategyStatus.IDLE
        engine.save_strategies()

        return {"message": f"Strategy {strategy_id} disabled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disabling strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/positions/all")
async def get_all_positions() -> List[Dict[str, Any]]:
    """Get all positions across all strategies"""
    try:
        engine = get_strategy_engine()
        positions = []

        for key, pos in engine.positions.items():
            positions.append({
                'id': key,
                'symbol': pos.symbol,
                'side': pos.side.value,
                'quantity': pos.quantity,
                'entry_price': pos.entry_price,
                'entry_time': pos.entry_time.isoformat(),
                'stop_loss': pos.stop_loss,
                'take_profit': pos.take_profit,
                'strategy_id': pos.strategy_id,
                'status': pos.status,
                'pnl': pos.pnl if pos.pnl else 0
            })

        return positions
    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/positions/{strategy_id}")
async def get_strategy_positions(strategy_id: str) -> List[Dict[str, Any]]:
    """Get positions for a specific strategy"""
    try:
        engine = get_strategy_engine()

        if strategy_id not in engine.strategies:
            raise HTTPException(status_code=404, detail="Strategy not found")

        positions = []
        for key, pos in engine.positions.items():
            if pos.strategy_id == strategy_id:
                positions.append({
                    'id': key,
                    'symbol': pos.symbol,
                    'side': pos.side.value,
                    'quantity': pos.quantity,
                    'entry_price': pos.entry_price,
                    'entry_time': pos.entry_time.isoformat(),
                    'stop_loss': pos.stop_loss,
                    'take_profit': pos.take_profit,
                    'status': pos.status,
                    'pnl': pos.pnl if pos.pnl else 0
                })

        return positions
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting positions for strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_strategy_status() -> Dict[str, Any]:
    """Get overall strategy system status"""
    try:
        engine = get_strategy_engine()
        return engine.get_status()
    except Exception as e:
        logger.error(f"Error getting strategy status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{strategy_id}")
async def get_strategy(strategy_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific strategy"""
    try:
        engine = get_strategy_engine()

        if strategy_id not in engine.strategies:
            raise HTTPException(status_code=404, detail="Strategy not found")

        strategy = engine.strategies[strategy_id]
        return {
            'id': strategy_id,
            'config': strategy,
            'status': engine.strategy_status.get(strategy_id, StrategyStatus.IDLE).value,
            'positions': [
                pos for key, pos in engine.positions.items()
                if pos.strategy_id == strategy_id
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reload")
async def reload_strategies() -> Dict[str, str]:
    """Reload strategies from configuration file"""
    try:
        engine = get_strategy_engine()
        engine.reload_strategies()
        return {"message": "Strategies reloaded successfully"}
    except Exception as e:
        logger.error(f"Error reloading strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws")
async def strategy_websocket(websocket: WebSocket):
    """WebSocket endpoint for strategy notifications"""
    await websocket.accept()

    try:
        engine = get_strategy_engine()

        while True:
            # Send periodic status updates
            status = engine.get_status()
            await websocket.send_json({
                'type': 'status_update',
                'data': status
            })

            # Wait for client messages or timeout after 5 seconds
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                message = json.loads(data)

                # Handle client commands
                if message.get('action') == 'enable_strategy':
                    strategy_id = message.get('strategy_id')
                    if strategy_id:
                        engine.strategies[strategy_id]['enabled'] = True
                        engine.save_strategies()
                        await websocket.send_json({
                            'type': 'command_response',
                            'success': True,
                            'message': f"Strategy {strategy_id} enabled"
                        })

                elif message.get('action') == 'disable_strategy':
                    strategy_id = message.get('strategy_id')
                    if strategy_id:
                        engine.strategies[strategy_id]['enabled'] = False
                        engine.save_strategies()
                        await websocket.send_json({
                            'type': 'command_response',
                            'success': True,
                            'message': f"Strategy {strategy_id} disabled"
                        })
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        logger.info("Strategy WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Error in strategy WebSocket: {e}")
        await websocket.close()

import asyncio
