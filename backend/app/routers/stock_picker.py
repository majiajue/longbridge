"""
选股系统 API 路由
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import logging
import json
import asyncio

from ..stock_picker import get_stock_picker_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stock-picker", tags=["stock-picker"])

# 全局进度状态
analysis_progress = {
    'current': None,
    'total': 0,
    'completed': 0,
    'status': 'idle',  # idle, running, completed
    'logs': []
}


# ========== 请求/响应模型 ==========

class AddStockRequest(BaseModel):
    pool_type: str  # LONG 或 SHORT
    symbol: str
    name: Optional[str] = None
    added_reason: Optional[str] = None
    priority: Optional[int] = 0


class BatchAddStocksRequest(BaseModel):
    pool_type: str
    symbols: List[str]  # 股票代码列表


class AnalyzeRequest(BaseModel):
    pool_type: Optional[str] = None  # LONG/SHORT/None(全部)
    force_refresh: bool = False


# ========== API 端点 ==========

@router.get("/pools")
async def get_pools(pool_type: Optional[str] = None):
    """
    获取股票池
    
    Args:
        pool_type: LONG | SHORT | None(全部)
    """
    try:
        service = get_stock_picker_service()
        pools = service.get_pools(pool_type)
        return pools
    except Exception as e:
        logger.error(f"获取股票池失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pools")
async def add_stock(request: AddStockRequest):
    """
    添加股票到池
    """
    try:
        service = get_stock_picker_service()
        stock_id = service.add_stock(
            pool_type=request.pool_type,
            symbol=request.symbol,
            name=request.name,
            added_reason=request.added_reason,
            priority=request.priority
        )
        return {
            "success": True,
            "id": stock_id,
            "message": f"成功添加 {request.symbol} 到 {request.pool_type} 池"
        }
    except Exception as e:
        logger.error(f"添加股票失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pools/batch")
async def batch_add_stocks(request: BatchAddStocksRequest):
    """
    批量添加股票
    """
    try:
        service = get_stock_picker_service()
        result = service.batch_add_stocks(
            pool_type=request.pool_type,
            symbols=request.symbols
        )
        return result
    except Exception as e:
        logger.error(f"批量添加失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pools/{pool_id}")
async def remove_stock(pool_id: int):
    """
    从池中移除股票
    """
    try:
        service = get_stock_picker_service()
        service.remove_stock(pool_id)
        return {"success": True, "message": "移除成功"}
    except Exception as e:
        logger.error(f"移除股票失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pools/clear/{pool_type}")
async def clear_pool(pool_type: str):
    """
    清空指定类型的股票池
    
    Args:
        pool_type: LONG | SHORT
    """
    try:
        if pool_type not in ['LONG', 'SHORT']:
            raise HTTPException(status_code=400, detail="pool_type 必须是 LONG 或 SHORT")
        
        service = get_stock_picker_service()
        count = service.clear_pool(pool_type)
        return {"success": True, "message": f"已清空{count}只股票", "count": count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"清空股票池失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/pools/{pool_id}/toggle")
async def toggle_stock(pool_id: int):
    """
    切换股票激活状态
    """
    try:
        service = get_stock_picker_service()
        service.toggle_active(pool_id)
        return {"success": True, "message": "切换成功"}
    except Exception as e:
        logger.error(f"切换状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_pools(request: AnalyzeRequest):
    """
    触发批量分析
    
    Args:
        pool_type: LONG | SHORT | None(全部)
        force_refresh: 是否强制刷新缓存
    """
    try:
        service = get_stock_picker_service()
        
        logger.info(f"开始分析: pool_type={request.pool_type}, force={request.force_refresh}")
        
        # 重置进度状态
        analysis_progress['status'] = 'idle'
        analysis_progress['total'] = 0
        analysis_progress['completed'] = 0
        analysis_progress['current'] = None
        analysis_progress['logs'] = []
        
        # 定义进度回调
        def update_progress(data: dict):
            if 'status' in data:
                analysis_progress['status'] = data['status']
            if 'total' in data:
                analysis_progress['total'] = data['total']
            if 'completed' in data:
                analysis_progress['completed'] = data['completed']
            if 'current' in data:
                analysis_progress['current'] = data['current']
            if 'log' in data:
                analysis_progress['logs'].append({
                    'time': asyncio.get_event_loop().time(),
                    'message': data['log']
                })
                # 保持最近50条日志
                if len(analysis_progress['logs']) > 50:
                    analysis_progress['logs'] = analysis_progress['logs'][-50:]
        
        result = await service.analyze_pool(
            pool_type=request.pool_type,
            force_refresh=request.force_refresh,
            progress_callback=update_progress
        )
        
        return {
            "success": True,
            "result": result,
            "message": f"分析完成: 总计{result['total']}只, 成功{result['success']}只"
        }
    except Exception as e:
        analysis_progress['status'] = 'error'
        analysis_progress['logs'].append({
            'time': asyncio.get_event_loop().time(),
            'message': f'❌ 错误: {str(e)}'
        })
        logger.error(f"批量分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/progress")
async def get_analysis_progress():
    """
    获取实时分析进度 (SSE)
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        """生成SSE事件"""
        try:
            while True:
                # 发送当前进度
                progress_data = {
                    'current': analysis_progress['current'],
                    'total': analysis_progress['total'],
                    'completed': analysis_progress['completed'],
                    'status': analysis_progress['status'],
                    'logs': analysis_progress['logs'][-10:]  # 最后10条日志
                }
                
                yield f"data: {json.dumps(progress_data, ensure_ascii=False)}\n\n"
                
                # 如果已完成，停止推送
                if analysis_progress['status'] == 'completed':
                    break
                
                await asyncio.sleep(0.5)  # 每0.5秒推送一次
        except asyncio.CancelledError:
            pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/analysis")
async def get_analysis_results(
    pool_type: Optional[str] = None,
    sort_by: str = 'recommendation',
    limit: int = 100
):
    """
    获取分析结果（排序）
    
    Args:
        pool_type: LONG | SHORT | None(全部)
        sort_by: recommendation | score | confidence
        limit: 返回数量
    """
    try:
        service = get_stock_picker_service()
        results = service.get_analysis_results(
            pool_type=pool_type,
            sort_by=sort_by,
            limit=limit
        )
        return results
    except Exception as e:
        logger.error(f"获取分析结果失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{symbol}")
async def get_symbol_analysis(symbol: str):
    """
    获取单个股票的详细分析
    """
    try:
        service = get_stock_picker_service()
        results = service.get_analysis_results()
        
        # 查找该股票
        for item in results['long_analysis'] + results['short_analysis']:
            if item['symbol'] == symbol:
                return item
        
        raise HTTPException(status_code=404, detail=f"未找到 {symbol} 的分析结果")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取股票详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_statistics():
    """
    获取统计信息
    """
    try:
        service = get_stock_picker_service()
        pools = service.get_pools()
        results = service.get_analysis_results()
        
        return {
            "pools": {
                "long_count": len(pools['long_pool']),
                "short_count": len(pools['short_pool'])
            },
            "analysis": results['stats']
        }
    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

