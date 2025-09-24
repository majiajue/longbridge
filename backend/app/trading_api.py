"""
Longbridge API Trading Integration
Handles real order placement and management through Longbridge OpenAPI
"""
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from .repositories import load_credentials
from .exceptions import LongbridgeAPIError, LongbridgeDependencyMissing

logger = logging.getLogger(__name__)

class OrderStatus(Enum):
    """Order status enum"""
    PENDING = "pending"
    SUBMITTED = "submitted"
    PARTIAL_FILLED = "partial_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"

class OrderType(Enum):
    """Order type enum"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"

class OrderSide(Enum):
    """Order side enum"""
    BUY = "Buy"
    SELL = "Sell"

@dataclass
class OrderRequest:
    """Order request data structure"""
    symbol: str
    side: OrderSide
    quantity: int
    order_type: OrderType = OrderType.MARKET
    price: Optional[float] = None
    stop_price: Optional[float] = None
    time_in_force: str = "Day"
    remark: Optional[str] = None

@dataclass
class OrderResponse:
    """Order response data structure"""
    order_id: str
    status: OrderStatus
    symbol: str
    side: OrderSide
    quantity: int
    filled_quantity: int
    price: Optional[float]
    filled_price: Optional[float]
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None

class LongbridgeTradingAPI:
    """Longbridge Trading API wrapper"""

    def __init__(self):
        self.credentials = None
        self._load_credentials()

    def _load_credentials(self):
        """Load trading credentials"""
        try:
            self.credentials = load_credentials()
            if not self.credentials or not all(
                self.credentials.get(key) for key in
                ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")
            ):
                logger.warning("Trading credentials not fully configured")
                return False
            return True
        except Exception as e:
            logger.error(f"Error loading credentials: {e}")
            return False

    def _get_trade_context(self):
        """Get TradeContext instance"""
        try:
            from longport.openapi import TradeContext, Config
        except ModuleNotFoundError as exc:
            raise LongbridgeDependencyMissing(
                "longport Python SDK not found. Please run `pip install longport`."
            ) from exc

        if not self.credentials:
            raise LongbridgeAPIError("Trading credentials not configured")

        config = Config(
            app_key=self.credentials["LONGPORT_APP_KEY"],
            app_secret=self.credentials["LONGPORT_APP_SECRET"],
            access_token=self.credentials["LONGPORT_ACCESS_TOKEN"],
        )

        return TradeContext(config)

    async def place_order(self, order_request: OrderRequest) -> OrderResponse:
        """Place a trading order"""
        try:
            ctx = self._get_trade_context()

            # Import required enums from longport
            from longport.openapi import OrderSide as LBOrderSide, OrderType as LBOrderType

            # Convert our enums to longport enums
            lb_side = LBOrderSide.Buy if order_request.side == OrderSide.BUY else LBOrderSide.Sell

            # Map order types
            order_type_map = {
                OrderType.MARKET: LBOrderType.MO,
                OrderType.LIMIT: LBOrderType.LO,
                OrderType.STOP: LBOrderType.SLO,
                OrderType.STOP_LIMIT: LBOrderType.SLO,
            }
            lb_order_type = order_type_map.get(order_request.order_type, LBOrderType.MO)

            try:
                # Submit the order
                response = ctx.submit_order(
                    symbol=order_request.symbol,
                    order_type=lb_order_type,
                    side=lb_side,
                    submitted_quantity=order_request.quantity,
                    submitted_price=order_request.price,
                    time_in_force=order_request.time_in_force,
                    remark=order_request.remark or ""
                )

                # Convert response to our format
                order_response = OrderResponse(
                    order_id=response.order_id,
                    status=OrderStatus.SUBMITTED,  # Initial status
                    symbol=order_request.symbol,
                    side=order_request.side,
                    quantity=order_request.quantity,
                    filled_quantity=0,
                    price=order_request.price,
                    filled_price=None,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )

                logger.info(f"Order placed successfully: {response.order_id}")
                return order_response

            except Exception as e:
                logger.error(f"Failed to place order: {e}")
                return OrderResponse(
                    order_id="",
                    status=OrderStatus.REJECTED,
                    symbol=order_request.symbol,
                    side=order_request.side,
                    quantity=order_request.quantity,
                    filled_quantity=0,
                    price=order_request.price,
                    filled_price=None,
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    error_message=str(e)
                )

        except Exception as e:
            logger.error(f"Error in place_order: {e}")
            raise LongbridgeAPIError(f"Failed to place order: {e}")
        finally:
            try:
                ctx.close()
            except:
                pass

    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an existing order"""
        try:
            ctx = self._get_trade_context()

            try:
                ctx.cancel_order(order_id)
                logger.info(f"Order cancelled successfully: {order_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to cancel order {order_id}: {e}")
                return False

        except Exception as e:
            logger.error(f"Error in cancel_order: {e}")
            return False
        finally:
            try:
                ctx.close()
            except:
                pass

    async def get_order_status(self, order_id: str) -> Optional[OrderResponse]:
        """Get order status"""
        try:
            ctx = self._get_trade_context()

            try:
                # Get today's orders and find the specific order
                orders = ctx.today_orders()

                for order in orders:
                    if order.order_id == order_id:
                        # Map longport status to our status
                        status_map = {
                            "PendingSubmit": OrderStatus.PENDING,
                            "Submitted": OrderStatus.SUBMITTED,
                            "PartialFilled": OrderStatus.PARTIAL_FILLED,
                            "Filled": OrderStatus.FILLED,
                            "Cancelled": OrderStatus.CANCELLED,
                            "Rejected": OrderStatus.REJECTED,
                            "Expired": OrderStatus.EXPIRED
                        }

                        status = status_map.get(order.status, OrderStatus.PENDING)
                        side = OrderSide.BUY if order.side == "Buy" else OrderSide.SELL

                        return OrderResponse(
                            order_id=order.order_id,
                            status=status,
                            symbol=order.symbol,
                            side=side,
                            quantity=order.quantity,
                            filled_quantity=order.executed_quantity or 0,
                            price=order.price,
                            filled_price=order.executed_price,
                            created_at=datetime.fromisoformat(order.created_at.replace('Z', '+00:00')),
                            updated_at=datetime.fromisoformat(order.updated_at.replace('Z', '+00:00'))
                        )

                logger.warning(f"Order not found: {order_id}")
                return None

            except Exception as e:
                logger.error(f"Failed to get order status {order_id}: {e}")
                return None

        except Exception as e:
            logger.error(f"Error in get_order_status: {e}")
            return None
        finally:
            try:
                ctx.close()
            except:
                pass

    async def get_account_balance(self) -> Dict[str, Any]:
        """Get account balance information"""
        try:
            ctx = self._get_trade_context()

            try:
                balance_resp = ctx.account_balance()

                # Parse balance information
                balance_info = {}

                for balance in balance_resp:
                    currency = str(balance.currency)

                    balance_info[currency] = {
                        "total_cash": float(balance.total_cash or 0),
                        "available_cash": float(balance.available_cash or 0),
                        "frozen_cash": float(balance.frozen_cash or 0),
                        "settling_cash": float(balance.settling_cash or 0),
                        "withdraw_cash": float(balance.withdraw_cash or 0),
                        "net_assets": float(balance.net_assets or 0),
                        "init_margin": float(balance.init_margin or 0),
                        "maintenance_margin": float(balance.maintenance_margin or 0),
                        "margin_call": float(balance.margin_call or 0),
                        "currency": currency
                    }

                return balance_info

            except Exception as e:
                logger.error(f"Failed to get account balance: {e}")
                return {}

        except Exception as e:
            logger.error(f"Error in get_account_balance: {e}")
            return {}
        finally:
            try:
                ctx.close()
            except:
                pass

    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions"""
        try:
            ctx = self._get_trade_context()

            try:
                positions_resp = ctx.stock_positions()
                positions = []

                # Process positions from all accounts
                accounts = getattr(positions_resp, 'channels', [])
                if hasattr(positions_resp, 'to_dict'):
                    dict_resp = positions_resp.to_dict()
                    accounts = dict_resp.get('channels', [])

                for account in accounts:
                    account_channel = getattr(account, 'account_channel', 'unknown')
                    stock_items = getattr(account, 'positions', []) or []

                    for position in stock_items:
                        positions.append({
                            'symbol': position.symbol,
                            'symbol_name': getattr(position, 'symbol_name', ''),
                            'currency': str(getattr(position, 'currency', '')),
                            'quantity': float(position.quantity or 0),
                            'available_quantity': float(getattr(position, 'available_quantity', 0) or 0),
                            'cost_price': float(position.cost_price or 0),
                            'market': str(getattr(position, 'market', '')),
                            'account_channel': account_channel
                        })

                return positions

            except Exception as e:
                logger.error(f"Failed to get positions: {e}")
                return []

        except Exception as e:
            logger.error(f"Error in get_positions: {e}")
            return []
        finally:
            try:
                ctx.close()
            except:
                pass

# Global trading API instance
trading_api = None

def get_trading_api() -> LongbridgeTradingAPI:
    """Get or create trading API instance"""
    global trading_api
    if trading_api is None:
        trading_api = LongbridgeTradingAPI()
    return trading_api