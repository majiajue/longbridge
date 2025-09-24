from __future__ import annotations
import logging


import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import portfolio as portfolio_router
from .routers import quotes as quotes_router
from .routers import settings as settings_router
from .routers import strategies as strategies_router
from .routers import monitoring as monitoring_router
from .routers import notifications as notifications_router
from .routers import signal_analysis as signal_analysis_router
from .streaming import quote_stream_manager
from .position_monitor import get_position_monitor


app = FastAPI(title="Longbridge Quant Backend", version="0.1.0")

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router.router)
app.include_router(quotes_router.router)
app.include_router(portfolio_router.router)
app.include_router(strategies_router.router)
app.include_router(monitoring_router.router)
app.include_router(notifications_router.router)
app.include_router(signal_analysis_router.router)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup() -> None:
    logger.info("startup: entering handler")
    loop = asyncio.get_running_loop()
    quote_stream_manager.attach_loop(loop)
    logger.info("startup: loop attached %s", loop)
    quote_stream_manager.ensure_started()
    logger.info("startup: ensure_started finished")

    # Initialize position monitor
    monitor = get_position_monitor()
    asyncio.create_task(monitor.start_monitoring())
    logger.info("startup: position monitor started")



@app.on_event("shutdown")
async def on_shutdown() -> None:
    await quote_stream_manager.stop()

    # Stop position monitor
    monitor = get_position_monitor()
    await monitor.stop_monitoring()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/quotes")
async def quotes_websocket(websocket: WebSocket) -> None:
    import json
    from datetime import datetime

    def json_serializer(obj):
        """JSON serializer for objects not serializable by default json code"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        # Handle enum-like objects and other non-serializable types
        if hasattr(obj, 'name'):
            return obj.name
        if hasattr(obj, 'value'):
            return obj.value
        # Convert to string as last resort
        return str(obj)

    await websocket.accept()
    queue = quote_stream_manager.add_listener()
    try:
        while True:
            payload = await queue.get()
            # Use custom serializer to handle datetime objects
            json_str = json.dumps(payload, default=json_serializer)
            await websocket.send_text(json_str)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        quote_stream_manager.remove_listener(queue)
