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
    period TEXT NOT NULL DEFAULT 'day',
    ts TIMESTAMP NOT NULL,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    volume DOUBLE,
    turnover DOUBLE,
    PRIMARY KEY (symbol, period, ts)
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

_MONITORING_EVENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS monitoring_events (
    id TEXT PRIMARY KEY,
    ts TIMESTAMP NOT NULL,
    event_type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    symbol_name TEXT,
    strategy_id TEXT,
    strategy_name TEXT,
    signal_action TEXT,
    price DOUBLE,
    quantity INTEGER,
    pnl DOUBLE,
    pnl_ratio DOUBLE,
    message TEXT,
    details TEXT
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
    conn.execute(_MONITORING_EVENTS_TABLE_SQL)
    
    # AI 自动交易表
    conn.execute(_AI_TRADING_CONFIG_TABLE_SQL)
    conn.execute(_AI_ANALYSIS_LOG_TABLE_SQL)
    conn.execute(_AI_TRADES_TABLE_SQL)
    conn.execute(_AI_POSITIONS_TABLE_SQL)
    conn.execute(_AI_DAILY_SUMMARY_TABLE_SQL)
    
    # 选股系统表
    conn.execute(_STOCK_PICKER_POOLS_TABLE_SQL)
    conn.execute(_STOCK_PICKER_ANALYSIS_TABLE_SQL)
    conn.execute(_STOCK_PICKER_CONFIG_TABLE_SQL)
    
    _ensure_column(conn, "ticks", "sequence", "BIGINT")
    _ensure_column(conn, "ticks", "turnover", "DOUBLE")
    _ensure_column(conn, "ticks", "current_volume", "DOUBLE")
    _ensure_column(conn, "ticks", "current_turnover", "DOUBLE")
    
    # 添加 period 列到 ohlc 表
    _ensure_column(conn, "ohlc", "period", "TEXT NOT NULL DEFAULT 'day'")
    
    # 添加 enable_real_trading 列到 ai_trading_config 表
    _ensure_column(conn, "ai_trading_config", "enable_real_trading", "BOOLEAN DEFAULT false")


def _ensure_column(conn: DuckDBPyConnection, table: str, column: str, column_type: str) -> None:
    info = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
    if column not in {row[1] for row in info}:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")


# ============================================
# AI 自动交易相关表
# ============================================

_AI_TRADING_CONFIG_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ai_trading_config (
    id INTEGER PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    symbols TEXT,
    check_interval_minutes INTEGER DEFAULT 5,
    ai_model TEXT DEFAULT 'deepseek-chat',
    ai_api_key TEXT,
    ai_temperature DOUBLE DEFAULT 0.3,
    min_confidence DOUBLE DEFAULT 0.75,
    max_position_per_stock DOUBLE DEFAULT 50000,
    max_daily_trades INTEGER DEFAULT 20,
    max_loss_per_day DOUBLE DEFAULT 5000,
    enable_stop_loss BOOLEAN DEFAULT true,
    default_stop_loss_percent DOUBLE DEFAULT 5.0,
    enable_real_trading BOOLEAN DEFAULT false,
    position_sizing_method TEXT DEFAULT 'fixed_amount',
    fixed_amount_per_trade DOUBLE DEFAULT 10000,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_AI_ANALYSIS_LOG_TABLE_SQL = """
CREATE SEQUENCE IF NOT EXISTS ai_analysis_log_seq START 1;
CREATE TABLE IF NOT EXISTS ai_analysis_log (
    id INTEGER PRIMARY KEY DEFAULT nextval('ai_analysis_log_seq'),
    symbol TEXT NOT NULL,
    analysis_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    kline_snapshot TEXT,
    indicators TEXT,
    current_price DOUBLE,
    ai_model TEXT,
    ai_prompt TEXT,
    ai_response TEXT,
    action TEXT,
    confidence DOUBLE,
    reasoning TEXT,
    entry_price_min DOUBLE,
    entry_price_max DOUBLE,
    stop_loss_price DOUBLE,
    take_profit_price DOUBLE,
    risk_level TEXT,
    triggered_trade BOOLEAN DEFAULT false,
    trade_id INTEGER,
    skip_reason TEXT
);
"""

_AI_TRADES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ai_trades (
    id INTEGER PRIMARY KEY,
    analysis_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    order_type TEXT DEFAULT 'MARKET',
    order_quantity INTEGER NOT NULL,
    order_price DOUBLE,
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stop_loss_price DOUBLE,
    take_profit_price DOUBLE,
    stop_order_id TEXT,
    status TEXT NOT NULL,
    longbridge_order_id TEXT,
    filled_quantity INTEGER DEFAULT 0,
    filled_price DOUBLE,
    filled_time TIMESTAMP,
    commission DOUBLE DEFAULT 0,
    close_trade_id INTEGER,
    pnl DOUBLE,
    pnl_percent DOUBLE,
    ai_confidence DOUBLE,
    ai_reasoning TEXT,
    error_message TEXT
);
"""

_AI_POSITIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ai_positions (
    id INTEGER PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL,
    quantity INTEGER NOT NULL,
    avg_cost DOUBLE NOT NULL,
    current_price DOUBLE,
    market_value DOUBLE,
    stop_loss_price DOUBLE,
    take_profit_price DOUBLE,
    stop_order_id TEXT,
    open_trade_id INTEGER NOT NULL,
    open_time TIMESTAMP NOT NULL,
    unrealized_pnl DOUBLE,
    unrealized_pnl_percent DOUBLE,
    last_check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_AI_DAILY_SUMMARY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ai_daily_summary (
    id INTEGER PRIMARY KEY,
    trade_date DATE UNIQUE NOT NULL,
    total_trades INTEGER DEFAULT 0,
    buy_count INTEGER DEFAULT 0,
    sell_count INTEGER DEFAULT 0,
    total_pnl DOUBLE DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    win_rate DOUBLE,
    total_analysis INTEGER DEFAULT 0,
    high_confidence_count INTEGER DEFAULT 0,
    avg_confidence DOUBLE,
    starting_balance DOUBLE,
    ending_balance DOUBLE,
    max_drawdown DOUBLE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

# ============================================
# 选股系统相关表
# ============================================

_STOCK_PICKER_POOLS_TABLE_SQL = """
CREATE SEQUENCE IF NOT EXISTS stock_picker_pools_seq START 1;
CREATE TABLE IF NOT EXISTS stock_picker_pools (
    id INTEGER PRIMARY KEY DEFAULT nextval('stock_picker_pools_seq'),
    pool_type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    UNIQUE(pool_type, symbol)
);
CREATE INDEX IF NOT EXISTS idx_pool_type ON stock_picker_pools(pool_type);
CREATE INDEX IF NOT EXISTS idx_is_active ON stock_picker_pools(is_active);
"""

_STOCK_PICKER_ANALYSIS_TABLE_SQL = """
CREATE SEQUENCE IF NOT EXISTS stock_picker_analysis_seq START 1;
CREATE TABLE IF NOT EXISTS stock_picker_analysis (
    id INTEGER PRIMARY KEY DEFAULT nextval('stock_picker_analysis_seq'),
    pool_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    analysis_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_price DOUBLE,
    price_change_1d DOUBLE,
    price_change_5d DOUBLE,
    score_total DOUBLE,
    score_grade TEXT,
    score_trend DOUBLE,
    score_momentum DOUBLE,
    score_volume DOUBLE,
    score_volatility DOUBLE,
    score_pattern DOUBLE,
    ai_action TEXT,
    ai_confidence DOUBLE,
    ai_reasoning TEXT,
    indicators TEXT,
    signals TEXT,
    recommendation_score DOUBLE,
    recommendation_reason TEXT,
    klines_snapshot TEXT
);
CREATE INDEX IF NOT EXISTS idx_analysis_pool ON stock_picker_analysis(pool_id);
CREATE INDEX IF NOT EXISTS idx_analysis_time ON stock_picker_analysis(analysis_time);
CREATE INDEX IF NOT EXISTS idx_recommendation ON stock_picker_analysis(recommendation_score DESC);
"""

_STOCK_PICKER_CONFIG_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS stock_picker_config (
    id INTEGER PRIMARY KEY,
    auto_refresh_enabled BOOLEAN DEFAULT FALSE,
    auto_refresh_interval INTEGER DEFAULT 300,
    max_pool_size INTEGER DEFAULT 20,
    cache_duration INTEGER DEFAULT 300,
    min_score_to_recommend INTEGER DEFAULT 65,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO stock_picker_config (id) VALUES (1);
"""
