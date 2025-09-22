from __future__ import annotations

import asyncio
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set

from .exceptions import LongbridgeDependencyMissing
from .repositories import load_credentials, load_symbols, store_tick_event
from .services import get_portfolio_overview
from .strategy_engine import get_strategy_engine
from .position_monitor import get_position_monitor

logger = logging.getLogger(__name__)


class QuoteStreamManager:
    def __init__(self) -> None:
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._queues: Set[asyncio.Queue] = set()
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._refresh_event = threading.Event()
        self._should_restart = False
        self._status = "idle"
        self._status_detail: Optional[str] = None
        self._current_symbols: Set[str] = set()
        self._last_quote_at: Optional[datetime] = None
        self._portfolio_thread: Optional[threading.Thread] = None
        self._portfolio_running = False

    # ---- lifecycle -----------------------------------------------------
    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def ensure_started(self) -> None:
        should_notify = False
        with self._lock:
            if self._thread and self._thread.is_alive():
                pass
            else:
                self._running = True
                self._thread = threading.Thread(target=self._run, name="quote-stream", daemon=True)
                self._thread.start()
                should_notify = True

            # Also start portfolio update thread
            if not self._portfolio_thread or not self._portfolio_thread.is_alive():
                self._portfolio_running = True
                self._portfolio_thread = threading.Thread(target=self._run_portfolio_updates, name="portfolio-stream", daemon=True)
                self._portfolio_thread.start()

        if should_notify:
            self._update_status("starting", "正在启动行情订阅线程")

    async def stop(self) -> None:
        with self._lock:
            self._running = False
            self._portfolio_running = False
            self._refresh_event.set()
            thread = self._thread
            portfolio_thread = self._portfolio_thread
        if thread and thread.is_alive():
            await asyncio.get_running_loop().run_in_executor(None, thread.join, 5.0)
        if portfolio_thread and portfolio_thread.is_alive():
            await asyncio.get_running_loop().run_in_executor(None, portfolio_thread.join, 5.0)
        self._update_status("stopped", "行情订阅线程已停止")

    def request_restart(self) -> None:
        need_start = False
        with self._lock:
            if self._thread and self._thread.is_alive():
                self._should_restart = True
                self._refresh_event.set()
            else:
                need_start = True
        if need_start:
            self.ensure_started()

    def reload_symbols(self) -> None:
        self.ensure_started()
        self._refresh_event.set()

    # ---- client management ---------------------------------------------
    def add_listener(self) -> asyncio.Queue:
        self.ensure_started()
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        with self._lock:
            self._queues.add(queue)
            snapshot = {
                "status": self._status,
                "detail": self._status_detail,
                "subscribed": sorted(self._current_symbols),
                "last_quote_at": self._last_quote_at.isoformat() if self._last_quote_at else None,
            }
        initial_payload = {
            "type": "status",
            "status": snapshot["status"],
            "detail": snapshot.get("detail"),
            "subscribed": snapshot.get("subscribed", []),
            "last_quote_at": snapshot.get("last_quote_at"),
        }
        try:
            queue.put_nowait(initial_payload)
        except asyncio.QueueFull:  # pragma: no cover - safety
            pass
        return queue

    def remove_listener(self, queue: asyncio.Queue) -> None:
        with self._lock:
            self._queues.discard(queue)

    # ---- status ---------------------------------------------------------
    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": self._status,
                "detail": self._status_detail,
                "subscribed": sorted(self._current_symbols),
                "listeners": len(self._queues),
                "last_quote_at": self._last_quote_at.isoformat() if self._last_quote_at else None,
            }

    # ---- internal helpers ----------------------------------------------
    def _update_status(self, status: str, detail: Optional[str] = None) -> None:
        with self._lock:
            self._status = status
            self._status_detail = detail
            subscribed = sorted(self._current_symbols)
            last_quote_at = self._last_quote_at.isoformat() if self._last_quote_at else None
        payload = {
            "type": "status",
            "status": status,
            "detail": detail,
            "subscribed": subscribed,
            "last_quote_at": last_quote_at,
        }
        self._broadcast(payload)

    def _broadcast(self, payload: Dict[str, Any]) -> None:
        if not self._loop:
            return
        with self._lock:
            queues = list(self._queues)
        if not queues:
            return
        for queue in queues:
            asyncio.run_coroutine_threadsafe(self._offer(queue, payload), self._loop)

    async def _offer(self, queue: asyncio.Queue, payload: Dict[str, Any]) -> None:
        if queue.full():
            try:
                await queue.get()
            except asyncio.QueueEmpty:  # pragma: no cover - safety
                pass
        await queue.put(payload)

    async def _process_strategy_quote(self, symbol: str, payload: Dict[str, Any]) -> None:
        """Process quote data for strategy engine and position monitor"""
        try:
            if payload.get('type') != 'quote':
                return

            # Process in strategy engine
            engine = get_strategy_engine()

            # Convert quote data to K-line bar format
            bar = {
                'open': payload.get('open', 0),
                'high': payload.get('high', 0),
                'low': payload.get('low', 0),
                'close': payload.get('last_done', 0),
                'volume': payload.get('volume', 0),
                'timestamp': payload.get('timestamp', 0)
            }

            # Process in strategy engine
            await engine.process_kline(symbol, bar)

            # Process in position monitor for position-based monitoring
            monitor = get_position_monitor()
            await monitor.process_quote(symbol, payload)

        except Exception as e:
            logger.error(f"Error processing strategy quote for {symbol}: {e}")

    def _run(self) -> None:
        while self._running:
            if not self._loop:
                self._update_status("idle", "等待事件循环初始化")
                time.sleep(1.0)
                continue

            creds = load_credentials()
            if not creds or any(not creds.get(key) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")):
                with self._lock:
                    self._current_symbols.clear()
                self._update_status("waiting_credentials", "未配置完整的 Longbridge 凭据")
                time.sleep(3.0)
                continue

            symbols = load_symbols()
            if not symbols:
                with self._lock:
                    self._current_symbols.clear()
                self._update_status("waiting_symbols", "没有可订阅的股票代码")
                time.sleep(3.0)
                continue

            try:
                from longport.openapi import Config, QuoteContext, SubType
            except ModuleNotFoundError as exc:
                self._update_status("error", "未找到 longport SDK，请安装后重试")
                logger.exception("Missing longport SDK", exc_info=exc)
                time.sleep(10.0)
                continue

            config = Config(
                app_key=creds.get("LONGPORT_APP_KEY", ""),
                app_secret=creds.get("LONGPORT_APP_SECRET", ""),
                access_token=creds.get("LONGPORT_ACCESS_TOKEN", ""),
            )

            try:
                ctx = QuoteContext(config)
            except Exception as exc:  # pragma: no cover - network errors
                self._update_status("error", f"创建 QuoteContext 失败: {exc}")
                logger.exception("Failed to create QuoteContext", exc_info=exc)
                time.sleep(5.0)
                continue

            current_symbols: Set[str] = set()
            self._refresh_event.set()
            self._update_status("running", "行情订阅已启动")

            def on_quote(symbol: str, event: Any) -> None:
                try:
                    payload = self._normalize_quote(symbol, event)
                    store_tick_event(symbol, event)
                    self._broadcast(payload)

                    # Process quote for strategy engine
                    asyncio.run_coroutine_threadsafe(
                        self._process_strategy_quote(symbol, payload),
                        self._loop
                    )
                except Exception as exc:  # pragma: no cover - defensive
                    logger.exception("处理行情推送失败", exc_info=exc)

            ctx.set_on_quote(on_quote)

            try:
                ctx.subscribe(symbols, [SubType.Quote], is_first_push=True)
                current_symbols = set(symbols)
                with self._lock:
                    self._current_symbols = set(current_symbols)
                self._update_status("running", f"已订阅 {len(current_symbols)} 只股票")
            except Exception as exc:
                self._update_status("error", f"订阅失败: {exc}")
                logger.exception("Subscribe failed", exc_info=exc)
                ctx.close()
                time.sleep(5.0)
                continue

            while self._running:
                if self._should_restart:
                    self._should_restart = False
                    self._update_status("restarting", "重新加载凭据后重启行情订阅")
                    break

                if self._refresh_event.wait(timeout=1.0):
                    self._refresh_event.clear()
                    new_symbols = set(load_symbols())
                    if not new_symbols:
                        continue
                    to_add = list(new_symbols - current_symbols)
                    to_remove = list(current_symbols - new_symbols)
                    try:
                        if to_remove:
                            ctx.unsubscribe(to_remove, [SubType.Quote])
                        if to_add:
                            ctx.subscribe(to_add, [SubType.Quote], is_first_push=True)
                        current_symbols = new_symbols
                        with self._lock:
                            self._current_symbols = set(current_symbols)
                        self._update_status(
                            "running",
                            f"已更新订阅列表，共 {len(current_symbols)} 只",
                        )
                    except Exception as exc:
                        self._update_status("error", f"更新订阅失败: {exc}")
                        logger.exception("Update subscription failed", exc_info=exc)
                # passive wait

            try:
                ctx.close()
            except Exception:  # noqa: S110 - cleanup
                pass

            if not self._running:
                break
            # restart loop automatically
            time.sleep(1.0)

        self._update_status("stopped", "行情订阅线程退出")

    def _run_portfolio_updates(self) -> None:
        """定期推送持仓和资金更新"""
        logger.info("Portfolio update thread started")

        while self._portfolio_running:
            try:
                # Get portfolio overview including positions and account balance
                portfolio_data = get_portfolio_overview()

                # Broadcast portfolio update to all listeners
                payload = {
                    "type": "portfolio_update",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "positions": portfolio_data.get("positions", []),
                    "totals": portfolio_data.get("totals", {}),
                    "account_balance": portfolio_data.get("account_balance", {})
                }

                self._broadcast(payload)

                # Update every 5 seconds
                time.sleep(5)

            except Exception as e:
                logger.error(f"Error in portfolio update thread: {e}")
                time.sleep(10)  # Wait longer on error

        logger.info("Portfolio update thread stopped")

    # ------------------------------------------------------------------
    def _normalize_quote(self, symbol: str, event: Any) -> Dict[str, Any]:
        # Normalize symbol format (e.g., "5.HK" -> "0005.HK")
        normalized_symbol = symbol
        if symbol.endswith(".HK"):
            parts = symbol.split(".")
            if parts[0].isdigit():
                # Pad with zeros to make it 4 digits for HK stocks
                normalized_symbol = f"{int(parts[0]):04d}.HK"

        sequence = getattr(event, "sequence", None)
        timestamp = getattr(event, "timestamp", None)
        ts_iso: Optional[str] = None
        ts_dt: datetime

        # Use current time if timestamp is not provided
        if timestamp:
            try:
                ts_dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                ts_iso = ts_dt.isoformat()
                with self._lock:
                    self._last_quote_at = ts_dt
            except Exception:  # pragma: no cover - guard
                ts_iso = None
                ts_dt = datetime.now(timezone.utc)
                with self._lock:
                    self._last_quote_at = ts_dt
        else:
            # Use current time as fallback
            ts_dt = datetime.now(timezone.utc)
            ts_iso = ts_dt.isoformat()
            with self._lock:
                self._last_quote_at = ts_dt

        # Get price values
        last_done = _safe_float(getattr(event, "last_done", None))
        prev_close = _safe_float(getattr(event, "prev_close", None))

        # Calculate change values
        change_value = 0.0
        change_rate = 0.0
        if last_done is not None and prev_close is not None and prev_close != 0:
            change_value = last_done - prev_close
            change_rate = (change_value / prev_close) * 100

        # Convert timestamp to Unix timestamp for frontend compatibility
        timestamp_unix = int(ts_dt.timestamp())

        data = {
            "type": "quote",
            "symbol": normalized_symbol,
            "sequence": sequence,
            "last_done": last_done,
            "prev_close": prev_close,
            "open": _safe_float(getattr(event, "open", None)),
            "high": _safe_float(getattr(event, "high", None)),
            "low": _safe_float(getattr(event, "low", None)),
            "timestamp": timestamp_unix,  # Use Unix timestamp for frontend
            "volume": _safe_float(getattr(event, "volume", None)),
            "turnover": _safe_float(getattr(event, "turnover", None)),
            "current_volume": _safe_float(getattr(event, "current_volume", None)),
            "current_turnover": _safe_float(getattr(event, "current_turnover", None)),
            "trade_status": str(getattr(event, "trade_status", None)),
            "trade_session": str(getattr(event, "trade_session", None)),
            "tag": getattr(event, "tag", None),
            "change_value": change_value,
            "change_rate": change_rate,
        }
        return data


def _safe_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):  # pragma: no cover - guard
        return None


quote_stream_manager = QuoteStreamManager()
