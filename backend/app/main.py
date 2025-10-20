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
from .routers import strategies_advanced as strategies_advanced_router
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
app.include_router(strategies_advanced_router.router)
app.include_router(monitoring_router.router)
app.include_router(notifications_router.router)
app.include_router(signal_analysis_router.router)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _auto_sync_position_data() -> None:
    """
    自动同步持仓股票的历史K线数据
    在后台异步执行，避免阻塞启动
    """
    from .services import get_portfolio_overview, sync_history_candlesticks
    from .repositories import load_symbols
    
    # 等待3秒，确保其他服务已启动
    await asyncio.sleep(3)
    
    logger.info("auto-sync: starting position data sync")
    
    try:
        # 1. 获取持仓股票
        position_symbols = set()
        try:
            portfolio = get_portfolio_overview()
            if portfolio and portfolio.get('positions'):
                position_symbols = {pos['symbol'] for pos in portfolio['positions']}
                logger.info(f"auto-sync: found {len(position_symbols)} position symbols")
        except Exception as e:
            logger.warning(f"auto-sync: failed to get positions: {e}")
        
        # 2. 获取手工配置的股票
        manual_symbols = set()
        try:
            manual_symbols = set(load_symbols())
            logger.info(f"auto-sync: found {len(manual_symbols)} manual symbols")
        except Exception as e:
            logger.warning(f"auto-sync: failed to load symbols: {e}")
        
        # 3. 合并去重
        all_symbols = list(position_symbols | manual_symbols)
        
        if not all_symbols:
            logger.info("auto-sync: no symbols to sync")
            return
        
        logger.info(f"auto-sync: syncing {len(all_symbols)} symbols")
        
        # 4. 逐个同步（限制并发，避免API限流）
        success_count = 0
        fail_count = 0
        
        for symbol in all_symbols:
            try:
                result = sync_history_candlesticks(
                    symbols=[symbol],  # 接受列表参数
                    period="day",
                    adjust_type="forward_adjust",
                    count=100  # 最近100个交易日
                )
                
                synced = result.get('synced_count', 0)
                if synced > 0:
                    logger.info(f"auto-sync: {symbol} synced {synced} bars")
                    success_count += 1
                else:
                    logger.debug(f"auto-sync: {symbol} no new data")
                    success_count += 1
                
                # 避免频繁请求，每次间隔0.5秒
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"auto-sync: {symbol} failed: {e}")
                fail_count += 1
        
        logger.info(f"auto-sync: completed - success: {success_count}, failed: {fail_count}")
        
    except Exception as e:
        logger.error(f"auto-sync: fatal error: {e}")


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
    
    # Auto-sync position historical data
    asyncio.create_task(_auto_sync_position_data())
    logger.info("startup: auto-sync task scheduled")



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
