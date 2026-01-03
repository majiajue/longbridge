"""
板块轮动分析 API 路由
支持板块、因子、主题 ETF 分析
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..sector_rotation_service import get_sector_rotation_service

router = APIRouter(prefix="/api/sector-rotation", tags=["板块轮动"])


# ========== 请求/响应模型 ==========

class SyncRequest(BaseModel):
    days: int = Field(default=60, ge=10, le=365, description="同步最近多少天的数据")
    etf_type: str = Field(default="sector", description="ETF 类型: sector/index/industry/factor/theme/all")


class ScreenRequest(BaseModel):
    top_n_sectors: int = Field(default=3, ge=1, le=11, description="筛选前N个强势板块")
    stocks_per_sector: int = Field(default=10, ge=1, le=50, description="每个板块筛选的股票数量")
    market_cap_min: float = Field(default=1e9, description="最小市值（美元）")


class AddToPickerRequest(BaseModel):
    pool_type: str = Field(default="LONG", description="池类型: LONG/SHORT")


# ========== API 端点 ==========

@router.post("/sync")
async def sync_sector_data(request: SyncRequest = None):
    """
    同步 ETF 数据

    从 EODHD API 获取 ETF 历史数据并保存到数据库
    支持类型:
    - sector: 板块 ETF (11个)
    - index: 指数 ETF (9个)
    - industry: 行业 ETF (15个)
    - factor: 因子 ETF (14个)
    - theme: 主题 ETF (13个)
    - all: 全部 ETF (62个)
    """
    if request is None:
        request = SyncRequest()

    service = get_sector_rotation_service()
    result = await service.sync_sector_data(days=request.days, etf_type=request.etf_type)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "status": "ok",
        "etf_type": request.etf_type,
        "message": f"同步完成: {len(result['success'])} 成功, {len(result['failed'])} 失败",
        "success": result["success"],
        "failed": result["failed"]
    }


@router.get("/sectors")
async def get_sectors():
    """
    获取所有板块的强度排名

    返回按强度评分排序的板块列表，包含涨跌幅、趋势等信息
    """
    service = get_sector_rotation_service()
    sectors = service.calculate_sector_strength()

    if not sectors:
        return {
            "status": "warning",
            "message": "无板块数据，请先同步",
            "sectors": []
        }

    return {
        "status": "ok",
        "count": len(sectors),
        "sectors": sectors
    }


@router.get("/heatmap")
async def get_heatmap_data():
    """
    获取板块热力图数据

    返回适合热力图可视化的数据格式
    """
    service = get_sector_rotation_service()
    data = service.get_heatmap_data()

    if not data:
        return {
            "status": "warning",
            "message": "无热力图数据，请先同步",
            "data": []
        }

    return {
        "status": "ok",
        "count": len(data),
        "data": data
    }


@router.get("/trend")
async def get_rotation_trend(
    days: int = Query(default=30, ge=7, le=90, description="获取最近多少天的趋势")
):
    """
    获取板块轮动趋势数据

    返回时间序列数据，用于绘制轮动趋势图
    """
    service = get_sector_rotation_service()
    trend = service.get_rotation_trend(days=days)

    if not trend.get("dates"):
        return {
            "status": "warning",
            "message": "无趋势数据，请先同步",
            "dates": [],
            "data": {},
            "sectors": []
        }

    return {
        "status": "ok",
        "days": days,
        **trend
    }


@router.post("/screen")
async def screen_top_sector_stocks(request: ScreenRequest = None):
    """
    筛选强势板块中的股票

    从排名靠前的板块中筛选符合条件的股票
    """
    if request is None:
        request = ScreenRequest()

    service = get_sector_rotation_service()
    result = await service.screen_top_sector_stocks(
        top_n_sectors=request.top_n_sectors,
        stocks_per_sector=request.stocks_per_sector,
        market_cap_min=request.market_cap_min
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # 统计筛选结果
    total_stocks = sum(len(stocks) for stocks in result.get("stocks_by_sector", {}).values())

    return {
        "status": "ok",
        "message": f"从 {len(result.get('sectors', []))} 个板块筛选出 {total_stocks} 只股票",
        **result
    }


@router.get("/stocks")
async def get_sector_stocks(
    sector_symbol: Optional[str] = Query(default=None, description="板块 ETF 代码，为空返回所有")
):
    """
    获取已筛选的板块股票

    返回之前筛选保存的股票列表
    """
    service = get_sector_rotation_service()
    stocks = service.get_sector_stocks(sector_symbol=sector_symbol)

    if not stocks:
        return {
            "status": "warning",
            "message": "无已筛选股票，请先执行筛选",
            "stocks_by_sector": {}
        }

    total = sum(len(s) for s in stocks.values())

    return {
        "status": "ok",
        "total": total,
        "sectors_count": len(stocks),
        "stocks_by_sector": stocks
    }


@router.post("/add-to-picker/{sector_symbol}")
async def add_sector_stocks_to_picker(
    sector_symbol: str,
    request: AddToPickerRequest = None
):
    """
    将板块股票添加到选股池

    把指定板块的股票批量添加到选股系统的做多/做空池
    """
    if request is None:
        request = AddToPickerRequest()

    service = get_sector_rotation_service()
    result = await service.add_sector_stocks_to_picker(
        sector_symbol=sector_symbol,
        pool_type=request.pool_type
    )

    return {
        "status": "ok",
        **result
    }


@router.get("/etf-list")
async def get_etf_list(
    etf_type: Optional[str] = Query(default=None, description="ETF 类型: sector/factor/theme，为空返回全部")
):
    """
    获取支持的 ETF 列表

    返回所有可用的 ETF 及其信息
    """
    service = get_sector_rotation_service()
    etf_list = service.get_etf_list(etf_type=etf_type)

    return {
        "status": "ok",
        "etf_type": etf_type or "all",
        "count": len(etf_list),
        "etfs": etf_list
    }


# ========== Finviz 热力图 ==========

@router.get("/finviz-heatmap")
async def get_finviz_heatmap():
    """
    获取 Finviz 风格的热力图数据

    返回按板块分组的股票数据，适合制作嵌套热力图
    矩形大小代表市值，颜色代表涨跌幅
    """
    service = get_sector_rotation_service()
    data = service.get_finviz_heatmap_data()

    if not data.get("sectors"):
        return {
            "status": "warning",
            "message": "无热力图数据，请先同步板块数据并执行股票筛选",
            "sectors": [],
            "summary": {}
        }

    return {
        "status": "ok",
        **data
    }


# ========== 因子分析 ==========

@router.get("/factors")
async def get_factor_strength():
    """
    获取因子强度排名

    返回按强度评分排序的因子列表，包含各因子的 ETF 表现
    """
    service = get_sector_rotation_service()
    factors = service.calculate_factor_strength()

    if not factors:
        return {
            "status": "warning",
            "message": "无因子数据，请先同步因子 ETF 数据",
            "factors": []
        }

    return {
        "status": "ok",
        "count": len(factors),
        "factors": factors
    }


@router.get("/factor-rotation")
async def get_factor_rotation(
    lookback_days: int = Query(default=20, ge=5, le=60, description="回溯天数")
):
    """
    检测因子轮动信号

    分析因子间的相对强弱变化，识别轮动趋势
    """
    service = get_sector_rotation_service()
    result = service.detect_factor_rotation(lookback_days=lookback_days)

    return {
        "status": "ok",
        "lookback_days": lookback_days,
        **result
    }


# ========== 所有 ETF 表现 ==========

@router.get("/etf-performance")
async def get_etf_performance(
    etf_type: Optional[str] = Query(default=None, description="ETF 类型: sector/factor/theme，为空返回全部")
):
    """
    获取所有 ETF 的表现数据

    返回最新的涨跌幅、趋势等信息
    """
    service = get_sector_rotation_service()
    etfs = service.get_all_etf_performance(etf_type=etf_type)

    if not etfs:
        return {
            "status": "warning",
            "message": "无 ETF 表现数据，请先同步",
            "etfs": []
        }

    return {
        "status": "ok",
        "etf_type": etf_type or "all",
        "count": len(etfs),
        "etfs": etfs
    }
