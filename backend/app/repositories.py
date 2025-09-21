from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Sequence

from .config import get_settings
from .db import get_connection


CRED_KEYS = {
    "LONGPORT_APP_KEY": "longport_app_key",
    "LONGPORT_APP_SECRET": "longport_app_secret",
    "LONGPORT_ACCESS_TOKEN": "longport_access_token",
}


def save_credentials(creds: Dict[str, str]) -> None:
    settings = get_settings()
    fernet = settings.get_fernet()
    with get_connection() as conn:
        for env_key, db_key in CRED_KEYS.items():
            value = creds.get(env_key)
            if value is None:
                continue
            token = fernet.encrypt(value.encode("utf-8")).decode("utf-8")
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                [db_key, token],
            )


def load_credentials() -> Dict[str, str]:
    settings = get_settings()
    fernet = settings.get_fernet()
    transformed: Dict[str, str] = {}
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT key, value FROM settings WHERE key IN (?, ?, ?)",
            list(CRED_KEYS.values()),
        ).fetchall()
    for db_key, encrypted in rows:
        env_key = _env_key_from_db_key(db_key)
        if env_key:
            try:
                decrypted = fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
            except Exception:
                decrypted = ""
            transformed[env_key] = decrypted
    return transformed


def _env_key_from_db_key(db_key: str) -> str | None:
    for env_key, candidate in CRED_KEYS.items():
        if candidate == db_key:
            return env_key
    return None


def save_symbols(symbols: List[str]) -> None:
    normalized = sorted({sym.strip().upper() for sym in symbols if sym.strip()})
    with get_connection() as conn:
        conn.execute("DELETE FROM symbols")
        if not normalized:
            return
        conn.executemany(
            "INSERT INTO symbols (symbol, enabled) VALUES (?, 1)",
            [(sym,) for sym in normalized],
        )


def load_symbols() -> List[str]:
    with get_connection() as conn:
        rows = conn.execute("SELECT symbol FROM symbols WHERE enabled = 1 ORDER BY symbol").fetchall()
    return [row[0] for row in rows]


def store_candlesticks(symbol: str, candles: Iterable) -> int:
    records = []
    delete_params = []
    for candle in candles:
        timestamp = getattr(candle, "timestamp", None)
        if timestamp is None:
            continue
        # Check if timestamp is already a datetime object
        if isinstance(timestamp, datetime):
            ts = timestamp.replace(tzinfo=None) if timestamp.tzinfo else timestamp
        else:
            # Assume it's a timestamp (int or float)
            ts = datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(tzinfo=None)
        open_price = _safe_float(getattr(candle, "open", None))
        high_price = _safe_float(getattr(candle, "high", None))
        low_price = _safe_float(getattr(candle, "low", None))
        close_price = _safe_float(getattr(candle, "close", None))
        volume = _safe_float(getattr(candle, "volume", None))
        turnover = _safe_float(getattr(candle, "turnover", None))
        records.append((
            symbol,
            ts,
            open_price,
            high_price,
            low_price,
            close_price,
            volume,
            turnover,
        ))
        delete_params.append((symbol, ts))

    if not records:
        return 0

    with get_connection() as conn:
        # First delete existing records to avoid duplicates
        # Note: We're using INSERT OR REPLACE instead of DELETE then INSERT
        conn.executemany(
            """INSERT OR REPLACE INTO ohlc (symbol, ts, open, high, low, close, volume, turnover)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            records,
        )
        conn.commit()  # Explicitly commit the transaction
    return len(records)


def fetch_candlesticks(symbol: str, limit: int) -> List[Dict[str, float]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT ts, open, high, low, close, volume, turnover FROM ohlc WHERE symbol = ? ORDER BY ts DESC LIMIT ?",
            [symbol, limit],
        ).fetchall()
    return [
        {
            "ts": row[0],
            "open": row[1],
            "high": row[2],
            "low": row[3],
            "close": row[4],
            "volume": row[5],
            "turnover": row[6],
        }
        for row in rows
    ]


def save_positions(positions: Sequence[Dict[str, float]]) -> None:
    timestamp = datetime.utcnow()
    normalized = []
    for item in positions:
        symbol = item.get("symbol", "").strip().upper()
        if not symbol:
            continue
        qty = float(item.get("qty", 0) or 0)
        avg_price = float(item.get("avg_price", 0) or 0)
        normalized.append((symbol, qty, avg_price, timestamp))

    with get_connection() as conn:
        conn.execute("DELETE FROM positions")
        if not normalized:
            return
        conn.executemany(
            "INSERT INTO positions (symbol, qty, avg_price, last_updated) VALUES (?, ?, ?, ?)",
            normalized,
        )


def load_positions() -> List[Dict[str, float]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT symbol, qty, avg_price, last_updated FROM positions ORDER BY symbol",
        ).fetchall()
    return [
        {
            "symbol": row[0],
            "qty": row[1],
            "avg_price": row[2],
            "last_updated": row[3],
        }
        for row in rows
    ]


def store_tick_event(symbol: str, quote_event: object) -> None:
    timestamp = getattr(quote_event, "timestamp", None)
    if timestamp is None:
        return

    ts: Optional[datetime] = None
    if isinstance(timestamp, datetime):
        ts = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
    elif isinstance(timestamp, (int, float)):
        ts = datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(tzinfo=None)
    else:
        # 尝试解析字符串时间戳
        try:
            ts_float = float(timestamp)
            ts = datetime.fromtimestamp(ts_float, tz=timezone.utc).replace(tzinfo=None)
        except (TypeError, ValueError):
            return

    if ts is None:
        return
    price = _safe_float(getattr(quote_event, "last_done", None))
    volume = _safe_float(getattr(quote_event, "volume", None))
    turnover = _safe_float(getattr(quote_event, "turnover", None))
    current_volume = _safe_float(getattr(quote_event, "current_volume", None))
    current_turnover = _safe_float(getattr(quote_event, "current_turnover", None))
    sequence = getattr(quote_event, "sequence", None)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO ticks (symbol, ts, sequence, price, volume, turnover, current_volume, current_turnover)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol, ts) DO UPDATE SET
                sequence=excluded.sequence,
                price=excluded.price,
                volume=excluded.volume,
                turnover=excluded.turnover,
                current_volume=excluded.current_volume,
                current_turnover=excluded.current_turnover
            """,
            [
                symbol,
                ts,
                sequence,
                price,
                volume,
                turnover,
                current_volume,
                current_turnover,
            ],
        )


def fetch_ticks(symbol: str, limit: int) -> List[Dict[str, Optional[float]]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT ts, sequence, price, volume, turnover, current_volume, current_turnover
            FROM ticks
            WHERE symbol = ?
            ORDER BY ts DESC
            LIMIT ?
            """,
            [symbol, limit],
        ).fetchall()
    return [
        {
            "ts": row[0],
            "sequence": row[1],
            "price": row[2],
            "volume": row[3],
            "turnover": row[4],
            "current_volume": row[5],
            "current_turnover": row[6],
        }
        for row in rows
    ]


def fetch_latest_prices(symbols: Sequence[str]) -> Dict[str, Dict[str, Optional[float]]]:
    results: Dict[str, Dict[str, Optional[float]]] = {}
    if not symbols:
        return results

    with get_connection() as conn:
        for symbol in symbols:
            symbol_clean = symbol.strip().upper()
            tick_row = conn.execute(
                """
                SELECT ts, price, volume
                FROM ticks
                WHERE symbol = ?
                ORDER BY ts DESC
                LIMIT 1
                """,
                [symbol_clean],
            ).fetchone()

            if tick_row:
                results[symbol_clean] = {
                    "ts": tick_row[0],
                    "price": tick_row[1],
                    "volume": tick_row[2],
                    "source": "tick",
                }
                continue

            ohlc_row = conn.execute(
                """
                SELECT ts, close
                FROM ohlc
                WHERE symbol = ?
                ORDER BY ts DESC
                LIMIT 1
                """,
                [symbol_clean],
            ).fetchone()

            if ohlc_row:
                results[symbol_clean] = {
                    "ts": ohlc_row[0],
                    "price": ohlc_row[1],
                    "volume": None,
                    "source": "ohlc",
                }

    return results


def _safe_float(value) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
