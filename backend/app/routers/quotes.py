from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..exceptions import LongbridgeAPIError, LongbridgeDependencyMissing
from ..models import (
    CandlestickModel,
    HistoryBarsResponse,
    HistorySyncPayload,
    HistorySyncResponse,
    StreamStatusResponse,
    TickListResponse,
)
from ..services import get_cached_candlesticks, sync_history_candlesticks
from ..streaming import quote_stream_manager
from ..repositories import fetch_ticks, fetch_bars_from_ticks

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.post("/history/sync", response_model=HistorySyncResponse)
def sync_history(payload: HistorySyncPayload) -> HistorySyncResponse:
    try:
        processed = sync_history_candlesticks(
            symbols=payload.symbols,
            period=payload.period,
            adjust_type=payload.adjust_type,
            count=payload.count,
        )
    except LongbridgeDependencyMissing as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LongbridgeAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return HistorySyncResponse(
        processed=processed,
        period=payload.period,
        adjust_type=payload.adjust_type,
    )


@router.get("/history", response_model=HistoryBarsResponse)
def get_history(
    symbol: str = Query(..., description="股票代码，如 700.HK"),
    limit: int = Query(200, ge=1, le=1000, description="返回的 K 线数量"),
    period: str = Query("day", description="请求的周期，仅用于响应展示"),
    adjust_type: str = Query(
        "no_adjust", description="请求的复权类型，仅用于响应展示"
    ),
) -> HistoryBarsResponse:
    try:
        if period.lower() == "min1":
            # For intraday minute view, aggregate from ticks to avoid mixing with daily OHLC
            bars_raw = fetch_bars_from_ticks(symbol, limit)
        else:
            bars_raw = get_cached_candlesticks(symbol, limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    bars = [CandlestickModel(**bar) for bar in bars_raw]
    return HistoryBarsResponse(
        symbol=symbol,
        period=period,
        adjust_type=adjust_type,
        bars=bars,
    )


@router.get("/ticks", response_model=TickListResponse)
def get_ticks(
    symbol: str = Query(..., description="股票代码，如 700.HK"),
    limit: int = Query(100, ge=1, le=1000, description="返回的 tick 数量"),
) -> TickListResponse:
    ticks_raw = fetch_ticks(symbol, limit)
    ticks = [
        {
            **tick,
        }
        for tick in ticks_raw
    ]
    return TickListResponse(symbol=symbol, limit=limit, ticks=ticks)


@router.get("/stream/status", response_model=StreamStatusResponse)
def stream_status() -> StreamStatusResponse:
    snapshot = quote_stream_manager.snapshot()
    return StreamStatusResponse(**snapshot)
