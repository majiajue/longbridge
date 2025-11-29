"""
AI配置管理路由 - 用于配置Tavily API Key
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
import logging

from ..repositories import save_ai_credentials, load_ai_credentials

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai-config", tags=["AI配置"])


class TavilyConfig(BaseModel):
    """Tavily配置"""
    api_key: str


@router.post("/tavily")
async def save_tavily_config(config: TavilyConfig):
    """
    保存Tavily API Key
    """
    try:
        # 加载现有配置
        existing_creds = load_ai_credentials()
        
        # 更新Tavily API Key
        existing_creds['TAVILY_API_KEY'] = config.api_key
        
        # 保存
        save_ai_credentials(existing_creds)
        
        logger.info("✅ Tavily API Key已保存")
        
        return {
            "status": "success",
            "message": "Tavily API Key已保存"
        }
    except Exception as e:
        logger.error(f"❌ 保存Tavily API Key失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tavily/status")
async def get_tavily_status():
    """
    检查Tavily配置状态
    """
    try:
        creds = load_ai_credentials()
        tavily_key = creds.get('TAVILY_API_KEY')
        
        return {
            "configured": bool(tavily_key),
            "key_preview": f"{tavily_key[:10]}..." if tavily_key else None
        }
    except Exception as e:
        logger.error(f"❌ 检查Tavily状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))






