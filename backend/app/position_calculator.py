"""
智能仓位计算器
根据账户资金、持仓和风险管理规则自动计算买卖数量
"""
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class PositionSizeMethod(Enum):
    """仓位计算方法"""
    FIXED_AMOUNT = "fixed_amount"  # 固定金额
    PERCENTAGE = "percentage"      # 资金百分比
    RISK_BASED = "risk_based"      # 基于风险
    EQUAL_WEIGHT = "equal_weight"  # 等权重

@dataclass
class PositionCalculation:
    """仓位计算结果"""
    symbol: str
    action: str  # 'buy' or 'sell'
    quantity: int
    estimated_price: float
    estimated_cost: float
    reason: str
    risk_level: str  # 'low', 'medium', 'high'
    max_loss: float
    suggested_stop_loss: float
    suggested_take_profit: float

class PositionCalculator:
    """智能仓位计算器"""
    
    def __init__(
        self,
        account_balance: Dict[str, Any],
        current_positions: List[Dict[str, Any]],
        global_settings: Optional[Dict[str, Any]] = None
    ):
        """
        初始化仓位计算器
        
        Args:
            account_balance: 账户余额信息
            current_positions: 当前持仓列表
            global_settings: 全局设置（风险管理参数）
        """
        self.account_balance = account_balance
        self.current_positions = current_positions
        self.global_settings = global_settings or {}
        
        # 解析账户信息
        self.available_cash = self._get_available_cash()
        self.total_market_value = self._calculate_total_market_value()
        self.total_capital = self.available_cash + self.total_market_value
        
    def _get_available_cash(self) -> float:
        """获取可用现金（优先USD）"""
        # 优先使用 USD
        if 'USD' in self.account_balance:
            return float(self.account_balance['USD'].get('available_cash', 0))
        
        # 如果没有 USD，使用其他币种的第一个
        for currency, balance in self.account_balance.items():
            if currency != '_meta' and isinstance(balance, dict):
                return float(balance.get('available_cash', 0))
        
        return 0.0
    
    def _calculate_total_market_value(self) -> float:
        """计算持仓总市值"""
        total = 0.0
        for pos in self.current_positions:
            qty = float(pos.get('qty', 0) or 0)
            avg_price = float(pos.get('avg_price', 0) or 0)
            total += qty * avg_price
        return total
    
    def calculate_buy_quantity(
        self,
        symbol: str,
        current_price: float,
        method: PositionSizeMethod = PositionSizeMethod.PERCENTAGE,
        target_allocation: float = 0.1,  # 10% of capital
        max_risk_per_trade: float = 0.02,  # 2% max risk
        stop_loss_pct: float = 0.05  # 5% stop loss
    ) -> PositionCalculation:
        """
        计算买入数量
        
        Args:
            symbol: 股票代码
            current_price: 当前价格
            method: 计算方法
            target_allocation: 目标仓位比例
            max_risk_per_trade: 单笔最大风险比例
            stop_loss_pct: 止损百分比
            
        Returns:
            PositionCalculation: 计算结果
        """
        # 检查是否已有持仓
        existing_position = self._get_existing_position(symbol)
        if existing_position:
            qty = float(existing_position.get('qty', 0) or 0)
            if qty > 0:
                return PositionCalculation(
                    symbol=symbol,
                    action='hold',
                    quantity=int(qty),
                    estimated_price=current_price,
                    estimated_cost=0,
                    reason=f'已有持仓 {qty} 股',
                    risk_level='low',
                    max_loss=0,
                    suggested_stop_loss=current_price * (1 - stop_loss_pct),
                    suggested_take_profit=current_price * (1 + stop_loss_pct * 3)
                )
        
        # 根据不同方法计算数量
        if method == PositionSizeMethod.PERCENTAGE:
            quantity = self._calculate_by_percentage(
                current_price, target_allocation
            )
        elif method == PositionSizeMethod.RISK_BASED:
            quantity = self._calculate_by_risk(
                current_price, max_risk_per_trade, stop_loss_pct
            )
        elif method == PositionSizeMethod.FIXED_AMOUNT:
            fixed_amount = self.global_settings.get('fixed_position_amount', 10000)
            quantity = int(fixed_amount / current_price) if current_price > 0 else 0
        elif method == PositionSizeMethod.EQUAL_WEIGHT:
            quantity = self._calculate_equal_weight(current_price)
        else:
            quantity = 0
        
        # 确保至少买1股
        quantity = max(1, quantity)
        
        # 计算成本
        estimated_cost = quantity * current_price
        
        # 检查资金是否充足
        if estimated_cost > self.available_cash:
            # 调整数量以适应可用资金（留10%缓冲）
            quantity = int((self.available_cash * 0.9) / current_price)
            quantity = max(1, quantity)
            estimated_cost = quantity * current_price
            reason = f'根据可用资金 ${self.available_cash:.2f} 调整数量'
        else:
            reason = f'使用 {method.value} 方法计算'
        
        # 计算风险指标
        stop_loss_price = current_price * (1 - stop_loss_pct)
        take_profit_price = current_price * (1 + stop_loss_pct * 3)  # 3倍止损作为止盈
        max_loss = quantity * current_price * stop_loss_pct
        
        # 评估风险等级
        risk_ratio = max_loss / self.total_capital if self.total_capital > 0 else 1
        if risk_ratio < 0.01:
            risk_level = 'low'
        elif risk_ratio < 0.02:
            risk_level = 'medium'
        else:
            risk_level = 'high'
        
        return PositionCalculation(
            symbol=symbol,
            action='buy',
            quantity=quantity,
            estimated_price=current_price,
            estimated_cost=estimated_cost,
            reason=reason,
            risk_level=risk_level,
            max_loss=max_loss,
            suggested_stop_loss=stop_loss_price,
            suggested_take_profit=take_profit_price
        )
    
    def calculate_sell_quantity(
        self,
        symbol: str,
        current_price: float,
        sell_percentage: float = 1.0  # 默认全部卖出
    ) -> Optional[PositionCalculation]:
        """
        计算卖出数量
        
        Args:
            symbol: 股票代码
            current_price: 当前价格
            sell_percentage: 卖出比例（0-1）
            
        Returns:
            PositionCalculation or None: 计算结果
        """
        existing_position = self._get_existing_position(symbol)
        
        if not existing_position:
            return None
        
        total_qty = float(existing_position.get('qty', 0) or 0)
        available_qty = float(existing_position.get('available_quantity', total_qty) or 0)
        
        if available_qty <= 0:
            return None
        
        # 计算卖出数量
        sell_qty = int(available_qty * sell_percentage)
        sell_qty = max(1, min(sell_qty, int(available_qty)))
        
        avg_price = float(existing_position.get('avg_price', 0) or 0)
        estimated_proceeds = sell_qty * current_price
        
        # 计算盈亏
        cost = sell_qty * avg_price
        pnl = estimated_proceeds - cost
        pnl_pct = (pnl / cost * 100) if cost > 0 else 0
        
        # 评估风险（卖出风险较低）
        risk_level = 'low' if pnl >= 0 else 'medium'
        
        reason = f'卖出 {sell_percentage*100:.0f}% 持仓'
        if pnl > 0:
            reason += f'，盈利 ${pnl:.2f} ({pnl_pct:.2f}%)'
        else:
            reason += f'，亏损 ${abs(pnl):.2f} ({pnl_pct:.2f}%)'
        
        return PositionCalculation(
            symbol=symbol,
            action='sell',
            quantity=sell_qty,
            estimated_price=current_price,
            estimated_cost=-estimated_proceeds,  # 负数表示收入
            reason=reason,
            risk_level=risk_level,
            max_loss=0,  # 卖出没有额外风险
            suggested_stop_loss=0,
            suggested_take_profit=0
        )
    
    def _calculate_by_percentage(
        self, 
        price: float, 
        percentage: float
    ) -> int:
        """按资金百分比计算数量"""
        target_amount = self.total_capital * percentage
        quantity = int(target_amount / price) if price > 0 else 0
        return quantity
    
    def _calculate_by_risk(
        self,
        price: float,
        max_risk: float,
        stop_loss_pct: float
    ) -> int:
        """基于风险计算数量"""
        # 最大可承受损失金额
        max_loss_amount = self.total_capital * max_risk
        
        # 单股最大损失
        loss_per_share = price * stop_loss_pct
        
        # 计算数量
        if loss_per_share > 0:
            quantity = int(max_loss_amount / loss_per_share)
        else:
            quantity = 0
        
        return quantity
    
    def _calculate_equal_weight(self, price: float) -> int:
        """等权重分配（假设总共想持有N个股票）"""
        target_positions = self.global_settings.get('target_positions', 5)
        
        # 每个仓位的目标金额
        amount_per_position = self.total_capital / target_positions
        
        quantity = int(amount_per_position / price) if price > 0 else 0
        return quantity
    
    def _get_existing_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """获取现有持仓"""
        for pos in self.current_positions:
            if pos.get('symbol', '').upper() == symbol.upper():
                return pos
        return None
    
    def get_portfolio_status(self) -> Dict[str, Any]:
        """获取组合状态摘要"""
        return {
            'total_capital': self.total_capital,
            'available_cash': self.available_cash,
            'market_value': self.total_market_value,
            'cash_ratio': self.available_cash / self.total_capital if self.total_capital > 0 else 0,
            'position_count': len(self.current_positions),
            'positions': [
                {
                    'symbol': pos.get('symbol'),
                    'quantity': pos.get('qty'),
                    'value': float(pos.get('qty', 0) or 0) * float(pos.get('avg_price', 0) or 0)
                }
                for pos in self.current_positions
                if float(pos.get('qty', 0) or 0) > 0
            ]
        }

# 全局实例缓存
_calculator_instance = None

def get_position_calculator(
    account_balance: Optional[Dict[str, Any]] = None,
    current_positions: Optional[List[Dict[str, Any]]] = None,
    global_settings: Optional[Dict[str, Any]] = None
) -> PositionCalculator:
    """获取或创建仓位计算器实例"""
    global _calculator_instance
    
    # 如果提供了新数据，创建新实例
    if account_balance is not None and current_positions is not None:
        _calculator_instance = PositionCalculator(
            account_balance=account_balance,
            current_positions=current_positions,
            global_settings=global_settings
        )
    
    return _calculator_instance

















