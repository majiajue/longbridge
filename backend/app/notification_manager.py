"""
Notification Management System
Handles real-time notifications for trading events and system status
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

class NotificationType(Enum):
    """Notification types"""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    TRADE_SIGNAL = "trade_signal"
    ORDER_UPDATE = "order_update"
    STRATEGY_UPDATE = "strategy_update"

@dataclass
class Notification:
    """Notification data structure"""
    id: str
    type: NotificationType
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime = None
    read: bool = False

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

class NotificationManager:
    """Centralized notification management"""

    def __init__(self):
        self._listeners: Set[asyncio.Queue] = set()
        self._notifications: List[Notification] = []
        self._max_history = 1000
        self._notification_counter = 0

    def add_listener(self) -> asyncio.Queue:
        """Add a notification listener (WebSocket client)"""
        queue = asyncio.Queue(maxsize=50)
        self._listeners.add(queue)
        return queue

    def remove_listener(self, queue: asyncio.Queue):
        """Remove a notification listener"""
        self._listeners.discard(queue)

    async def send_notification(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Send a notification to all listeners"""

        self._notification_counter += 1
        notification = Notification(
            id=f"notif_{self._notification_counter}_{int(datetime.now().timestamp())}",
            type=notification_type,
            title=title,
            message=message,
            data=data or {}
        )

        # Add to history
        self._notifications.append(notification)
        if len(self._notifications) > self._max_history:
            self._notifications.pop(0)

        # Log the notification
        log_level = {
            NotificationType.INFO: logging.INFO,
            NotificationType.SUCCESS: logging.INFO,
            NotificationType.WARNING: logging.WARNING,
            NotificationType.ERROR: logging.ERROR,
            NotificationType.TRADE_SIGNAL: logging.INFO,
            NotificationType.ORDER_UPDATE: logging.INFO,
            NotificationType.STRATEGY_UPDATE: logging.INFO,
        }.get(notification_type, logging.INFO)

        logger.log(log_level, f"[{title}] {message}")

        # Broadcast to all listeners
        payload = {
            "type": "notification",
            "data": {
                "id": notification.id,
                "type": notification.type.value,
                "title": notification.title,
                "message": notification.message,
                "data": notification.data,
                "timestamp": notification.timestamp.isoformat(),
                "read": notification.read
            }
        }

        # Send to all connected clients
        disconnected = []
        for queue in self._listeners.copy():
            try:
                if queue.full():
                    # Remove oldest item if queue is full
                    try:
                        await asyncio.wait_for(queue.get(), timeout=0.1)
                    except asyncio.TimeoutError:
                        pass

                await queue.put(payload)
            except Exception as e:
                logger.warning(f"Failed to send notification to client: {e}")
                disconnected.append(queue)

        # Clean up disconnected clients
        for queue in disconnected:
            self.remove_listener(queue)

        return notification

    async def send_trading_signal(
        self,
        strategy_id: str,
        symbol: str,
        signal_type: str,
        price: float,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Send a trading signal notification"""
        data = {
            "strategy_id": strategy_id,
            "symbol": symbol,
            "signal_type": signal_type,
            "price": price,
            **(additional_data or {})
        }

        await self.send_notification(
            NotificationType.TRADE_SIGNAL,
            f"交易信号 - {symbol}",
            f"策略 {strategy_id} 发出 {signal_type} 信号，价格 {price}",
            data
        )

    async def send_order_update(
        self,
        order_id: str,
        symbol: str,
        status: str,
        side: str,
        quantity: int,
        price: float,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Send an order status update notification"""
        data = {
            "order_id": order_id,
            "symbol": symbol,
            "status": status,
            "side": side,
            "quantity": quantity,
            "price": price,
            **(additional_data or {})
        }

        status_text = {
            "submitted": "已提交",
            "filled": "已成交",
            "partial_filled": "部分成交",
            "cancelled": "已取消",
            "rejected": "已拒绝"
        }.get(status, status)

        notification_type = NotificationType.SUCCESS if status == "filled" else NotificationType.INFO
        if status in ["cancelled", "rejected"]:
            notification_type = NotificationType.WARNING

        await self.send_notification(
            notification_type,
            f"订单更新 - {symbol}",
            f"{side.upper()} 订单{status_text}，数量 {quantity}，价格 {price}",
            data
        )

    async def send_strategy_update(
        self,
        strategy_id: str,
        strategy_name: str,
        status: str,
        message: str,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Send a strategy status update notification"""
        data = {
            "strategy_id": strategy_id,
            "strategy_name": strategy_name,
            "status": status,
            **(additional_data or {})
        }

        await self.send_notification(
            NotificationType.STRATEGY_UPDATE,
            f"策略更新 - {strategy_name}",
            message,
            data
        )

    async def send_error(self, title: str, error: str, additional_data: Optional[Dict[str, Any]] = None):
        """Send an error notification"""
        await self.send_notification(
            NotificationType.ERROR,
            title,
            error,
            additional_data
        )

    async def send_warning(self, title: str, message: str, additional_data: Optional[Dict[str, Any]] = None):
        """Send a warning notification"""
        await self.send_notification(
            NotificationType.WARNING,
            title,
            message,
            additional_data
        )

    async def send_success(self, title: str, message: str, additional_data: Optional[Dict[str, Any]] = None):
        """Send a success notification"""
        await self.send_notification(
            NotificationType.SUCCESS,
            title,
            message,
            additional_data
        )

    async def send_info(self, title: str, message: str, additional_data: Optional[Dict[str, Any]] = None):
        """Send an info notification"""
        await self.send_notification(
            NotificationType.INFO,
            title,
            message,
            additional_data
        )

    def get_notifications(self, limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
        """Get notification history"""
        notifications = self._notifications

        if unread_only:
            notifications = [n for n in notifications if not n.read]

        # Return most recent notifications first
        notifications = notifications[-limit:] if limit else notifications
        notifications.reverse()

        return [
            {
                "id": n.id,
                "type": n.type.value,
                "title": n.title,
                "message": n.message,
                "data": n.data,
                "timestamp": n.timestamp.isoformat(),
                "read": n.read
            }
            for n in notifications
        ]

    def mark_as_read(self, notification_id: str) -> bool:
        """Mark a notification as read"""
        for notification in self._notifications:
            if notification.id == notification_id:
                notification.read = True
                return True
        return False

    def mark_all_as_read(self):
        """Mark all notifications as read"""
        for notification in self._notifications:
            notification.read = True

    def clear_notifications(self):
        """Clear all notifications"""
        self._notifications.clear()

# Global notification manager instance
_notification_manager = None

def get_notification_manager() -> NotificationManager:
    """Get or create global notification manager instance"""
    global _notification_manager
    if _notification_manager is None:
        _notification_manager = NotificationManager()
    return _notification_manager