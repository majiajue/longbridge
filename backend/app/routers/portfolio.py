from __future__ import annotations

from fastapi import APIRouter

from ..models import PortfolioOverviewResponse, PositionListResponse
from ..services import get_portfolio_overview, get_positions

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/positions", response_model=PositionListResponse)
def fetch_positions() -> PositionListResponse:
    positions = get_positions()
    return PositionListResponse(positions=positions)


@router.get("/overview", response_model=PortfolioOverviewResponse)
def portfolio_overview() -> PortfolioOverviewResponse:
    overview = get_portfolio_overview()
    return PortfolioOverviewResponse(**overview)
