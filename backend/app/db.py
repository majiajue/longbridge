from __future__ import annotations

import threading
from contextlib import contextmanager

import duckdb
from duckdb import DuckDBPyConnection

from .config import get_settings


_SETTINGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

_SYMBOLS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS symbols (
    symbol TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
);
"""

_OHLC_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ohlc (
    symbol TEXT NOT NULL,
    ts TIMESTAMP NOT NULL,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    volume DOUBLE,
    turnover DOUBLE,
    PRIMARY KEY (symbol, ts)
);
"""

_TICKS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ticks (
    symbol TEXT NOT NULL,
    ts TIMESTAMP NOT NULL,
    sequence BIGINT,
    price DOUBLE,
    volume DOUBLE,
    turnover DOUBLE,
    current_volume DOUBLE,
    current_turnover DOUBLE,
    PRIMARY KEY (symbol, ts)
);
"""

_SIGNALS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    ts TIMESTAMP NOT NULL,
    action TEXT NOT NULL,
    price DOUBLE,
    reason TEXT,
    status TEXT NOT NULL
);
"""

_ORDERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty DOUBLE NOT NULL,
    price DOUBLE,
    status TEXT NOT NULL,
    ts_created TIMESTAMP NOT NULL,
    ts_updated TIMESTAMP NOT NULL
);
"""

_POSITIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS positions (
    symbol TEXT PRIMARY KEY,
    qty DOUBLE NOT NULL,
    avg_price DOUBLE,
    last_updated TIMESTAMP NOT NULL
);
"""

# A single shared connection guarded by a lock to avoid
# DuckDB "Unique file handle conflict" when opening the same
# database file concurrently from multiple threads.
_CONN: DuckDBPyConnection | None = None
_LOCK = threading.RLock()


@contextmanager
def get_connection():  # -> Iterator[DuckDBPyConnection]
    settings = get_settings()
    settings.ensure_dirs()
    with _LOCK:
        global _CONN
        if _CONN is None:
            _CONN = duckdb.connect(str(settings.duckdb_path))
            _run_migrations(_CONN)
        # Hold the lock for the entire DB operation scope to serialize access
        # and prevent concurrent writes on a single connection.
        yield _CONN


def _run_migrations(conn: DuckDBPyConnection) -> None:
    conn.execute(_SETTINGS_TABLE_SQL)
    conn.execute(_SYMBOLS_TABLE_SQL)
    conn.execute(_OHLC_TABLE_SQL)
    conn.execute(_TICKS_TABLE_SQL)
    conn.execute(_SIGNALS_TABLE_SQL)
    conn.execute(_ORDERS_TABLE_SQL)
    conn.execute(_POSITIONS_TABLE_SQL)
    _ensure_column(conn, "ticks", "sequence", "BIGINT")
    _ensure_column(conn, "ticks", "turnover", "DOUBLE")
    _ensure_column(conn, "ticks", "current_volume", "DOUBLE")
    _ensure_column(conn, "ticks", "current_turnover", "DOUBLE")


def _ensure_column(conn: DuckDBPyConnection, table: str, column: str, column_type: str) -> None:
    info = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
    if column not in {row[1] for row in info}:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
