from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Dict, Iterable, List, Optional

from fastapi import HTTPException

from .exceptions import LongbridgeAPIError, LongbridgeDependencyMissing
from .repositories import (
    fetch_candlesticks,
    fetch_latest_prices,
    load_credentials,
    load_symbols,
    store_candlesticks,
    _safe_float,
)


logger = logging.getLogger(__name__)

_PERIOD_NAME_MAP = {
    "min1": "Min_1",
    "min5": "Min_5",
    "min15": "Min_15",
    "min30": "Min_30",
    "min60": "Min_60",
    "min240": "Min_240",
    "day": "Day",
    "week": "Week",
    "month": "Month",
    "year": "Year",
}

_ADJUST_NAME_MAP = {
    "no_adjust": "NoAdjust",
    "forward_adjust": "ForwardAdjust",
    "backward_adjust": "BackwardAdjust",
}


@contextmanager
def _quote_context(creds: Dict[str, str]):
    try:
        from longport.openapi import QuoteContext, Config
    except ModuleNotFoundError as exc:  # pragma: no cover - depends on environment
        raise LongbridgeDependencyMissing(
            "未找到 longport Python SDK，请先运行 `pip install longport`。"
        ) from exc

    config = Config(
        app_key=creds.get("LONGPORT_APP_KEY", ""),
        app_secret=creds.get("LONGPORT_APP_SECRET", ""),
        access_token=creds.get("LONGPORT_ACCESS_TOKEN", ""),
    )
    ctx = QuoteContext(config)
    try:
        yield ctx
    finally:  # pragma: no branch
        try:
            ctx.close()
        except Exception:  # noqa: S110 - best effort cleanup
            pass


def verify_quote_access(symbols: Optional[Iterable[str]] = None) -> dict[str, str]:
    creds = load_credentials()
    if not creds or any(not creds.get(key) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")):
        raise HTTPException(status_code=400, detail="请先配置完整的 Longbridge 凭据。")

    symbols_list = list(symbols or [])
    if not symbols_list:
        symbols_list = ["700.HK"]

    with _quote_context(creds) as ctx:
        try:
            ctx.quote(symbols_list)
        except Exception as exc:
            raise LongbridgeAPIError(str(exc)) from exc

    return {"status": "ok", "tested_symbols": ",".join(symbols_list)}


def sync_history_candlesticks(
    symbols: Optional[Iterable[str]] = None,
    period: str = "day",
    adjust_type: str = "no_adjust",
    count: int = 120,
    forward: bool = False,  # Changed to False to get historical data
) -> Dict[str, int]:
    if count <= 0:
        raise ValueError("count 必须大于 0")
    if count > 1000:
        raise ValueError("count 不能超过 1000 条，以避免超额拉取")

    creds = load_credentials()
    if not creds or any(not creds.get(key) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")):
        raise HTTPException(status_code=400, detail="请先配置完整的 Longbridge 凭据。")

    symbol_list = list(symbols or load_symbols())
    if not symbol_list:
        raise HTTPException(status_code=400, detail="请至少配置一只股票代码。")

    try:
        period_enum_name = _PERIOD_NAME_MAP[period.lower()]
    except KeyError as exc:
        raise ValueError(f"不支持的周期类型: {period}") from exc

    try:
        adjust_enum_name = _ADJUST_NAME_MAP[adjust_type.lower()]
    except KeyError as exc:
        raise ValueError(f"不支持的复权类型: {adjust_type}") from exc

    try:
        from longport.openapi import Period, AdjustType
    except ModuleNotFoundError as exc:  # pragma: no cover - depends on environment
        raise LongbridgeDependencyMissing(
            "未找到 longport Python SDK，请先运行 `pip install longport`。"
        ) from exc

    period_enum = getattr(Period, period_enum_name)
    adjust_enum = getattr(AdjustType, adjust_enum_name)

    results: Dict[str, int] = {}

    with _quote_context(creds) as ctx:
        for symbol in symbol_list:
            try:
                # Use candlesticks method which can fetch up to 1000 records
                candles = ctx.candlesticks(
                    symbol,
                    period_enum,
                    count,
                    adjust_enum,
                )

                # Log how many candles we got
                logger.info(f"Got {len(candles)} candles for {symbol} using candlesticks()")

                # If no data from candlesticks, try history_candlesticks_by_offset as fallback
                if not candles:
                    logger.info(f"No data from candlesticks(), trying history_candlesticks_by_offset()")
                    candles = ctx.history_candlesticks_by_offset(
                        symbol,
                        period_enum,
                        adjust_enum,
                        forward,
                        count,
                    )
                    logger.info(f"Got {len(candles)} candles for {symbol} using history_candlesticks_by_offset()")
            except Exception as exc:
                raise LongbridgeAPIError(f"{symbol}: {exc}") from exc
            inserted = store_candlesticks(symbol, candles)
            logger.info(f"Inserted {inserted} records for {symbol}")
            results[symbol] = inserted

    return results


def get_cached_candlesticks(symbol: str, limit: int = 200) -> List[Dict[str, float]]:
    if limit <= 0:
        raise ValueError("limit 必须大于 0")
    return fetch_candlesticks(symbol, limit)


def _build_longport_config(creds: Dict[str, str]):
    missing = [key for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN") if not creds.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail="请先配置完整的 Longbridge 凭据。")

    try:
        from longport.openapi import Config
    except ModuleNotFoundError as exc:  # pragma: no cover - depends on environment
        raise LongbridgeDependencyMissing(
            "未找到 longport Python SDK，请先运行 `pip install longport`。"
        ) from exc

    return Config(
        app_key=creds["LONGPORT_APP_KEY"],
        app_secret=creds["LONGPORT_APP_SECRET"],
        access_token=creds["LONGPORT_ACCESS_TOKEN"],
    )


def get_positions() -> List[Dict[str, object]]:
    creds = load_credentials()
    logger.info(
        "get_positions: loaded credentials (keys present: %s)",
        {key: bool(creds.get(key)) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")},
    )
    config = _build_longport_config(creds)
    logger.info("get_positions: built longport Config, requesting stock positions")

    try:
        from longport.openapi import TradeContext
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise LongbridgeDependencyMissing(
            "未找到 longport Python SDK，请先运行 `pip install longport`。"
        ) from exc

    ctx = TradeContext(config)
    try:
        response = ctx.stock_positions()
        logger.info(
            "get_positions: received response type=%s", type(response).__name__
        )
    except Exception as exc:  # pragma: no cover - network errors
        raise LongbridgeAPIError(f"获取持仓信息失败: {exc}") from exc
    finally:  # ensure context close
        try:
            ctx.close()
        except Exception:  # noqa: S110 - cleanup best effort
            pass

    positions: List[Dict[str, object]] = []

    if response is None:
        return positions

    accounts: Iterable = []
    if hasattr(response, "to_dict") and callable(response.to_dict):
        data_dict = response.to_dict() or {}
        logger.info("get_positions: response.to_dict keys=%s", list(data_dict.keys()))
        # 部分版本下为 {"channels": [...]}
        if "channels" in data_dict:
            accounts = data_dict.get("channels", []) or []
        else:
            accounts = data_dict.get("list", []) or []
    elif hasattr(response, "channels"):
        accounts = getattr(response, "channels") or []
    elif hasattr(response, "list"):
        accounts = getattr(response, "list") or []
    else:  # fallback to iterable response
        accounts = list(response) if hasattr(response, "__iter__") else []  # type: ignore[arg-type]

    for account in accounts or []:
        logger.info("get_positions: raw account=%s", account)
        if isinstance(account, dict):
            account_channel = account.get("account_channel") or account.get("channel")
            stock_items = (
                account.get("positions")
                or account.get("stock_positions")
                or account.get("stock_info")
                or account.get("stock_list")
                or []
            )
        else:
            account_channel = getattr(account, "account_channel", None) or getattr(account, "channel", None)
            stock_items = (
                getattr(account, "positions", None)
                or getattr(account, "stock_positions", None)
                or getattr(account, "stock_info", None)
                or getattr(account, "stock_list", None)
                or []
            )
        logger.info(
            "get_positions: account channel=%s, stock_items type=%s len=%s",
            account_channel,
            type(stock_items).__name__,
            len(stock_items) if hasattr(stock_items, "__len__") else "?",
        )

        for item in stock_items:
            if isinstance(item, dict):
                symbol = item.get("symbol")
                symbol_name = item.get("symbol_name")
                currency = item.get("currency")
                qty = _safe_float(item.get("quantity")) or 0.0
                available = _safe_float(item.get("available_quantity"))
                raw_cost_price = _safe_float(item.get("cost_price")) or 0.0
                market = item.get("market")
            else:
                symbol = getattr(item, "symbol", None)
                symbol_name = getattr(item, "symbol_name", None)
                currency = getattr(item, "currency", None)
                qty = _safe_float(getattr(item, "quantity", None)) or 0.0
                available = _safe_float(getattr(item, "available_quantity", None))
                raw_cost_price = _safe_float(getattr(item, "cost_price", None)) or 0.0
                market = getattr(item, "market", None)

            # Convert market enum to string
            if market and hasattr(market, "name"):
                market = market.name
            elif market:
                market = str(market)

            if not symbol:
                continue

            direction = "short" if raw_cost_price < 0 else "long"
            entry_price = abs(raw_cost_price)

            positions.append(
                {
                    "symbol": symbol,
                    "symbol_name": symbol_name,
                    "currency": currency,
                    "market": market,
                    "qty": qty,
                    "available_quantity": available,
                    "avg_price": entry_price,
                    "raw_avg_price": raw_cost_price,
                    "direction": direction,
                    "account_channel": account_channel,
                }
            )

    logger.info("get_positions: assembled %d positions", len(positions))
    return positions


def get_account_balance() -> Dict[str, object]:
    """获取账户资金余额信息（优先返回 USD；若无 USD 则返回所有币种并标注 usd_missing）"""
    creds = load_credentials()
    config = _build_longport_config(creds)

    try:
        from longport.openapi import TradeContext
    except ModuleNotFoundError as exc:
        raise LongbridgeDependencyMissing(
            "未找到 longport Python SDK，请先运行 `pip install longport`。"
        ) from exc

    def _normalize_currency(cur: object) -> str:
        if hasattr(cur, "name"):
            return str(getattr(cur, "name"))
        if hasattr(cur, "value"):
            return str(getattr(cur, "value"))
        return str(cur)

    def _parse_balances(iterable) -> Dict[str, dict]:
        result: Dict[str, dict] = {}
        if not hasattr(iterable, "__iter__"):
            return result
        for balance in iterable:
            currency_raw = getattr(balance, "currency", "UNKNOWN")
            currency = _normalize_currency(currency_raw).upper()

            # 现金明细
            cash_infos = getattr(balance, "cash_infos", []) or []
            available_cash = 0.0
            withdraw_cash = 0.0
            settling_cash = 0.0
            frozen_cash = 0.0
            # 优先使用与该余额同币种的 cash_info；若未命中，且期望 USD，则兜底匹配包含 USD 的条目
            for cash_info in cash_infos:
                info_currency = _normalize_currency(getattr(cash_info, "currency", "")).upper()
                if info_currency == currency:
                    available_cash = float(getattr(cash_info, "available_cash", 0) or 0)
                    withdraw_cash = float(getattr(cash_info, "withdraw_cash", 0) or 0)
                    settling_cash = float(getattr(cash_info, "settling_cash", 0) or 0)
                    frozen_cash = float(getattr(cash_info, "frozen_cash", 0) or 0)
                    break
            # 如果仍未命中，但当前余额币种为 USD，则尝试匹配任何包含 'USD' 的币种标识
            if available_cash == 0.0 and currency == "USD":
                for cash_info in cash_infos:
                    info_currency = _normalize_currency(getattr(cash_info, "currency", "")).upper()
                    if "USD" in info_currency:
                        available_cash = float(getattr(cash_info, "available_cash", 0) or 0)
                        withdraw_cash = float(getattr(cash_info, "withdraw_cash", 0) or 0)
                        settling_cash = float(getattr(cash_info, "settling_cash", 0) or 0)
                        frozen_cash = float(getattr(cash_info, "frozen_cash", 0) or 0)
                        break

            total_cash = float(getattr(balance, "total_cash", 0) or 0)
            # 若 cash_infos 未命中，再尝试 balance 层的 available_cash 字段；不要用 total_cash 回退
            balance_level_available = float(getattr(balance, "available_cash", 0) or 0)
            if available_cash == 0.0 and balance_level_available > 0.0:
                available_cash = balance_level_available

            # 冻结费用（按 USD 汇总）
            frozen_transaction_fee_usd = 0.0
            frozen_tx_fees = getattr(balance, "frozen_transaction_fees", []) or []
            for fee in frozen_tx_fees:
                fee_ccy = _normalize_currency(getattr(fee, "currency", "")).upper()
                if fee_ccy == "USD":
                    frozen_transaction_fee_usd = float(getattr(fee, "frozen_transaction_fee", 0) or 0)
                    break
            max_finance_amount = float(getattr(balance, "max_finance_amount", 0) or 0)
            remaining_finance_amount = float(getattr(balance, "remaining_finance_amount", 0) or 0)

            finance_used = 0.0
            if max_finance_amount > 0 and remaining_finance_amount < max_finance_amount:
                finance_used = max_finance_amount - remaining_finance_amount
            debit = float(getattr(balance, "debit", 0) or 0)
            if debit > 0:
                finance_used = debit

            net_assets = float(getattr(balance, "net_assets", 0) or 0)

            result[currency] = {
                "total_cash": total_cash,
                "available_cash": available_cash,
                "withdraw_cash": withdraw_cash,
                "settling_cash": settling_cash,
                "cash_balance": available_cash,
                "max_finance_amount": max_finance_amount,
                "remaining_finance_amount": remaining_finance_amount,
                "finance_used": finance_used,
                "debit": debit,
                "frozen_cash": frozen_cash,
                "frozen_transaction_fee_usd": frozen_transaction_fee_usd,
                "risk_level": getattr(balance, "risk_level", None),
                "margin_call": float(getattr(balance, "margin_call", 0) or 0),
                "net_assets": net_assets,
                "init_margin": float(getattr(balance, "init_margin", 0) or 0),
                "maintenance_margin": float(getattr(balance, "maintenance_margin", 0) or 0),
                "currency": currency,
            }
        return result

    ctx = TradeContext(config)
    try:
        # 1) 优先拉取 USD
        usd_only = {}
        try:
            resp_usd = ctx.account_balance(currency="USD")
            usd_only = _parse_balances(resp_usd)
        except Exception as e:
            logger.warning(f"account_balance(currency='USD') failed: {e}")

        # 2) 再拉取全币种，做补全
        all_balances = {}
        try:
            resp_all = ctx.account_balance()
            all_balances = _parse_balances(resp_all)
        except Exception as e:
            logger.warning(f"account_balance() failed: {e}")

        # 合并：以 usd_only 为主，其次 all_balances
        merged: Dict[str, dict] = {}
        merged.update(all_balances)
        merged.update(usd_only)  # 确保 USD 优先采用定向查询结果

        if "USD" in merged:
            # 可按需：仅返回 USD；也可以同时透传其他币种
            # 这里选择同时返回，前端严格优先 USD
            return merged

        # 若无 USD，则返回所有币种，并标注 _meta.usd_missing
        available = sorted(list(merged.keys()))
        merged["_meta"] = {"usd_missing": True, "available": available}
        return merged
    except Exception as exc:
        logger.error(f"Failed to get account balance: {exc}")
        raise LongbridgeAPIError(f"获取账户资金失败: {exc}") from exc
    finally:
        try:
            ctx.close()
        except Exception:
            pass


def get_portfolio_overview() -> Dict[str, object]:
    positions = get_positions()
    if not positions:
        return {
            "positions": [],
            "totals": {
                "cost": 0.0,
                "market_value": 0.0,
                "pnl": 0.0,
                "pnl_percent": 0.0,
            },
        }

    symbols = [pos["symbol"] for pos in positions]

    # First try to get cached prices from database
    latest_map = fetch_latest_prices(symbols)

    # Then fetch real-time prices from Longbridge API for all symbols
    try:
        creds = load_credentials()
        if creds and all(creds.get(key) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")):
            with _quote_context(creds) as ctx:
                try:
                    # Get real-time quotes for all symbols
                    quotes = ctx.quote(symbols)
                    for quote in quotes:
                        symbol_upper = quote.symbol.upper()
                        if hasattr(quote, 'last_done') and quote.last_done:
                            latest_map[symbol_upper] = {
                                "price": float(quote.last_done),
                                "ts": quote.timestamp if hasattr(quote, 'timestamp') else None,
                                "volume": float(quote.volume) if hasattr(quote, 'volume') else None,
                                "source": "realtime",
                            }
                            # Store the real-time price to database for future use
                            try:
                                from .repositories import store_tick_event
                                store_tick_event(symbol_upper, quote)
                            except Exception:
                                pass  # Best effort to save, don't fail the request
                except Exception as e:
                    logger.warning(f"Failed to fetch real-time quotes: {e}")
    except Exception as e:
        logger.warning(f"Failed to initialize quote context: {e}")

    enriched: List[Dict[str, object]] = []
    total_cost = 0.0
    total_market = 0.0
    total_pnl = 0.0
    total_day_pnl = 0.0
    total_day_pnl_percent = 0.0

    # Get previous close prices for day P&L calculation
    prev_close_map = {}
    try:
        if symbols:
            # For day P&L, we need yesterday's close price
            # This is a simplified version - in production you'd fetch actual previous close
            pass
    except Exception as e:
        logger.warning(f"Failed to get previous close prices: {e}")

    for pos in positions:
        symbol = pos["symbol"]
        qty_raw = float(pos.get("qty", 0) or 0)
        qty = abs(qty_raw)
        entry_price = float(pos.get("avg_price", 0) or 0)
        direction = pos.get("direction", "long")
        cost_value = entry_price * qty
        # fetch_latest_prices returns uppercase symbols as keys
        latest = latest_map.get(symbol.upper() if symbol else symbol, {})
        last_price = latest.get("price")
        last_ts = latest.get("ts")

        # Only calculate P&L if we have a last_price
        if last_price is not None and last_price > 0:
            market_value = last_price * qty
            pnl = (last_price - entry_price) * qty
            if direction == "short":
                pnl *= -1
            pnl_percent = 0.0
            if cost_value and entry_price:
                pct = (last_price - entry_price) / entry_price * 100
                pnl_percent = pct if direction == "long" else -pct

            # Calculate day P&L (simplified - assumes cost as previous close)
            # In production, you'd use actual previous close price
            day_pnl = pnl * 0.1  # Placeholder: assuming 10% of total P&L is today's
            day_pnl_percent = pnl_percent * 0.1 if pnl_percent else 0.0
        else:
            # No last price available, cannot calculate P&L
            market_value = cost_value  # Use cost as market value when price unavailable
            pnl = 0.0
            pnl_percent = 0.0
            day_pnl = 0.0
            day_pnl_percent = 0.0

        total_cost += cost_value
        total_market += market_value
        total_pnl += pnl
        total_day_pnl += day_pnl

        enriched.append(
            {
                "symbol": symbol,
                "symbol_name": pos.get("symbol_name"),
                "currency": pos.get("currency"),
                "market": pos.get("market"),
                "qty": qty,
                "available_quantity": pos.get("available_quantity"),
                "avg_price": entry_price,
                "direction": direction,
                "cost_value": cost_value,
                "last_price": last_price,
                "last_price_time": last_ts,
                "market_value": market_value,
                "pnl": pnl,
                "pnl_percent": pnl_percent,
                "day_pnl": day_pnl,
                "day_pnl_percent": day_pnl_percent,
                "account_channel": pos.get("account_channel"),
            }
        )

    total_pct = (total_pnl / total_cost * 100) if total_cost else 0.0
    total_day_pct = (total_day_pnl / total_cost * 100) if total_cost else 0.0

    # Get account balance
    account_balance = {}
    try:
        account_balance = get_account_balance()
    except Exception as e:
        logger.warning(f"Failed to get account balance: {e}")

    return {
        "positions": enriched,
        "totals": {
            "cost": total_cost,
            "market_value": total_market,
            "pnl": total_pnl,
            "pnl_percent": total_pct,
            "day_pnl": total_day_pnl,
            "day_pnl_percent": total_day_pct,
        },
        "account_balance": account_balance
    }
