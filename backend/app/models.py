from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class CredentialPayload(BaseModel):
    LONGPORT_APP_KEY: str = Field(..., description="Longbridge App Key")
    LONGPORT_APP_SECRET: str = Field(..., description="Longbridge App Secret")
    LONGPORT_ACCESS_TOKEN: str = Field(..., description="Longbridge Access Token")


class CredentialResponse(BaseModel):
    LONGPORT_APP_KEY: Optional[str] = None
    LONGPORT_APP_SECRET: Optional[str] = None
    LONGPORT_ACCESS_TOKEN: Optional[str] = None


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
