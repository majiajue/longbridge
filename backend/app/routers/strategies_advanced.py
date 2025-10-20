"""
Advanced Trading Strategies API
提供买低卖高和 EMA 等高级策略
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ..strategies import BuyLowSellHighStrategy, EMACrossoverStrategy
from ..services import get_cached_candlesticks
from ..repositories import load_symbols

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategies/advanced", tags=["strategies"])


@router.get("/buy-low-sell-high/analyze")
async def analyze_buy_low_sell_high(
    symbol: str,
    lookback_window: int = Query(5, ge=3, le=20),
    min_wave_amplitude: float = Query(0.02, ge=0.01, le=0.1),
    limit: int = Query(200, ge=50, le=1000)
) -> Dict[str, Any]:
    """
    分析买低卖高策略
    
    Args:
        symbol: 股票代码
        lookback_window: 波峰波谷检测窗口
        min_wave_amplitude: 最小波幅
        limit: K 线数量
    """
    try:
        # 获取历史数据
        bars = get_cached_candlesticks(
            symbol=symbol,
            limit=limit
        )
        
        if not bars:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        # 提取数据
        prices = [bar.get("close", 0) for bar in bars if bar.get("close")]
        volumes = [bar.get("volume", 0) for bar in bars if bar.get("volume")]
        highs = [bar.get("high", 0) for bar in bars if bar.get("high")]
        lows = [bar.get("low", 0) for bar in bars if bar.get("low")]
        timestamps = [bar.get("ts") for bar in bars]
        
        # 创建策略实例
        strategy = BuyLowSellHighStrategy(
            lookback_window=lookback_window,
            min_wave_amplitude=min_wave_amplitude
        )
        
        # 回测分析
        summary = strategy.backtest_summary(prices, volumes, highs, lows)
        
        # 生成当前信号
        current_signal = strategy.generate_signal(
            prices=prices,
            volumes=volumes,
            highs=highs,
            lows=lows,
            current_position=0  # 假设空仓
        )
        
        return {
            "symbol": symbol,
            "strategy": strategy.name,
            "parameters": {
                "lookback_window": lookback_window,
                "min_wave_amplitude": min_wave_amplitude
            },
            "summary": summary,
            "current_signal": current_signal,
            "last_updated": timestamps[-1] if timestamps else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing buy-low-sell-high for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ema-crossover/analyze")
async def analyze_ema_crossover(
    symbol: str,
    fast_period: int = Query(12, ge=5, le=50),
    slow_period: int = Query(26, ge=10, le=200),
    signal_period: int = Query(9, ge=5, le=20),
    limit: int = Query(200, ge=50, le=1000)
) -> Dict[str, Any]:
    """
    分析 EMA 交叉策略
    
    Args:
        symbol: 股票代码
        fast_period: 快线周期
        slow_period: 慢线周期
        signal_period: 信号线周期
        limit: K 线数量
    """
    try:
        # 获取历史数据
        bars = get_cached_candlesticks(
            symbol=symbol,
            limit=limit
        )
        
        if not bars:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        # 提取数据
        prices = [bar.get("close", 0) for bar in bars if bar.get("close")]
        volumes = [bar.get("volume", 0) for bar in bars if bar.get("volume")]
        timestamps = [bar.get("ts") for bar in bars]
        
        # 创建策略实例
        strategy = EMACrossoverStrategy(
            fast_period=fast_period,
            slow_period=slow_period,
            signal_period=signal_period
        )
        
        # 计算指标
        fast_ema = strategy.calculate_ema(prices, fast_period)
        slow_ema = strategy.calculate_ema(prices, slow_period)
        macd_data = strategy.calculate_macd(prices)
        trend_info = strategy.get_current_trend(prices)
        
        # 生成当前信号
        current_signal = strategy.generate_signal(
            prices=prices,
            volumes=volumes,
            current_position=0
        )
        
        # 准备EMA数据（最近50个点用于图表）
        chart_length = min(50, len(prices))
        offset_fast = len(prices) - len(fast_ema)
        offset_slow = len(prices) - len(slow_ema)
        
        chart_data = {
            "timestamps": timestamps[-chart_length:],
            "prices": prices[-chart_length:],
            "fast_ema": fast_ema[-chart_length + offset_fast:] if len(fast_ema) >= chart_length - offset_fast else [],
            "slow_ema": slow_ema[-chart_length + offset_slow:] if len(slow_ema) >= chart_length - offset_slow else [],
        }
        
        return {
            "symbol": symbol,
            "strategy": strategy.name,
            "parameters": {
                "fast_period": fast_period,
                "slow_period": slow_period,
                "signal_period": signal_period
            },
            "trend": trend_info,
            "macd": {
                "macd_line": macd_data["macd_line"][-10:] if macd_data["macd_line"] else [],
                "signal_line": macd_data["signal_line"][-10:] if macd_data["signal_line"] else [],
                "histogram": macd_data["histogram"][-10:] if macd_data["histogram"] else []
            },
            "current_signal": current_signal,
            "chart_data": chart_data,
            "last_updated": timestamps[-1] if timestamps else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing EMA crossover for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/multi-strategy/analyze")
async def analyze_multi_strategy(
    symbol: str,
    limit: int = Query(200, ge=50, le=1000)
) -> Dict[str, Any]:
    """
    多策略综合分析
    
    同时运行买低卖高和 EMA 策略，提供综合建议
    """
    try:
        # 获取历史数据
        bars = get_cached_candlesticks(
            symbol=symbol,
            limit=limit
        )
        
        if not bars:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        # 提取数据
        prices = [bar.get("close", 0) for bar in bars if bar.get("close")]
        volumes = [bar.get("volume", 0) for bar in bars if bar.get("volume")]
        highs = [bar.get("high", 0) for bar in bars if bar.get("high")]
        lows = [bar.get("low", 0) for bar in bars if bar.get("low")]
        
        # 策略 1: 买低卖高
        strategy_low_high = BuyLowSellHighStrategy()
        signal_low_high = strategy_low_high.generate_signal(
            prices=prices,
            volumes=volumes,
            highs=highs,
            lows=lows,
            current_position=0
        )
        
        # 策略 2: EMA 交叉
        strategy_ema = EMACrossoverStrategy()
        signal_ema = strategy_ema.generate_signal(
            prices=prices,
            volumes=volumes,
            current_position=0
        )
        
        # 综合判断
        consensus = _calculate_consensus([signal_low_high, signal_ema])
        
        return {
            "symbol": symbol,
            "strategies": [
                {
                    "name": strategy_low_high.name,
                    "signal": signal_low_high
                },
                {
                    "name": strategy_ema.name,
                    "signal": signal_ema
                }
            ],
            "consensus": consensus,
            "recommendation": _generate_recommendation(consensus),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in multi-strategy analysis for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlist/signals")
async def get_watchlist_signals() -> Dict[str, Any]:
    """
    获取持仓股票 + 手工监控股票的策略信号
    优先显示持仓股票，然后是手工添加的股票
    """
    try:
        from ..services import get_portfolio_overview
        
        # 1. 获取持仓股票
        portfolio = get_portfolio_overview()
        position_symbols = set()
        if portfolio and portfolio.get('positions'):
            position_symbols = {pos['symbol'] for pos in portfolio['positions']}
        
        # 2. 获取手工配置的股票
        manual_symbols = set(load_symbols())
        
        # 3. 合并去重（持仓优先）
        all_symbols = list(position_symbols) + [s for s in manual_symbols if s not in position_symbols]
        
        if not all_symbols:
            return {
                "total": 0,
                "signals": [],
                "message": "暂无持仓或监控股票，请在「基础配置」添加或持有股票"
            }
        
        all_signals = []
        
        for symbol in all_symbols:
            try:
                # 获取数据
                bars = get_cached_candlesticks(
                    symbol=symbol,
                    limit=100
                )
                
                if not bars or len(bars) < 30:
                    logger.debug(f"Skipping {symbol}: insufficient data")
                    continue
                
                prices = [bar.get("close", 0) for bar in bars if bar.get("close")]
                volumes = [bar.get("volume", 0) for bar in bars if bar.get("volume")]
                highs = [bar.get("high", 0) for bar in bars if bar.get("high")]
                lows = [bar.get("low", 0) for bar in bars if bar.get("low")]
                
                # 判断是否持仓
                is_position = symbol in position_symbols
                current_position = 1 if is_position else 0
                
                # 运行策略
                strategy_low_high = BuyLowSellHighStrategy()
                strategy_ema = EMACrossoverStrategy()
                
                signal_low_high = strategy_low_high.generate_signal(
                    prices, volumes, highs, lows, current_position
                )
                signal_ema = strategy_ema.generate_signal(prices, volumes, current_position)
                
                # 构建信号对象（即使没有信号也显示）
                signal_item = {
                    "symbol": symbol,
                    "current_price": prices[-1] if prices else 0,
                    "is_position": is_position,  # 标记是否持仓
                    "signals": {
                        "buy_low_sell_high": signal_low_high,
                        "ema_crossover": signal_ema
                    },
                    "consensus": _calculate_consensus([signal_low_high, signal_ema])
                }
                
                all_signals.append(signal_item)
            
            except Exception as e:
                logger.warning(f"Error processing {symbol}: {e}")
                continue
        
        # 排序：持仓股票优先，然后按置信度
        all_signals.sort(
            key=lambda x: (
                not x.get("is_position", False),  # False (持仓) 排前面
                -x.get("consensus", {}).get("confidence", 0)  # 置信度降序
            )
        )
        
        return {
            "total": len(all_signals),
            "position_count": len(position_symbols),
            "manual_count": len(manual_symbols - position_symbols),
            "signals": all_signals,
            "generated_at": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting watchlist signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _calculate_consensus(signals: List[Optional[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    计算多个策略的共识
    """
    valid_signals = [s for s in signals if s is not None]
    
    if not valid_signals:
        return {
            "action": None,
            "confidence": 0.0,
            "agreement": 0.0,
            "count": 0
        }
    
    # 统计买入和卖出信号
    buy_signals = [s for s in valid_signals if s.get("action") == "BUY"]
    sell_signals = [s for s in valid_signals if s.get("action") == "SELL"]
    
    # 确定共识动作
    if len(buy_signals) > len(sell_signals):
        consensus_action = "BUY"
        agreement = len(buy_signals) / len(valid_signals)
        avg_confidence = sum(s.get("confidence", 0.5) for s in buy_signals) / len(buy_signals)
    elif len(sell_signals) > len(buy_signals):
        consensus_action = "SELL"
        agreement = len(sell_signals) / len(valid_signals)
        avg_confidence = sum(s.get("confidence", 0.5) for s in sell_signals) / len(sell_signals)
    else:
        consensus_action = "HOLD"
        agreement = 0.5
        avg_confidence = 0.5
    
    return {
        "action": consensus_action,
        "confidence": avg_confidence * agreement,  # 综合置信度
        "agreement": agreement,
        "count": len(valid_signals),
        "buy_count": len(buy_signals),
        "sell_count": len(sell_signals)
    }


def _generate_recommendation(consensus: Dict[str, Any]) -> str:
    """
    生成人类可读的建议
    """
    action = consensus.get("action")
    confidence = consensus.get("confidence", 0)
    agreement = consensus.get("agreement", 0)
    
    if not action or action == "HOLD":
        return "暂无明确信号，建议观望"
    
    strength = "强烈" if confidence > 0.7 else "谨慎"
    agreement_desc = f"({int(agreement * 100)}% 策略一致)"
    
    if action == "BUY":
        return f"{strength}建议买入 {agreement_desc}，置信度 {int(confidence * 100)}%"
    else:
        return f"{strength}建议卖出 {agreement_desc}，置信度 {int(confidence * 100)}%"

