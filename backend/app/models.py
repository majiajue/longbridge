from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from pydantic import BaseModel, Field


class CredentialPayload(BaseModel):
    LONGPORT_APP_KEY: str = Field(..., description="Longbridge App Key")
    LONGPORT_APP_SECRET: str = Field(..., description="Longbridge App Secret")
    LONGPORT_ACCESS_TOKEN: str = Field(..., description="Longbridge Access Token")


class CredentialResponse(BaseModel):
    LONGPORT_APP_KEY: Optional[str] = None
    LONGPORT_APP_SECRET: Optional[str] = None
    LONGPORT_ACCESS_TOKEN: Optional[str] = None


class AICredentialPayload(BaseModel):
    DEEPSEEK_API_KEY: str = Field(..., description="DeepSeek API Key")
    TAVILY_API_KEY: Optional[str] = Field(None, description="Tavily API Key (可选)")


class AICredentialResponse(BaseModel):
    DEEPSEEK_API_KEY: Optional[str] = None
    TAVILY_API_KEY: Optional[str] = None


class SymbolPayload(BaseModel):
    symbols: List[str] = Field(default_factory=list)


class SymbolResponse(BaseModel):
    symbols: List[str] = Field(default_factory=list)


class VerifyPayload(BaseModel):
    symbols: List[str] = Field(default_factory=list)


class VerifyResponse(BaseModel):
    status: str
    tested_symbols: str


class HistorySyncPayload(BaseModel):
    symbols: List[str] = Field(default_factory=list, description="需要同步的股票代码列表；为空则使用已保存列表")
    period: str = Field(default="day", description="周期，如 day、min1、week")
    adjust_type: str = Field(default="no_adjust", description="复权类型: no_adjust/forward_adjust/backward_adjust")
    count: int = Field(default=120, ge=1, le=1000, description="每只股票拉取的K线数量")


class HistorySyncResponse(BaseModel):
    status: str = "ok"
    processed: Dict[str, int]
    period: str
    adjust_type: str


class CandlestickModel(BaseModel):
    ts: datetime
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[float] = None
    turnover: Optional[float] = None


class HistoryBarsResponse(BaseModel):
    symbol: str
    period: str
    adjust_type: str
    bars: List[CandlestickModel]


class TickModel(BaseModel):
    ts: datetime
    sequence: Optional[int] = None
    price: Optional[float] = None
    volume: Optional[float] = None
    turnover: Optional[float] = None
    current_volume: Optional[float] = None
    current_turnover: Optional[float] = None


class TickListResponse(BaseModel):
    symbol: str
    limit: int
    ticks: List[TickModel]


class StreamStatusResponse(BaseModel):
    status: str
    detail: Optional[str] = None
    subscribed: List[str] = Field(default_factory=list)
    listeners: int = 0
    last_quote_at: Optional[datetime] = None


class PositionListResponse(BaseModel):
    positions: List[PortfolioPosition] = Field(default_factory=list)


class PortfolioPosition(BaseModel):
    symbol: str
    symbol_name: Optional[str] = None
    currency: Optional[str] = None
    market: Optional[str] = None
    qty: float
    available_quantity: Optional[float] = None
    avg_price: float
    cost_value: float
    last_price: Optional[float] = None
    last_price_time: Optional[datetime] = None
    market_value: float
    pnl: float
    pnl_percent: float
    day_pnl: float = 0.0
    day_pnl_percent: float = 0.0
    account_channel: Optional[str] = None
    direction: str


class PortfolioTotals(BaseModel):
    cost: float
    market_value: float
    pnl: float
    pnl_percent: float
    day_pnl: float = 0.0
    day_pnl_percent: float = 0.0


class AccountBalance(BaseModel):
    currency: str
    total_cash: float
    max_finance_amount: float
    remaining_finance_amount: float
    risk_level: Optional[str] = None
    margin_call: float
    net_assets: float
    init_margin: float
    maintenance_margin: float


class PortfolioOverviewResponse(BaseModel):
    positions: List[PortfolioPosition] = Field(default_factory=list)
    totals: PortfolioTotals
    account_balance: Dict[str, Dict] = Field(default_factory=dict)


# Monitoring models
class MonitoringStatus(str, Enum):
    ENABLED = "enabled"
    DISABLED = "disabled"
    PAUSED = "paused"


class StrategyMode(str, Enum):
    AUTO = "auto"              # 自动执行交易
    ALERT_ONLY = "alert_only"  # 仅发送告警
    DISABLED = "disabled"      # 禁用策略
    BALANCED = "balanced"      # 平衡模式（向后兼容）


class PositionMonitoringConfig(BaseModel):
    symbol: str
    monitoring_status: MonitoringStatus = MonitoringStatus.ENABLED
    strategy_mode: StrategyMode = StrategyMode.ALERT_ONLY  # 默认仅告警，安全优先
    enabled_strategies: List[str] = Field(default_factory=list)
    max_position_ratio: float = Field(default=0.1, ge=0.01, le=1.0)
    stop_loss_ratio: float = Field(default=0.05, ge=0.01, le=0.3)
    take_profit_ratio: float = Field(default=0.1, ge=0.02, le=1.0)
    cooldown_minutes: int = Field(default=30, ge=1, le=1440)
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GlobalMonitoringSettings(BaseModel):
    global_enabled: bool = True
    market_hours_only: bool = True
    max_daily_trades: int = Field(default=20, ge=1, le=100)
    max_total_exposure: float = Field(default=0.8, ge=0.1, le=1.0)
    emergency_stop: bool = False
    risk_level: str = Field(default="medium")
    notifications_enabled: bool = True
    excluded_symbols: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PositionWithMonitoring(BaseModel):
    symbol: str
    symbol_name: Optional[str] = None
    currency: Optional[str] = None
    market: Optional[str] = None
    qty: float
    available_quantity: Optional[float] = None
    avg_price: float
    cost_value: float
    last_price: Optional[float] = None
    last_price_time: Optional[datetime] = None
    market_value: float
    pnl: float
    pnl_percent: float
    day_pnl: float = 0.0
    day_pnl_percent: float = 0.0
    account_channel: Optional[str] = None
    direction: str
    monitoring_config: Optional[PositionMonitoringConfig] = None


class MonitoringConfigResponse(BaseModel):
    positions: List[PositionWithMonitoring] = Field(default_factory=list)
    global_settings: GlobalMonitoringSettings


class UpdateMonitoringConfigRequest(BaseModel):
    monitoring_status: Optional[MonitoringStatus] = None
    strategy_mode: Optional[StrategyMode] = None
    enabled_strategies: Optional[List[str]] = None
    max_position_ratio: Optional[float] = None
    stop_loss_ratio: Optional[float] = None
    take_profit_ratio: Optional[float] = None
    cooldown_minutes: Optional[int] = None
    notes: Optional[str] = None


class BatchMonitoringUpdateRequest(BaseModel):
    symbols: List[str]
    config: UpdateMonitoringConfigRequest


class GlobalMonitoringUpdateRequest(BaseModel):
    global_enabled: Optional[bool] = None
    market_hours_only: Optional[bool] = None
    max_daily_trades: Optional[int] = None
    max_total_exposure: Optional[float] = None
    emergency_stop: Optional[bool] = None
    risk_level: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    excluded_symbols: Optional[List[str]] = None


class MonitoringEventType(str, Enum):
    """监控事件类型"""
    SIGNAL_GENERATED = "signal_generated"
    TRADE_EXECUTED = "trade_executed"
    STOP_LOSS_TRIGGERED = "stop_loss_triggered"
    TAKE_PROFIT_TRIGGERED = "take_profit_triggered"
    ALERT_SENT = "alert_sent"
    RISK_WARNING = "risk_warning"
    CONFIG_CHANGED = "config_changed"


class MonitoringEvent(BaseModel):
    """监控历史事件"""
    id: Optional[str] = None
    timestamp: datetime
    event_type: MonitoringEventType
    symbol: str
    symbol_name: Optional[str] = None
    strategy_id: Optional[str] = None
    strategy_name: Optional[str] = None
    signal_action: Optional[str] = None  # BUY/SELL
    price: Optional[float] = None
    quantity: Optional[int] = None
    pnl: Optional[float] = None
    pnl_ratio: Optional[float] = None
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class MonitoringEventListResponse(BaseModel):
    """监控事件列表响应"""
    events: List[MonitoringEvent] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 50
