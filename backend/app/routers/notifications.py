"""
Notification API endpoints
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List
import json
import logging
import asyncio

from ..notification_manager import get_notification_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/")
async def get_notifications(limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
    """Get notification history"""
    try:
        notif_manager = get_notification_manager()
        return notif_manager.get_notifications(limit=limit, unread_only=unread_only)
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        return []

@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str) -> Dict[str, str]:
    """Mark a notification as read"""
    try:
        notif_manager = get_notification_manager()
        success = notif_manager.mark_as_read(notification_id)
        if success:
            return {"message": "Notification marked as read"}
        else:
            return {"error": "Notification not found"}
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return {"error": str(e)}

@router.post("/read-all")
async def mark_all_notifications_read() -> Dict[str, str]:
    """Mark all notifications as read"""
    try:
        notif_manager = get_notification_manager()
        notif_manager.mark_all_as_read()
        return {"message": "All notifications marked as read"}
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        return {"error": str(e)}

@router.delete("/")
async def clear_notifications() -> Dict[str, str]:
    """Clear all notifications"""
    try:
        notif_manager = get_notification_manager()
        notif_manager.clear_notifications()
        return {"message": "All notifications cleared"}
    except Exception as e:
        logger.error(f"Error clearing notifications: {e}")
        return {"error": str(e)}

@router.websocket("/ws")
async def notification_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications"""
    await websocket.accept()
    logger.info("Notification WebSocket client connected")

    notif_manager = get_notification_manager()
    queue = notif_manager.add_listener()

    try:
        while True:
            # Wait for notifications to broadcast
            try:
                notification_data = await queue.get()
                await websocket.send_text(json.dumps(notification_data))
            except asyncio.QueueEmpty:
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.error(f"Error sending notification via WebSocket: {e}")
                break

    except WebSocketDisconnect:
        logger.info("Notification WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Notification WebSocket error: {e}")
    finally:
        notif_manager.remove_listener(queue)
        try:
            await websocket.close()
        except:
            pass