from __future__ import annotations

from datetime import datetime, timezone
import json
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


def fetch_bars_from_ticks(symbol: str, limit: int) -> List[Dict[str, Optional[float]]]:
    """Aggregate recent ticks into minute bars as a fallback for K-line.

    This produces approximate intraday candlesticks using tick data when
    historical OHLC has not been synced yet. It returns at most `limit`
    most recent minute bars.
    """
    with get_connection() as conn:
        # Narrow the scan range to recent data to improve performance.
        # We approximate a window that will cover at least `limit` minutes.
        # Use last 3 days as a safe upper bound for 1000 minute bars.
        max_row = conn.execute(
            "SELECT max(ts) FROM ticks WHERE symbol = ?",
            [symbol],
        ).fetchone()
        cutoff = None
        if max_row and max_row[0]:
            try:
                from datetime import timedelta

                cutoff = max_row[0] - timedelta(days=3)
            except Exception:
                cutoff = None

        params: List[object] = [symbol]
        filter_sql = ""
        if cutoff is not None:
            filter_sql = " AND ts >= ?"
            params.append(cutoff)
        params.append(limit)

        rows = conn.execute(
            f"""
            WITH base AS (
                SELECT ts, price,
                       COALESCE(current_volume, volume, 0) AS vol
                FROM ticks
                WHERE symbol = ? AND price IS NOT NULL{filter_sql}
            ),
            g AS (
                SELECT date_trunc('minute', ts) AS t,
                       min(ts) AS min_ts,
                       max(ts) AS max_ts,
                       max(price) AS high,
                       min(price) AS low,
                       sum(vol) AS volume
                FROM base
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT ?
            )
            SELECT g.t AS ts,
                   (SELECT price FROM base WHERE ts = g.min_ts LIMIT 1) AS open,
                   g.high AS high,
                   g.low AS low,
                   (SELECT price FROM base WHERE ts = g.max_ts LIMIT 1) AS close,
                   g.volume AS volume
            FROM g
            ORDER BY ts DESC
            """,
            params,
        ).fetchall()

    return [
        {
            "ts": row[0],
            "open": row[1],
            "high": row[2],
            "low": row[3],
            "close": row[4],
            "volume": row[5],
            "turnover": None,
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


def _ensure_global_monitoring_columns(conn) -> None:
    info = conn.execute("PRAGMA table_info('global_monitoring_settings')").fetchall()
    columns = {row[1] for row in info}
    if 'excluded_symbols' not in columns:
        conn.execute("ALTER TABLE global_monitoring_settings ADD COLUMN excluded_symbols TEXT DEFAULT '[]'")
        conn.execute("UPDATE global_monitoring_settings SET excluded_symbols = '[]' WHERE excluded_symbols IS NULL")
    if 'created_at' not in columns:
        conn.execute("ALTER TABLE global_monitoring_settings ADD COLUMN created_at TEXT")
    if 'updated_at' not in columns:
        conn.execute("ALTER TABLE global_monitoring_settings ADD COLUMN updated_at TEXT")


# Monitoring repository functions
def save_position_monitoring_config(config_data: Dict) -> None:
    """Save or update position monitoring configuration"""
    with get_connection() as conn:
        # Create table if not exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS position_monitoring (
                symbol TEXT PRIMARY KEY,
                monitoring_status TEXT NOT NULL DEFAULT 'enabled',
                strategy_mode TEXT NOT NULL DEFAULT 'balanced',
                enabled_strategies TEXT NOT NULL DEFAULT '[]',
                max_position_ratio REAL NOT NULL DEFAULT 0.1,
                stop_loss_ratio REAL NOT NULL DEFAULT 0.05,
                take_profit_ratio REAL NOT NULL DEFAULT 0.1,
                cooldown_minutes INTEGER NOT NULL DEFAULT 30,
                notes TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        # Convert enabled_strategies list to JSON string
        import json
        enabled_strategies_json = json.dumps(config_data.get('enabled_strategies', []))

        # Insert or update configuration
        conn.execute("""
            INSERT OR REPLACE INTO position_monitoring
            (symbol, monitoring_status, strategy_mode, enabled_strategies, max_position_ratio,
             stop_loss_ratio, take_profit_ratio, cooldown_minutes, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            config_data['symbol'],
            config_data.get('monitoring_status', 'enabled'),
            config_data.get('strategy_mode', 'balanced'),
            enabled_strategies_json,
            config_data.get('max_position_ratio', 0.1),
            config_data.get('stop_loss_ratio', 0.05),
            config_data.get('take_profit_ratio', 0.1),
            config_data.get('cooldown_minutes', 30),
            config_data.get('notes'),
            datetime.now().isoformat()
        ])


def get_position_monitoring_config(symbol: str) -> Optional[Dict]:
    """Get position monitoring configuration for a specific symbol"""
    with get_connection() as conn:
        # Ensure table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS position_monitoring (
                symbol TEXT PRIMARY KEY,
                monitoring_status TEXT NOT NULL DEFAULT 'enabled',
                strategy_mode TEXT NOT NULL DEFAULT 'balanced',
                enabled_strategies TEXT NOT NULL DEFAULT '[]',
                max_position_ratio REAL NOT NULL DEFAULT 0.1,
                stop_loss_ratio REAL NOT NULL DEFAULT 0.05,
                take_profit_ratio REAL NOT NULL DEFAULT 0.1,
                cooldown_minutes INTEGER NOT NULL DEFAULT 30,
                notes TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        row = conn.execute("""
            SELECT symbol, monitoring_status, strategy_mode, enabled_strategies,
                   max_position_ratio, stop_loss_ratio, take_profit_ratio,
                   cooldown_minutes, notes, created_at, updated_at
            FROM position_monitoring WHERE symbol = ?
        """, [symbol]).fetchone()

        if not row:
            return None

        import json
        return {
            'symbol': row[0],
            'monitoring_status': row[1],
            'strategy_mode': row[2],
            'enabled_strategies': json.loads(row[3]) if row[3] else [],
            'max_position_ratio': row[4],
            'stop_loss_ratio': row[5],
            'take_profit_ratio': row[6],
            'cooldown_minutes': row[7],
            'notes': row[8],
            'created_at': row[9],
            'updated_at': row[10]
        }


def get_all_monitoring_configs() -> List[Dict]:
    """Get all position monitoring configurations"""
    with get_connection() as conn:
        # Ensure table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS position_monitoring (
                symbol TEXT PRIMARY KEY,
                monitoring_status TEXT NOT NULL DEFAULT 'enabled',
                strategy_mode TEXT NOT NULL DEFAULT 'balanced',
                enabled_strategies TEXT NOT NULL DEFAULT '[]',
                max_position_ratio REAL NOT NULL DEFAULT 0.1,
                stop_loss_ratio REAL NOT NULL DEFAULT 0.05,
                take_profit_ratio REAL NOT NULL DEFAULT 0.1,
                cooldown_minutes INTEGER NOT NULL DEFAULT 30,
                notes TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        rows = conn.execute("""
            SELECT symbol, monitoring_status, strategy_mode, enabled_strategies,
                   max_position_ratio, stop_loss_ratio, take_profit_ratio,
                   cooldown_minutes, notes, created_at, updated_at
            FROM position_monitoring
        """).fetchall()

        import json
        configs = []
        for row in rows:
            configs.append({
                'symbol': row[0],
                'monitoring_status': row[1],
                'strategy_mode': row[2],
                'enabled_strategies': json.loads(row[3]) if row[3] else [],
                'max_position_ratio': row[4],
                'stop_loss_ratio': row[5],
                'take_profit_ratio': row[6],
                'cooldown_minutes': row[7],
                'notes': row[8],
                'created_at': row[9],
                'updated_at': row[10]
            })
        return configs


def get_global_monitoring_settings() -> Dict:
    """Get global monitoring settings"""
    with get_connection() as conn:
        # Create table if not exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_monitoring_settings (
                id INTEGER PRIMARY KEY,
                global_enabled BOOLEAN NOT NULL DEFAULT 1,
                market_hours_only BOOLEAN NOT NULL DEFAULT 1,
                max_daily_trades INTEGER NOT NULL DEFAULT 20,
                max_total_exposure REAL NOT NULL DEFAULT 0.8,
                emergency_stop BOOLEAN NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'medium',
                notifications_enabled BOOLEAN NOT NULL DEFAULT 1,
                excluded_symbols TEXT NOT NULL DEFAULT '[]',
                created_at TEXT,
                updated_at TEXT
            )
        """)

        _ensure_global_monitoring_columns(conn)

        row = conn.execute("""
            SELECT global_enabled, market_hours_only, max_daily_trades, max_total_exposure,
                   emergency_stop, risk_level, notifications_enabled, excluded_symbols, created_at, updated_at
            FROM global_monitoring_settings WHERE id = 1
        """).fetchone()

        if not row:
            # Insert default settings
            conn.execute("""
                INSERT INTO global_monitoring_settings
                (id, global_enabled, market_hours_only, max_daily_trades, max_total_exposure,
                 emergency_stop, risk_level, notifications_enabled, excluded_symbols, created_at, updated_at)
                VALUES (1, 1, 1, 20, 0.8, 0, 'medium', 1, '[]', ?, ?)
            """, [datetime.now().isoformat(), datetime.now().isoformat()])

            return {
                'global_enabled': True,
                'market_hours_only': True,
                'max_daily_trades': 20,
                'max_total_exposure': 0.8,
                'emergency_stop': False,
                'risk_level': 'medium',
                'notifications_enabled': True,
                'excluded_symbols': [],
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }

        excluded_symbols = []
        try:
            if row[7]:
                excluded_symbols = json.loads(row[7])
        except (TypeError, ValueError):
            excluded_symbols = []

        return {
            'global_enabled': bool(row[0]),
            'market_hours_only': bool(row[1]),
            'max_daily_trades': row[2],
            'max_total_exposure': row[3],
            'emergency_stop': bool(row[4]),
            'risk_level': row[5],
            'notifications_enabled': bool(row[6]),
            'excluded_symbols': excluded_symbols,
            'created_at': row[8],
            'updated_at': row[9]
        }


def save_global_monitoring_settings(settings: Dict) -> None:
    """Save global monitoring settings"""
    with get_connection() as conn:
        # Create table if not exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_monitoring_settings (
                id INTEGER PRIMARY KEY,
                global_enabled BOOLEAN NOT NULL DEFAULT 1,
                market_hours_only BOOLEAN NOT NULL DEFAULT 1,
                max_daily_trades INTEGER NOT NULL DEFAULT 20,
                max_total_exposure REAL NOT NULL DEFAULT 0.8,
                emergency_stop BOOLEAN NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'medium',
                notifications_enabled BOOLEAN NOT NULL DEFAULT 1,
                excluded_symbols TEXT NOT NULL DEFAULT '[]',
                created_at TEXT,
                updated_at TEXT
            )
        """)

        _ensure_global_monitoring_columns(conn)

        existing = conn.execute(
            "SELECT created_at FROM global_monitoring_settings WHERE id = 1"
        ).fetchone()
        created_at = existing[0] if existing and existing[0] else datetime.now().isoformat()
        updated_at = datetime.now().isoformat()
        excluded_symbols = settings.get('excluded_symbols', []) or []
        excluded_json = json.dumps(excluded_symbols)

        conn.execute(
            """
            INSERT INTO global_monitoring_settings (
                id, global_enabled, market_hours_only, max_daily_trades, max_total_exposure,
                emergency_stop, risk_level, notifications_enabled, excluded_symbols, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                global_enabled=excluded.global_enabled,
                market_hours_only=excluded.market_hours_only,
                max_daily_trades=excluded.max_daily_trades,
                max_total_exposure=excluded.max_total_exposure,
                emergency_stop=excluded.emergency_stop,
                risk_level=excluded.risk_level,
                notifications_enabled=excluded.notifications_enabled,
                excluded_symbols=excluded.excluded_symbols,
                updated_at=excluded.updated_at
            """,
            [
                1,
                settings.get('global_enabled', True),
                settings.get('market_hours_only', True),
                settings.get('max_daily_trades', 20),
                settings.get('max_total_exposure', 0.8),
                settings.get('emergency_stop', False),
                settings.get('risk_level', 'medium'),
                settings.get('notifications_enabled', True),
                excluded_json,
                created_at,
                updated_at,
            ],
        )


def get_active_monitoring_symbols() -> List[str]:
    """Get list of symbols that have monitoring enabled"""
    with get_connection() as conn:
        # Ensure table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS position_monitoring (
                symbol TEXT PRIMARY KEY,
                monitoring_status TEXT NOT NULL DEFAULT 'enabled',
                strategy_mode TEXT NOT NULL DEFAULT 'balanced',
                enabled_strategies TEXT NOT NULL DEFAULT '[]',
                max_position_ratio REAL NOT NULL DEFAULT 0.1,
                stop_loss_ratio REAL NOT NULL DEFAULT 0.05,
                take_profit_ratio REAL NOT NULL DEFAULT 0.1,
                cooldown_minutes INTEGER NOT NULL DEFAULT 30,
                notes TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        rows = conn.execute("""
            SELECT symbol FROM position_monitoring
            WHERE monitoring_status = 'enabled'
        """).fetchall()

        return [row[0] for row in rows]
