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
            market_data = MarketData(
                symbol=symbol,
                open=candle['open'],
                high=candle['high'],
                low=candle['low'],
                close=candle['close'],
                volume=candle['volume'],
                timestamp=datetime.fromtimestamp(candle['ts'])
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
    """获取市场概览和信号统计"""
    try:
        # Get configured symbols
        symbols = load_symbols()
        if not symbols:
            return {
                "total_symbols": 0,
                "signals_summary": {},
                "message": "No symbols configured"
            }

        # Analyze all symbols
        buy_signals = []
        sell_signals = []
        analysis_errors = 0

        for symbol in symbols[:10]:  # Limit to first 10 symbols to avoid timeout
            try:
                analysis = await analyze_symbol_signals(symbol, "both", 30)

                if analysis["signals"]["buy"]:
                    buy_signals.append({
                        "symbol": symbol,
                        **analysis["signals"]["buy"]
                    })

                if analysis["signals"]["sell"]:
                    sell_signals.append({
                        "symbol": symbol,
                        **analysis["signals"]["sell"]
                    })

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
            "total_symbols": len(symbols),
            "analyzed_symbols": len(symbols) - analysis_errors,
            "analysis_errors": analysis_errors,
            "signals_summary": {
                "buy_signals": {
                    "total": len(buy_signals),
                    "strong": len(strong_buy_signals),
                    "average_confidence": sum(s["confidence"] for s in buy_signals) / len(buy_signals) if buy_signals else 0,
                    "top_signals": top_buy_signals
                },
                "sell_signals": {
                    "total": len(sell_signals),
                    "strong": len(strong_sell_signals),
                    "average_confidence": sum(s["confidence"] for s in sell_signals) / len(sell_signals) if sell_signals else 0,
                    "top_signals": top_sell_signals
                }
            },
            "market_sentiment": {
                "bullish_ratio": len(buy_signals) / (len(buy_signals) + len(sell_signals)) if (buy_signals or sell_signals) else 0.5,
                "sentiment_score": (len(strong_buy_signals) - len(strong_sell_signals)) / max(1, len(symbols))
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