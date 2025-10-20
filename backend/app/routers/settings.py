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
    """保存 Longbridge API 凭据"""
    # Validate input
    if not payload.LONGPORT_APP_KEY or not payload.LONGPORT_APP_SECRET or not payload.LONGPORT_ACCESS_TOKEN:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_input",
                "message": "凭据不完整",
                "solution": "请确保 APP_KEY、APP_SECRET 和 ACCESS_TOKEN 都已填写",
                "missing_fields": [
                    field for field in ["LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN"]
                    if not getattr(payload, field, None)
                ]
            }
        )
    
    try:
        save_credentials(payload.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "save_failed",
                "message": "保存凭据失败",
                "raw_error": str(exc),
                "solution": "请检查数据库连接或文件系统权限"
            }
        ) from exc
    
    # Restart quote stream with new credentials
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
        raise HTTPException(
            status_code=503,
            detail={
                "error": "dependency_missing",
                "message": "Longbridge SDK 未安装或不可用",
                "solution": "请运行 pip install longport 安装 Longbridge SDK",
                "raw_error": str(exc)
            }
        ) from exc
    except LongbridgeAPIError as exc:
        # Parse Longbridge API error code
        error_msg = str(exc)
        error_code = None
        
        # Extract error code from message like "OpenApiException: (code=401003, trace_id=xxx) token expired"
        if "code=" in error_msg:
            try:
                error_code = error_msg.split("code=")[1].split(",")[0].strip()
            except:
                pass
        
        # Provide user-friendly error messages
        error_details = {
            "error": "api_error",
            "error_code": error_code,
            "raw_error": error_msg
        }
        
        if error_code == "401003" or "token expired" in error_msg.lower():
            error_details.update({
                "message": "ACCESS_TOKEN 已过期",
                "solution": "请访问 Longbridge 开放平台重新获取 ACCESS_TOKEN",
                "steps": [
                    "1. 访问 https://open.longbridgeapp.com/",
                    "2. 登录并进入「应用管理」",
                    "3. 找到你的应用并重新生成 ACCESS_TOKEN",
                    "4. 确保选择「长期 Token」类型",
                    "5. 复制新的 TOKEN 并更新到系统"
                ],
                "platform_url": "https://open.longbridgeapp.com/"
            })
        elif error_code == "401001" or "invalid token" in error_msg.lower():
            error_details.update({
                "message": "ACCESS_TOKEN 无效",
                "solution": "请检查 TOKEN 是否正确复制，确保没有多余空格或字符",
                "steps": [
                    "1. 检查 TOKEN 格式是否正确",
                    "2. 确保没有多余的空格或换行符",
                    "3. 如果问题持续，请重新生成新的 TOKEN"
                ]
            })
        elif error_code == "401002" or "invalid app" in error_msg.lower():
            error_details.update({
                "message": "APP_KEY 或 APP_SECRET 无效",
                "solution": "请检查 APP_KEY 和 APP_SECRET 是否正确",
                "steps": [
                    "1. 访问 Longbridge 开放平台确认凭据",
                    "2. 检查是否使用了正确的环境（生产/沙盒）",
                    "3. 确保凭据没有被禁用或删除"
                ]
            })
        elif "network" in error_msg.lower() or "timeout" in error_msg.lower():
            error_details.update({
                "message": "网络连接失败",
                "solution": "请检查网络连接是否正常",
                "steps": [
                    "1. 检查是否能访问 https://openapi.longbridgeapp.com/",
                    "2. 检查防火墙或代理设置",
                    "3. 如果在中国大陆，可能需要配置网络代理"
                ]
            })
        else:
            error_details.update({
                "message": "Longbridge API 调用失败",
                "solution": "请检查凭据是否正确，或稍后重试"
            })
        
        raise HTTPException(status_code=502, detail=error_details) from exc
    except Exception as exc:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": "验证过程中发生未知错误",
                "raw_error": str(exc),
                "solution": "请检查系统日志或联系技术支持"
            }
        ) from exc
    return VerifyResponse(**result)
