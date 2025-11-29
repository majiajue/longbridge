"""
智能仓位管理 API
根据资金和持仓自动计算买卖数量，生成策略
"""
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import get_positions, get_account_balance
from ..position_calculator import (
    get_position_calculator, 
    PositionCalculation,
    PositionSizeMethod
)
from ..strategy_engine import get_strategy_engine
from ..repositories import fetch_latest_prices
from ..auto_position_manager import get_auto_position_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/position-manager", tags=["position-manager"])

class CalculatePositionRequest(BaseModel):
    """计算仓位请求"""
    symbol: str
    action: str = "buy"  # 'buy' or 'sell'
    method: str = "percentage"  # 'percentage', 'risk_based', 'fixed_amount', 'equal_weight'
    target_allocation: float = 0.1  # 目标仓位比例
    max_risk: float = 0.02  # 最大风险比例
    stop_loss_pct: float = 0.05  # 止损百分比
    sell_percentage: float = 1.0  # 卖出比例

class CalculatePositionResponse(BaseModel):
    """计算仓位响应"""
    symbol: str
    action: str
    quantity: int
    estimated_price: float
    estimated_cost: float
    reason: str
    risk_level: str
    max_loss: float
    suggested_stop_loss: float
    suggested_take_profit: float
    portfolio_status: Dict[str, Any]

class AutoStrategyRequest(BaseModel):
    """自动生成策略请求"""
    symbols: List[str]  # 新增或要监控的股票
    strategy_type: str = "ma_crossover"
    allocation_per_symbol: float = 0.1  # 每个股票的目标配置比例
    auto_execute: bool = False  # 是否自动执行交易

class BatchPositionCalculation(BaseModel):
    """批量仓位计算结果"""
    symbol: str
    current_position: Optional[Dict[str, Any]]
    recommendation: CalculatePositionResponse
    create_strategy: bool

@router.post("/calculate", response_model=CalculatePositionResponse)
async def calculate_position(request: CalculatePositionRequest) -> CalculatePositionResponse:
    """
    计算买卖数量
    根据账户资金、持仓和风险管理自动计算合理的交易数量
    """
    try:
        # 获取账户余额和持仓
        account_balance = get_account_balance()
        current_positions = get_positions()
        
        # 创建计算器
        calculator = get_position_calculator(
            account_balance=account_balance,
            current_positions=current_positions
        )
        
        # 获取当前价格
        prices = fetch_latest_prices([request.symbol])
        current_price = prices.get(request.symbol, 0) if prices else 0
        
        if current_price <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"无法获取 {request.symbol} 的当前价格"
            )
        
        # 转换方法
        try:
            method = PositionSizeMethod(request.method)
        except ValueError:
            method = PositionSizeMethod.PERCENTAGE
        
        # 计算仓位
        if request.action == "buy":
            calculation = calculator.calculate_buy_quantity(
                symbol=request.symbol,
                current_price=current_price,
                method=method,
                target_allocation=request.target_allocation,
                max_risk_per_trade=request.max_risk,
                stop_loss_pct=request.stop_loss_pct
            )
        elif request.action == "sell":
            calculation = calculator.calculate_sell_quantity(
                symbol=request.symbol,
                current_price=current_price,
                sell_percentage=request.sell_percentage
            )
            if not calculation:
                raise HTTPException(
                    status_code=400,
                    detail=f"没有 {request.symbol} 的持仓可以卖出"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的操作: {request.action}"
            )
        
        # 获取组合状态
        portfolio_status = calculator.get_portfolio_status()
        
        return CalculatePositionResponse(
            symbol=calculation.symbol,
            action=calculation.action,
            quantity=calculation.quantity,
            estimated_price=calculation.estimated_price,
            estimated_cost=calculation.estimated_cost,
            reason=calculation.reason,
            risk_level=calculation.risk_level,
            max_loss=calculation.max_loss,
            suggested_stop_loss=calculation.suggested_stop_loss,
            suggested_take_profit=calculation.suggested_take_profit,
            portfolio_status=portfolio_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating position: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auto-strategy", response_model=List[BatchPositionCalculation])
async def create_auto_strategy(request: AutoStrategyRequest) -> List[BatchPositionCalculation]:
    """
    自动生成策略
    根据新增股票和持仓情况，自动计算仓位并生成交易策略
    """
    try:
        # 获取账户余额和持仓
        account_balance = get_account_balance()
        current_positions = get_positions()
        
        # 创建计算器
        calculator = get_position_calculator(
            account_balance=account_balance,
            current_positions=current_positions
        )
        
        # 获取所有股票的当前价格
        prices = fetch_latest_prices(request.symbols)
        
        results = []
        engine = get_strategy_engine()
        
        for symbol in request.symbols:
            current_price = prices.get(symbol, 0) if prices else 0
            
            if current_price <= 0:
                logger.warning(f"无法获取 {symbol} 的价格，跳过")
                continue
            
            # 检查是否已有持仓
            existing_position = None
            for pos in current_positions:
                if pos.get('symbol', '').upper() == symbol.upper():
                    existing_position = pos
                    break
            
            # 计算建议仓位
            calculation = calculator.calculate_buy_quantity(
                symbol=symbol,
                current_price=current_price,
                method=PositionSizeMethod.PERCENTAGE,
                target_allocation=request.allocation_per_symbol,
                max_risk_per_trade=0.02,
                stop_loss_pct=0.05
            )
            
            # 判断是否需要创建策略
            should_create_strategy = False
            
            if not existing_position or float(existing_position.get('qty', 0) or 0) == 0:
                # 没有持仓，需要买入
                should_create_strategy = True
            
            # 如果请求自动创建策略
            if should_create_strategy and request.auto_execute:
                # 检查是否已有该股票的策略
                existing_strategy = None
                for strategy_id, strategy in engine.strategies.items():
                    if symbol in strategy.get('symbols', []):
                        existing_strategy = strategy_id
                        break
                
                if not existing_strategy:
                    # 创建新策略
                    import uuid
                    strategy_id = f"{request.strategy_type}_{uuid.uuid4().hex[:8]}"
                    
                    # 根据计算结果设置风险管理参数
                    new_strategy = {
                        "id": strategy_id,
                        "name": f"自动策略 - {symbol}",
                        "enabled": False,  # 默认不启用，让用户手动启用
                        "description": f"基于资金配置自动生成的策略，目标配置 {request.allocation_per_symbol*100:.1f}%",
                        "symbols": [symbol],
                        "use_optimal_signals": True,
                        "conditions": _get_default_conditions(request.strategy_type),
                        "risk_management": {
                            "stop_loss": 0.05,
                            "take_profit": 0.15,
                            "position_size": request.allocation_per_symbol,
                            "max_positions": 1,
                            "trailing_stop": 0.03
                        }
                    }
                    
                    # 添加到引擎
                    from ..strategy_engine import StrategyStatus
                    engine.strategies[strategy_id] = new_strategy
                    engine.strategy_status[strategy_id] = StrategyStatus.IDLE
                    
                    # 保存配置
                    engine.save_strategies()
                    
                    logger.info(f"自动创建策略: {strategy_id} for {symbol}")
            
            portfolio_status = calculator.get_portfolio_status()
            
            results.append(BatchPositionCalculation(
                symbol=symbol,
                current_position=existing_position,
                recommendation=CalculatePositionResponse(
                    symbol=calculation.symbol,
                    action=calculation.action,
                    quantity=calculation.quantity,
                    estimated_price=calculation.estimated_price,
                    estimated_cost=calculation.estimated_cost,
                    reason=calculation.reason,
                    risk_level=calculation.risk_level,
                    max_loss=calculation.max_loss,
                    suggested_stop_loss=calculation.suggested_stop_loss,
                    suggested_take_profit=calculation.suggested_take_profit,
                    portfolio_status=portfolio_status
                ),
                create_strategy=should_create_strategy
            ))
        
        return results
        
    except Exception as e:
        logger.error(f"Error creating auto strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/portfolio-status")
async def get_portfolio_status() -> Dict[str, Any]:
    """
    获取组合状态
    返回当前资金、持仓和配置建议
    """
    try:
        account_balance = get_account_balance()
        current_positions = get_positions()
        
        calculator = get_position_calculator(
            account_balance=account_balance,
            current_positions=current_positions
        )
        
        status = calculator.get_portfolio_status()
        
        # 添加账户详情
        status['account_balance'] = account_balance
        status['detailed_positions'] = current_positions
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting portfolio status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auto/start")
async def start_auto_manager():
    """启动自动仓位管理"""
    try:
        manager = get_auto_position_manager()
        
        if manager.is_running():
            return {
                "status": "already_running",
                "message": "自动仓位管理已在运行中"
            }
        
        await manager.start()
        
        return {
            "status": "started",
            "message": "自动仓位管理已启动",
            "config": manager.config
        }
    except Exception as e:
        logger.error(f"启动自动仓位管理失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auto/stop")
async def stop_auto_manager():
    """停止自动仓位管理"""
    try:
        manager = get_auto_position_manager()
        
        if not manager.is_running():
            return {
                "status": "already_stopped",
                "message": "自动仓位管理未运行"
            }
        
        await manager.stop()
        
        return {
            "status": "stopped",
            "message": "自动仓位管理已停止"
        }
    except Exception as e:
        logger.error(f"停止自动仓位管理失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auto/status")
async def get_auto_manager_status():
    """获取自动仓位管理状态"""
    try:
        manager = get_auto_position_manager()
        
        # 从数据库读取最新配置（而不是从运行中的 manager）
        from ..db import get_connection
        config = None
        trade_count = 0
        try:
            with get_connection() as conn:
                # 读取配置
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS auto_position_config (
                        id INTEGER PRIMARY KEY,
                        enabled BOOLEAN DEFAULT false,
                        check_interval_minutes INTEGER DEFAULT 30,
                        use_ai_analysis BOOLEAN DEFAULT true,
                        min_ai_confidence DOUBLE DEFAULT 0.7,
                        auto_stop_loss_percent DOUBLE DEFAULT -5.0,
                        auto_take_profit_percent DOUBLE DEFAULT 15.0,
                        auto_rebalance_percent DOUBLE DEFAULT -10.0,
                        max_position_value DOUBLE DEFAULT 50000,
                        position_allocation DOUBLE DEFAULT 0.05,
                        sell_ratio DOUBLE DEFAULT 1.0,
                        enable_real_trading BOOLEAN DEFAULT false,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                row = conn.execute("SELECT * FROM auto_position_config WHERE id = 1").fetchone()
                if row:
                    columns = [desc[0] for desc in conn.description]
                    config = dict(zip(columns, row))
                else:
                    # 返回默认配置
                    config = {
                        'enabled': False,
                        'check_interval_minutes': 30,
                        'use_ai_analysis': True,
                        'min_ai_confidence': 0.7,
                        'auto_stop_loss_percent': -5.0,
                        'auto_take_profit_percent': 15.0,
                        'auto_rebalance_percent': -10.0,
                        'max_position_value': 50000,
                        'position_allocation': 0.05,
                        'sell_ratio': 1.0,
                        'enable_real_trading': False
                    }
                
                # 读取交易历史
                result = conn.execute("""
                    SELECT COUNT(*) FROM auto_position_trades 
                    WHERE DATE(timestamp) = DATE('now')
                """).fetchone()
                trade_count = result[0] if result else 0
        except Exception as e:
            logger.error(f"读取配置失败: {e}", exc_info=True)
            # 使用默认配置
            config = {
                'enabled': False,
                'check_interval_minutes': 30,
                'use_ai_analysis': True,
                'min_ai_confidence': 0.7,
                'auto_stop_loss_percent': -5.0,
                'auto_take_profit_percent': 15.0,
                'auto_rebalance_percent': -10.0,
                'max_position_value': 50000,
                'position_allocation': 0.05,
                'sell_ratio': 1.0,
                'enable_real_trading': False
            }
        
        return {
            "running": manager.is_running(),
            "config": config,
            "today_trades": trade_count,
            "check_interval_minutes": config.get('check_interval_minutes', 30),
            "recent_logs": manager.get_recent_logs()  # 添加运行日志
        }
    except Exception as e:
        logger.error(f"获取状态失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/auto/config")
async def update_auto_config(config_update: Dict[str, Any]):
    """更新自动仓位管理配置"""
    try:
        from ..db import get_connection
        
        with get_connection() as conn:
            # 创建表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS auto_position_config (
                    id INTEGER PRIMARY KEY,
                    enabled BOOLEAN DEFAULT false,
                    check_interval_minutes INTEGER DEFAULT 30,
                    use_ai_analysis BOOLEAN DEFAULT true,
                    min_ai_confidence DOUBLE DEFAULT 0.7,
                    auto_stop_loss_percent DOUBLE DEFAULT -5.0,
                    auto_take_profit_percent DOUBLE DEFAULT 15.0,
                    auto_rebalance_percent DOUBLE DEFAULT -10.0,
                    max_position_value DOUBLE DEFAULT 50000,
                    position_allocation DOUBLE DEFAULT 0.05,
                    sell_ratio DOUBLE DEFAULT 1.0,
                    enable_real_trading BOOLEAN DEFAULT false,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 检查是否存在
            exists = conn.execute("SELECT id FROM auto_position_config WHERE id = 1").fetchone()
            
            if exists:
                # 更新
                update_fields = []
                update_values = []
                for key, value in config_update.items():
                    # 排除 id 和 updated_at，因为 updated_at 会自动设置
                    if key not in ('id', 'updated_at'):
                        update_fields.append(f"{key} = ?")
                        update_values.append(value)
                
                if update_fields:
                    update_values.append(1)  # id
                    conn.execute(
                        f"UPDATE auto_position_config SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        update_values
                    )
            else:
                # 插入
                fields = ['id'] + list(config_update.keys())
                values = [1] + list(config_update.values())
                placeholders = ','.join(['?'] * len(fields))
                conn.execute(
                    f"INSERT INTO auto_position_config ({','.join(fields)}) VALUES ({placeholders})",
                    values
                )
        
        # 如果正在运行，需要重启
        manager = get_auto_position_manager()
        if manager.is_running():
            logger.info("配置已更新，重启管理器...")
            await manager.stop()
            await manager.start()
        
        return {
            "status": "success",
            "message": "配置已更新"
        }
    except Exception as e:
        logger.error(f"更新配置失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auto/trades")
async def get_auto_trades(limit: int = 50):
    """获取自动交易记录"""
    try:
        from ..db import get_connection
        
        with get_connection() as conn:
            # 确保表存在（更新字段）
            conn.execute("""
                CREATE TABLE IF NOT EXISTS auto_position_trades (
                    id INTEGER PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    action TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    price DOUBLE NOT NULL,
                    total_value DOUBLE NOT NULL,
                    reason TEXT,
                    status TEXT DEFAULT 'SIMULATION',
                    order_id TEXT,
                    error_message TEXT
                )
            """)
            
            rows = conn.execute("""
                SELECT * FROM auto_position_trades 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (limit,)).fetchall()
            
            columns = [desc[0] for desc in conn.description]
            trades = [dict(zip(columns, row)) for row in rows]
            
        return {
            "total": len(trades),
            "trades": trades
        }
    except Exception as e:
        logger.error(f"获取交易记录失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/klines/{symbol}")
async def get_position_klines(
    symbol: str,
    limit: int = 100
):
    """获取用于智能仓位管理的K线数据"""
    try:
        from ..services import get_cached_candlesticks
        
        klines = get_cached_candlesticks(
            symbol=symbol,
            limit=limit
        )
        
        if not klines:
            raise HTTPException(
                status_code=404,
                detail=f"没有找到 {symbol} 的K线数据，请先在「历史数据」页面同步"
            )
        
        return {
            "symbol": symbol,
            "count": len(klines),
            "klines": klines
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get klines for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def _get_default_conditions(strategy_type: str) -> Dict[str, List[Dict]]:
    """获取默认策略条件"""
    templates = {
        "ma_crossover": {
            "buy": [
                {
                    "type": "ma_crossover",
                    "params": {
                        "short_period": 5,
                        "long_period": 20,
                        "direction": "golden_cross"
                    }
                }
            ],
            "sell": [
                {
                    "type": "ma_crossover",
                    "params": {
                        "short_period": 5,
                        "long_period": 20,
                        "direction": "death_cross"
                    }
                }
            ]
        },
        "rsi_oversold": {
            "buy": [
                {
                    "type": "rsi",
                    "params": {
                        "period": 14,
                        "oversold": 30,
                        "operator": "less_than"
                    }
                }
            ],
            "sell": [
                {
                    "type": "rsi",
                    "params": {
                        "period": 14,
                        "overbought": 70,
                        "operator": "greater_than"
                    }
                }
            ]
        }
    }
    
    return templates.get(strategy_type, templates["ma_crossover"])



