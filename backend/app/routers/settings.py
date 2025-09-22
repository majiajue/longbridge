from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Response, status, BackgroundTasks

from ..exceptions import LongbridgeAPIError, LongbridgeDependencyMissing
from ..models import (
    CredentialPayload,
    CredentialResponse,
    SymbolPayload,
    SymbolResponse,
    VerifyPayload,
    VerifyResponse,
)
from ..repositories import load_credentials, load_symbols, save_credentials, save_symbols
from ..services import verify_quote_access, sync_history_candlesticks
from ..streaming import quote_stream_manager

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/credentials", response_model=CredentialResponse)
def get_credentials() -> CredentialResponse:
    creds = load_credentials()
    return CredentialResponse(**creds)


@router.put(
    "/credentials",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def update_credentials(payload: CredentialPayload) -> Response:
    try:
        save_credentials(payload.model_dump())
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    quote_stream_manager.request_restart()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/symbols", response_model=SymbolResponse)
def get_symbols() -> SymbolResponse:
    return SymbolResponse(symbols=load_symbols())


@router.put(
    "/symbols",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def update_symbols(payload: SymbolPayload, background_tasks: BackgroundTasks) -> Response:
    try:
        save_symbols(payload.symbols)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    # Reload realtime subscriptions immediately
    quote_stream_manager.reload_symbols()

    # Fire-and-forget: pre-warm history for selected symbols (day/min1)
    symbols = list(payload.symbols or [])
    if symbols:
        # 拉取日线 1000 根（前复权）
        background_tasks.add_task(sync_history_candlesticks, symbols, "day", "forward_adjust", 1000, False)
        # 拉取 1 分钟线 1000 根（不复权）
        background_tasks.add_task(sync_history_candlesticks, symbols, "min1", "no_adjust", 1000, False)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/verify", response_model=VerifyResponse)
def verify_settings(
    payload: VerifyPayload = Body(default_factory=VerifyPayload),
) -> VerifyResponse:
    try:
        result = verify_quote_access(payload.symbols)
    except LongbridgeDependencyMissing as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LongbridgeAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return VerifyResponse(**result)
