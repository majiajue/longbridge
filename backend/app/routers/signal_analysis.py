"""
智能买卖点分析API
提供最佳买卖点分析和建议
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging

from ..optimal_trading_signals import get_optimal_signals, TradingSignal
from ..strategy_engine import get_strategy_engine, MarketData, KLineBuffer
from ..services import get_cached_candlesticks
from ..repositories import load_symbols

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/signals", tags=["signal_analysis"])

@router.get("/analyze/{symbol}")
async def analyze_symbol_signals(
    symbol: str,
    signal_type: str = Query("both", description="Signal type: buy, sell, or both"),
    lookback_days: int = Query(30, description="Historical data lookback days")
) -> Dict[str, Any]:
    """分析指定股票的买卖点信号"""
    try:
        # Get historical data
        candlesticks = get_cached_candlesticks(symbol, limit=lookback_days * 24)  # Assuming hourly data

        if not candlesticks:
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")

        # Create mock buffer and market data for analysis
        buffer = KLineBuffer(symbol=symbol, max_size=len(candlesticks))

        for candle in reversed(candlesticks):  # Reverse to get chronological order
            # Robust timestamp handling: support datetime, numeric epoch (s or ms), or ISO string
            ts_raw = candle.get('ts')
            ts_dt: datetime
            if isinstance(ts_raw, datetime):
                ts_dt = ts_raw
            else:
                try:
                    # If it's a large integer, assume ms; otherwise seconds
                    if isinstance(ts_raw, (int, float)):
                        ts_val = float(ts_raw)
                        if ts_val > 1e12:  # ms epoch
                            ts_dt = datetime.fromtimestamp(ts_val / 1000.0)
                        else:
                            ts_dt = datetime.fromtimestamp(ts_val)
                    else:
                        ts_dt = datetime.fromisoformat(str(ts_raw))
                except Exception:
                    ts_dt = datetime.now()

            market_data = MarketData(
                symbol=symbol,
                open=candle['open'],
                high=candle['high'],
                low=candle['low'],
                close=candle['close'],
                volume=candle['volume'],
                timestamp=ts_dt,
            )
            buffer.add(market_data)

        if len(buffer.data) < 50:
            raise HTTPException(status_code=400, detail="Insufficient data for analysis")

        # Get current market data (latest candle)
        current_data = buffer.data[-1]

        # Get optimal signals analyzer
        analyzer = get_optimal_signals()

        result = {
            "symbol": symbol,
            "analysis_time": datetime.now().isoformat(),
            "data_points": len(buffer.data),
            "current_price": current_data.close,
            "signals": {}
        }

        # Mock strategy config for analysis
        strategy_config = {
            "risk_management": {
                "stop_loss": 0.05,
                "take_profit": 0.15,
                "position_size": 0.1
            }
        }

        # Analyze buy signals
        if signal_type in ["buy", "both"]:
            buy_signal = analyzer.analyze_optimal_entry(symbol, buffer, current_data, strategy_config)
            if buy_signal:
                result["signals"]["buy"] = {
                    "confidence": buy_signal.confidence,
                    "strength": buy_signal.strength.name,
                    "price": buy_signal.price,
                    "factors": buy_signal.factors,
                    "reason": buy_signal.reason,
                    "stop_loss": buy_signal.stop_loss,
                    "take_profit": buy_signal.take_profit,
                    "position_size": buy_signal.position_size,
                    "timestamp": buy_signal.timestamp.isoformat()
                }
            else:
                result["signals"]["buy"] = None

        # Analyze sell signals (mock entry for analysis)
        if signal_type in ["sell", "both"]:
            # Use price from 5 days ago as mock entry
            mock_entry_price = buffer.data[-5].close if len(buffer.data) >= 5 else current_data.close
            mock_entry_time = buffer.data[-5].timestamp if len(buffer.data) >= 5 else current_data.timestamp

            sell_signal = analyzer.analyze_optimal_exit(
                symbol, buffer, current_data, mock_entry_price, mock_entry_time, strategy_config
            )
            if sell_signal:
                result["signals"]["sell"] = {
                    "confidence": sell_signal.confidence,
                    "strength": sell_signal.strength.name,
                    "price": sell_signal.price,
                    "factors": sell_signal.factors,
                    "reason": sell_signal.reason,
                    "timestamp": sell_signal.timestamp.isoformat(),
                    "mock_entry_price": mock_entry_price,
                    "mock_pnl_pct": ((current_data.close - mock_entry_price) / mock_entry_price) * 100
                }
            else:
                result["signals"]["sell"] = None

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing signals for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analyze/batch")
async def analyze_batch_signals(
    symbols: str = Query(..., description="Comma-separated symbol list"),
    signal_type: str = Query("buy", description="Signal type: buy or sell"),
    min_confidence: float = Query(0.6, description="Minimum confidence threshold")
) -> List[Dict[str, Any]]:
    """批量分析多个股票的信号"""
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        results = []

        for symbol in symbol_list:
            try:
                # Get basic analysis for each symbol
                analysis = await analyze_symbol_signals(symbol, signal_type, 30)

                # Filter by confidence
                signal_data = analysis["signals"].get(signal_type)
                if signal_data and signal_data["confidence"] >= min_confidence:
                    results.append({
                        "symbol": symbol,
                        "current_price": analysis["current_price"],
                        "signal": signal_data
                    })

            except Exception as e:
                logger.warning(f"Failed to analyze {symbol}: {e}")
                continue

        # Sort by confidence desc
        results.sort(key=lambda x: x["signal"]["confidence"], reverse=True)

        return results

    except Exception as e:
        logger.error(f"Error in batch signal analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market_overview")
async def get_market_overview() -> Dict[str, Any]:
    """获取基于实际持仓的市场概览和信号统计"""
    try:
        # Get actual positions
        from ..services import get_positions
        positions = get_positions()

        # Get configured symbols for monitoring
        symbols = load_symbols()

        # Create symbol sets for different analysis
        held_symbols = {pos['symbol'] for pos in positions if pos.get('qty', 0) != 0}
        monitored_symbols = set(symbols) if symbols else set()
        all_analysis_symbols = held_symbols.union(monitored_symbols)

        if not all_analysis_symbols:
            return {
                "total_symbols": 0,
                "signals_summary": {},
                "message": "No positions or configured symbols found"
            }

        # Analyze symbols based on position status
        buy_signals = []   # For symbols not held
        sell_signals = []  # For symbols currently held
        analysis_errors = 0

        for symbol in list(all_analysis_symbols)[:15]:  # Limit to avoid timeout
            try:
                # Check if we currently hold this symbol
                position = next((pos for pos in positions if pos['symbol'] == symbol), None)
                is_held = position and position.get('qty', 0) != 0

                if is_held:
                    # For held positions, only analyze sell signals
                    analysis = await analyze_symbol_signals(symbol, "sell", 30)
                    if analysis["signals"]["sell"]:
                        sell_signal = {
                            "symbol": symbol,
                            "position_qty": position.get('qty', 0),
                            "avg_cost": position.get('avg_price', 0),
                            "current_pnl": position.get('pnl', 0) if 'pnl' in position else 0,
                            **analysis["signals"]["sell"]
                        }
                        sell_signals.append(sell_signal)
                else:
                    # For non-held symbols, only analyze buy signals
                    analysis = await analyze_symbol_signals(symbol, "buy", 30)
                    if analysis["signals"]["buy"]:
                        buy_signal = {
                            "symbol": symbol,
                            "is_new_opportunity": True,
                            **analysis["signals"]["buy"]
                        }
                        buy_signals.append(buy_signal)

            except Exception:
                analysis_errors += 1
                continue

        # Calculate statistics
        strong_buy_signals = [s for s in buy_signals if s["confidence"] >= 0.8]
        strong_sell_signals = [s for s in sell_signals if s["confidence"] >= 0.8]

        # Get top signals
        top_buy_signals = sorted(buy_signals, key=lambda x: x["confidence"], reverse=True)[:5]
        top_sell_signals = sorted(sell_signals, key=lambda x: x["confidence"], reverse=True)[:5]

        return {
            "analysis_time": datetime.now().isoformat(),
            "total_positions": len(held_symbols),
            "total_monitored": len(monitored_symbols),
            "analyzed_symbols": len(all_analysis_symbols) - analysis_errors,
            "analysis_errors": analysis_errors,
            "portfolio_summary": {
                "held_positions": len(held_symbols),
                "profitable_positions": len([pos for pos in positions if pos.get('pnl', 0) > 0]),
                "losing_positions": len([pos for pos in positions if pos.get('pnl', 0) < 0]),
                "total_pnl": sum(pos.get('pnl', 0) for pos in positions)
            },
            "signals_summary": {
                "sell_signals": {
                    "total": len(sell_signals),
                    "strong": len(strong_sell_signals),
                    "average_confidence": sum(s["confidence"] for s in sell_signals) / len(sell_signals) if sell_signals else 0,
                    "top_signals": top_sell_signals,
                    "description": "基于当前持仓的卖出建议"
                },
                "buy_signals": {
                    "total": len(buy_signals),
                    "strong": len(strong_buy_signals),
                    "average_confidence": sum(s["confidence"] for s in buy_signals) / len(buy_signals) if buy_signals else 0,
                    "top_signals": top_buy_signals,
                    "description": "新的买入机会"
                }
            },
            "market_sentiment": {
                "action_bias": "sell_focused" if len(sell_signals) > len(buy_signals) else "buy_focused",
                "risk_level": "high" if len(strong_sell_signals) > 2 else "normal",
                "opportunity_score": len(strong_buy_signals) * 10 + len(buy_signals) * 5
            }
        }

    except Exception as e:
        logger.error(f"Error generating market overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/factors_explanation")
async def get_factors_explanation() -> Dict[str, Any]:
    """获取买卖点因子的说明"""
    return {
        "buy_factors": {
            "trend_alignment": {
                "name": "趋势一致性",
                "description": "分析价格是否与主要趋势方向一致",
                "range": "0-100",
                "interpretation": "高分表示趋势向上，适合买入"
            },
            "momentum": {
                "name": "动量指标",
                "description": "结合RSI、MACD等动量指标",
                "range": "0-100",
                "interpretation": "高分表示动量积极，有上涨潜力"
            },
            "mean_reversion": {
                "name": "均值回归机会",
                "description": "价格偏离均值的程度，寻找回归机会",
                "range": "0-100",
                "interpretation": "高分表示价格被低估，有回归空间"
            },
            "volume_confirmation": {
                "name": "成交量确认",
                "description": "成交量是否支持价格走势",
                "range": "0-100",
                "interpretation": "高分表示成交量放大，确认买入信号"
            },
            "support_resistance": {
                "name": "支撑阻力位置",
                "description": "价格在支撑阻力位的位置关系",
                "range": "0-100",
                "interpretation": "高分表示接近强支撑位，风险较低"
            },
            "market_sentiment": {
                "name": "市场情绪",
                "description": "基于K线形态的市场情绪指标",
                "range": "0-100",
                "interpretation": "高分表示市场情绪乐观"
            }
        },
        "sell_factors": {
            "profit_taking": {
                "name": "获利了结时机",
                "description": "基于盈利情况和持有时间判断",
                "range": "0-100",
                "interpretation": "高分表示适合获利了结"
            },
            "trend_reversal": {
                "name": "趋势反转信号",
                "description": "识别趋势反转的早期信号",
                "range": "0-100",
                "interpretation": "高分表示趋势可能反转"
            },
            "momentum_divergence": {
                "name": "动量背离",
                "description": "价格与动量指标的背离情况",
                "range": "0-100",
                "interpretation": "高分表示动量背离，谨慎持有"
            },
            "resistance_rejection": {
                "name": "阻力位拒绝",
                "description": "价格在阻力位的表现",
                "range": "0-100",
                "interpretation": "高分表示遭遇强阻力，考虑卖出"
            },
            "risk_management": {
                "name": "风险管理",
                "description": "基于亏损和波动率的风险评估",
                "range": "0-100",
                "interpretation": "高分表示需要控制风险"
            }
        },
        "signal_strength": {
            "VERY_WEAK": "信号很弱，不建议操作",
            "WEAK": "信号较弱，谨慎操作",
            "NEUTRAL": "信号中性，可观望",
            "STRONG": "信号较强，可考虑操作",
            "VERY_STRONG": "信号很强，建议操作"
        },
        "confidence_levels": {
            "0.9+": "极高置信度，强烈建议",
            "0.8-0.9": "高置信度，建议操作",
            "0.7-0.8": "中高置信度，可操作",
            "0.6-0.7": "中等置信度，谨慎操作",
            "0.6以下": "低置信度，不建议操作"
        }
    }

@router.get("/portfolio/positions")
async def analyze_portfolio_positions() -> Dict[str, Any]:
    """基于实际持仓分析所有持仓的买卖信号"""
    try:
        from ..services import get_positions
        positions = get_positions()

        if not positions:
            return {
                "message": "No positions found",
                "positions_analysis": []
            }

        analysis_results = []

        for position in positions:
            symbol = position['symbol']
            qty = position.get('qty', 0)

            # Skip zero positions
            if qty == 0:
                continue

            try:
                # Analyze sell signal for current position
                analysis = await analyze_symbol_signals(symbol, "sell", 30)

                # Calculate position info
                avg_cost = position.get('avg_price', 0)
                current_price = analysis.get('current_price', avg_cost)
                pnl_amount = (current_price - avg_cost) * qty if avg_cost > 0 else 0
                pnl_percent = ((current_price - avg_cost) / avg_cost * 100) if avg_cost > 0 else 0

                position_analysis = {
                    "symbol": symbol,
                    "symbol_name": position.get('symbol_name', symbol),
                    "position_info": {
                        "quantity": qty,
                        "avg_cost": avg_cost,
                        "current_price": current_price,
                        "pnl_amount": pnl_amount,
                        "pnl_percent": pnl_percent,
                        "market_value": current_price * qty,
                        "direction": "long" if qty > 0 else "short",
                        "currency": position.get('currency', 'USD')
                    },
                    "sell_signal": analysis.get("signals", {}).get("sell"),
                    "recommendation": None,
                    "risk_level": "low"
                }

                # Generate recommendation based on signal and position status
                sell_signal = position_analysis["sell_signal"]
                if sell_signal:
                    confidence = sell_signal.get("confidence", 0)
                    if confidence >= 0.8:
                        if pnl_percent > 10:
                            position_analysis["recommendation"] = "强烈建议获利了结"
                            position_analysis["risk_level"] = "low"
                        elif pnl_percent < -5:
                            position_analysis["recommendation"] = "建议止损"
                            position_analysis["risk_level"] = "high"
                        else:
                            position_analysis["recommendation"] = "建议卖出"
                            position_analysis["risk_level"] = "medium"
                    elif confidence >= 0.6:
                        position_analysis["recommendation"] = "可考虑减仓"
                        position_analysis["risk_level"] = "medium"
                else:
                    if pnl_percent > 15:
                        position_analysis["recommendation"] = "继续持有，可考虑部分获利"
                    elif pnl_percent < -10:
                        position_analysis["recommendation"] = "关注风险，考虑止损"
                        position_analysis["risk_level"] = "high"
                    else:
                        position_analysis["recommendation"] = "继续持有"

                analysis_results.append(position_analysis)

            except Exception as e:
                logger.warning(f"Failed to analyze position {symbol}: {e}")
                # Add basic position info even if analysis fails
                analysis_results.append({
                    "symbol": symbol,
                    "position_info": {
                        "quantity": qty,
                        "avg_cost": position.get('avg_price', 0),
                        "current_price": position.get('avg_price', 0),
                        "direction": "long" if qty > 0 else "short"
                    },
                    "sell_signal": None,
                    "recommendation": "分析失败",
                    "error": str(e)
                })

        # Sort by risk level and PnL
        def sort_key(item):
            risk_score = {"high": 3, "medium": 2, "low": 1}.get(item.get("risk_level", "low"), 1)
            pnl_percent = item.get("position_info", {}).get("pnl_percent", 0)
            return (-risk_score, -abs(pnl_percent))  # High risk first, then by absolute PnL

        analysis_results.sort(key=sort_key)

        # Generate summary
        total_positions = len(analysis_results)
        profitable_positions = len([p for p in analysis_results if p.get("position_info", {}).get("pnl_percent", 0) > 0])
        high_risk_positions = len([p for p in analysis_results if p.get("risk_level") == "high"])
        def _conf(p: Dict[str, Any]) -> float:
            s = p.get("sell_signal")
            return float(s.get("confidence", 0)) if isinstance(s, dict) else 0.0

        strong_sell_signals = len([p for p in analysis_results if _conf(p) >= 0.8])

        return {
            "analysis_time": datetime.now().isoformat(),
            "portfolio_summary": {
                "total_positions": total_positions,
                "profitable_positions": profitable_positions,
                "losing_positions": total_positions - profitable_positions,
                "high_risk_positions": high_risk_positions,
                "strong_sell_signals": strong_sell_signals,
                "total_market_value": sum(p.get("position_info", {}).get("market_value", 0) for p in analysis_results),
                "total_pnl": sum(p.get("position_info", {}).get("pnl_amount", 0) for p in analysis_results)
            },
            "positions_analysis": analysis_results,
            "recommendations": {
                "immediate_action": [p for p in analysis_results if p.get("risk_level") == "high"],
                "profit_taking": [p for p in analysis_results if p.get("position_info", {}).get("pnl_percent", 0) > 10 and _conf(p) >= 0.7],
                "hold_positions": [p for p in analysis_results if str(p.get("recommendation", "")).startswith("继续持有")]
            }
        }

    except Exception as e:
        logger.error(f"Error analyzing portfolio positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/strategy/{strategy_id}/signals")
async def get_strategy_signals(strategy_id: str) -> Dict[str, Any]:
    """获取特定策略的信号分析"""
    try:
        strategy_engine = get_strategy_engine()

        # Get strategy configuration
        if strategy_id not in strategy_engine.strategies:
            raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")

        strategy = strategy_engine.strategies[strategy_id]
        symbols = strategy.get('symbols', [])

        if not symbols:
            return {
                "strategy_id": strategy_id,
                "strategy_name": strategy.get('name', ''),
                "message": "No symbols configured for this strategy"
            }

        # Analyze signals for strategy symbols
        signals = []
        for symbol in symbols:
            try:
                analysis = await analyze_symbol_signals(symbol, "buy", 30)
                if analysis["signals"]["buy"]:
                    signals.append({
                        "symbol": symbol,
                        "current_price": analysis["current_price"],
                        **analysis["signals"]["buy"]
                    })
            except Exception as e:
                logger.warning(f"Failed to analyze {symbol} for strategy {strategy_id}: {e}")
                continue

        # Sort by confidence
        signals.sort(key=lambda x: x["confidence"], reverse=True)

        return {
            "strategy_id": strategy_id,
            "strategy_name": strategy.get('name', ''),
            "strategy_enabled": strategy.get('enabled', False),
            "symbols": symbols,
            "analysis_time": datetime.now().isoformat(),
            "signals": signals,
            "summary": {
                "total_signals": len(signals),
                "high_confidence_signals": len([s for s in signals if s["confidence"] >= 0.8]),
                "average_confidence": sum(s["confidence"] for s in signals) / len(signals) if signals else 0,
                "top_opportunity": signals[0] if signals else None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting strategy signals for {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
