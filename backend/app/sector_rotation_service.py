"""
板块轮动分析服务
提供板块强度计算、热力图数据和股票筛选功能
支持多因子分析和 Finviz 风格热力图
"""
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import numpy as np
import logging
import json
import asyncio

from .db import get_connection
from .repositories import load_ai_credentials
from .eodhd_client import (
    EODHDClient,
    SECTOR_ETFS,
    INDEX_ETFS,
    INDUSTRY_ETFS,
    FACTOR_ETFS,
    THEME_ETFS,
    ALL_ETFS,
    SECTOR_NAME_TO_ETF,
    SECTOR_NAME_CN,
    FACTOR_NAMES_CN
)

logger = logging.getLogger(__name__)


class SectorRotationService:
    """板块轮动分析服务"""

    def __init__(self):
        self.cache = {}
        self.cache_duration = 3600  # 1小时缓存

    def _get_client(self) -> Optional[EODHDClient]:
        """获取 EODHD 客户端"""
        creds = load_ai_credentials()
        api_key = creds.get("EODHD_API_KEY")
        if not api_key:
            logger.warning("⚠️ 未配置 EODHD API Key")
            return None
        return EODHDClient(api_key)

    # ========== 板块数据同步 ==========

    async def sync_sector_data(self, days: int = 60, etf_type: str = "sector") -> Dict:
        """
        同步板块 ETF 数据

        参数:
            days: 同步最近多少天的数据
            etf_type: ETF 类型 (sector/index/industry/factor/theme/all)

        返回:
            {"success": [...], "failed": [...]}
        """
        client = self._get_client()
        if not client:
            return {"error": "未配置 EODHD API Key", "success": [], "failed": []}

        try:
            results = {"success": [], "failed": []}

            # 根据类型选择 ETF 列表
            if etf_type == "all":
                etf_dict = ALL_ETFS
            elif etf_type == "index":
                etf_dict = INDEX_ETFS
            elif etf_type == "industry":
                etf_dict = INDUSTRY_ETFS
            elif etf_type == "factor":
                etf_dict = FACTOR_ETFS
            elif etf_type == "theme":
                etf_dict = THEME_ETFS
            else:
                etf_dict = SECTOR_ETFS

            total = len(etf_dict)
            logger.info(f"📊 开始同步 {etf_type} ETF 数据，共 {total} 个")

            for idx, (symbol, info) in enumerate(etf_dict.items(), 1):
                try:
                    logger.info(f"📥 [{idx}/{total}] 正在同步 {symbol}...")

                    # 获取 ETF 历史数据
                    data = client.get_etf_eod(symbol, days)
                    if not data:
                        logger.warning(f"⚠️ [{idx}/{total}] {symbol} 无数据返回")
                        results["failed"].append(symbol)
                        continue

                    # 处理和计算指标
                    processed = self._process_etf_data(symbol, data)

                    # 确定 ETF 类型和因子名
                    actual_type = info.get("type", "sector")
                    factor_name = info.get("factor")

                    # 保存到数据库
                    self._save_sector_performance(symbol, processed, actual_type, factor_name)

                    # 保存 ETF 基础信息
                    self._save_sector_etf_info(symbol, info)

                    results["success"].append(symbol)
                    logger.info(f"✅ [{idx}/{total}] 同步 {symbol} 成功 ({len(processed)} 条)")

                    # 添加延迟避免 API 速率限制 (每 5 个请求暂停 0.5 秒)
                    if idx % 5 == 0 and idx < total:
                        await asyncio.sleep(0.5)

                except Exception as e:
                    logger.error(f"❌ [{idx}/{total}] 同步 {symbol} 失败: {e}")
                    results["failed"].append(symbol)

            logger.info(f"📊 同步完成: {len(results['success'])} 成功, {len(results['failed'])} 失败")
            return results
        finally:
            client.close()

    def _process_etf_data(self, symbol: str, data: List[Dict]) -> List[Dict]:
        """处理 ETF 数据，计算各种指标"""
        if len(data) < 5:
            return []

        # 按日期排序（从旧到新）
        data = sorted(data, key=lambda x: x.get("date", ""))

        closes = np.array([d.get("close", 0) or 0 for d in data])

        processed = []
        for i, d in enumerate(data):
            record = {
                "date": d.get("date"),
                "open": d.get("open"),
                "high": d.get("high"),
                "low": d.get("low"),
                "close": d.get("close"),
                "volume": d.get("volume"),
            }

            # 日涨跌幅
            if i > 0 and closes[i-1] > 0:
                record["change_pct"] = (closes[i] / closes[i-1] - 1) * 100
            else:
                record["change_pct"] = 0

            # 5日涨跌幅
            if i >= 5 and closes[i-5] > 0:
                record["change_5d"] = (closes[i] / closes[i-5] - 1) * 100
            else:
                record["change_5d"] = None

            # 20日涨跌幅
            if i >= 20 and closes[i-20] > 0:
                record["change_20d"] = (closes[i] / closes[i-20] - 1) * 100
            else:
                record["change_20d"] = None

            # 60日涨跌幅
            if i >= 60 and closes[i-60] > 0:
                record["change_60d"] = (closes[i] / closes[i-60] - 1) * 100
            else:
                record["change_60d"] = None

            processed.append(record)

        return processed

    def _save_sector_performance(
        self,
        symbol: str,
        data: List[Dict],
        etf_type: str = "sector",
        factor_name: Optional[str] = None
    ):
        """保存板块表现数据"""
        with get_connection() as conn:
            for record in data:
                if not record.get("date"):
                    continue
                conn.execute("""
                    INSERT INTO sector_performance
                    (symbol, date, open, high, low, close, volume,
                     change_pct, change_5d, change_20d, change_60d,
                     etf_type, factor_name, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(symbol, date) DO UPDATE SET
                        open = excluded.open,
                        high = excluded.high,
                        low = excluded.low,
                        close = excluded.close,
                        volume = excluded.volume,
                        change_pct = excluded.change_pct,
                        change_5d = excluded.change_5d,
                        change_20d = excluded.change_20d,
                        change_60d = excluded.change_60d,
                        etf_type = excluded.etf_type,
                        factor_name = excluded.factor_name,
                        updated_at = excluded.updated_at
                """, (
                    symbol,
                    record["date"],
                    record.get("open"),
                    record.get("high"),
                    record.get("low"),
                    record.get("close"),
                    record.get("volume"),
                    record.get("change_pct"),
                    record.get("change_5d"),
                    record.get("change_20d"),
                    record.get("change_60d"),
                    etf_type,
                    factor_name,
                    datetime.now()
                ))

    def _save_sector_etf_info(self, symbol: str, info: Dict):
        """保存 ETF 基础信息"""
        etf_type = info.get("type", "sector")
        factor_name = info.get("factor")
        color = info.get("color")

        with get_connection() as conn:
            conn.execute("""
                INSERT INTO sector_etfs
                (symbol, sector_name, sector_name_cn, etf_type, factor_name, color, is_active)
                VALUES (?, ?, ?, ?, ?, ?, TRUE)
                ON CONFLICT(symbol) DO UPDATE SET
                    sector_name = excluded.sector_name,
                    sector_name_cn = excluded.sector_name_cn,
                    etf_type = excluded.etf_type,
                    factor_name = excluded.factor_name,
                    color = excluded.color,
                    is_active = TRUE
            """, (symbol, info.get("name"), info.get("name_cn"), etf_type, factor_name, color))

    # ========== 板块强度计算 ==========

    def calculate_sector_strength(self) -> List[Dict]:
        """
        计算所有板块的强度评分

        评分维度：
        1. 短期动量 (30%): 5日涨跌幅
        2. 中期动量 (30%): 20日涨跌幅
        3. 长期趋势 (20%): 60日涨跌幅
        4. 相对强度 (20%): 综合排名

        返回:
            [{symbol, name, name_cn, strength_score, change_1d, change_5d, ...}, ...]
        """
        with get_connection() as conn:
            # 获取每个板块的最新数据
            results = conn.execute("""
                SELECT
                    sp.symbol,
                    sp.close,
                    sp.change_pct,
                    sp.change_5d,
                    sp.change_20d,
                    sp.change_60d,
                    sp.date
                FROM sector_performance sp
                INNER JOIN (
                    SELECT symbol, MAX(date) as max_date
                    FROM sector_performance
                    GROUP BY symbol
                ) latest ON sp.symbol = latest.symbol AND sp.date = latest.max_date
            """).fetchall()

        if not results:
            return []

        sectors = []
        for row in results:
            symbol = row[0]
            info = SECTOR_ETFS.get(symbol, {})

            change_1d = row[2] or 0
            change_5d = row[3] or 0
            change_20d = row[4] or 0
            change_60d = row[5] or 0

            # 归一化评分 (0-100)
            # 短期动量：5日涨跌幅 -10% ~ +10% 映射到 0-100
            short_score = self._normalize_score(change_5d, -10, 10)
            # 中期动量：20日涨跌幅 -20% ~ +20% 映射到 0-100
            mid_score = self._normalize_score(change_20d, -20, 20)
            # 长期趋势：60日涨跌幅 -30% ~ +30% 映射到 0-100
            long_score = self._normalize_score(change_60d, -30, 30)

            # 综合评分
            total_score = (
                short_score * 0.30 +
                mid_score * 0.30 +
                long_score * 0.20 +
                50 * 0.20  # 相对强度暂用中间值
            )

            sectors.append({
                "symbol": symbol,
                "name": info.get("name", ""),
                "name_cn": info.get("name_cn", ""),
                "color": info.get("color", "#666"),
                "close": row[1],
                "change_1d": round(change_1d, 2),
                "change_5d": round(change_5d, 2),
                "change_20d": round(change_20d, 2),
                "change_60d": round(change_60d, 2),
                "strength_score": round(total_score, 1),
                "trend": self._get_trend_label(change_5d, change_20d),
                "date": str(row[6])
            })

        # 按强度评分排序
        sectors.sort(key=lambda x: x["strength_score"], reverse=True)

        # 添加排名
        for i, sector in enumerate(sectors):
            sector["rank"] = i + 1

        return sectors

    def _normalize_score(self, value: float, min_val: float, max_val: float) -> float:
        """将值归一化到 0-100"""
        if value is None:
            return 50
        # 限制在范围内
        value = max(min_val, min(max_val, value))
        # 线性映射到 0-100
        return (value - min_val) / (max_val - min_val) * 100

    def _get_trend_label(self, change_5d: float, change_20d: float) -> str:
        """获取趋势标签"""
        if change_5d > 2 and change_20d > 5:
            return "strong_up"
        elif change_5d > 0 and change_20d > 0:
            return "up"
        elif change_5d < -2 and change_20d < -5:
            return "strong_down"
        elif change_5d < 0 and change_20d < 0:
            return "down"
        else:
            return "neutral"

    # ========== 热力图数据 ==========

    def get_heatmap_data(self) -> List[Dict]:
        """
        获取板块热力图数据

        返回:
            [{name, symbol, value, strength, trend, ...}, ...]
        """
        sectors = self.calculate_sector_strength()

        heatmap_data = []
        for sector in sectors:
            heatmap_data.append({
                "name": sector["name_cn"] or sector["name"],
                "symbol": sector["symbol"],
                "value": sector["change_1d"],  # 日涨跌幅作为热力图值
                "strength": sector["strength_score"],
                "trend": sector["trend"],
                "change_5d": sector["change_5d"],
                "change_20d": sector["change_20d"],
                "color": sector["color"]
            })

        return heatmap_data

    # ========== 轮动趋势数据 ==========

    def get_rotation_trend(self, days: int = 30) -> Dict:
        """
        获取板块轮动趋势数据

        参数:
            days: 获取最近多少天的数据

        返回:
            {dates: [...], data: {date: {symbol: {...}}}, sectors: [...]}
        """
        with get_connection() as conn:
            results = conn.execute(f"""
                SELECT symbol, date, change_5d, close
                FROM sector_performance
                WHERE date >= date('now', '-{days} days')
                ORDER BY date
            """).fetchall()

        # 按日期和板块组织数据
        trend_data = {}
        for row in results:
            symbol, date, change_5d, close = row
            date_str = str(date)

            if date_str not in trend_data:
                trend_data[date_str] = {}

            info = SECTOR_ETFS.get(symbol, {})
            trend_data[date_str][symbol] = {
                "name": info.get("name_cn", symbol),
                "change_5d": change_5d or 0,
                "close": close
            }

        return {
            "dates": sorted(trend_data.keys()),
            "data": trend_data,
            "sectors": list(SECTOR_ETFS.keys())
        }

    # ========== 强势板块股票筛选 ==========

    async def screen_top_sector_stocks(
        self,
        top_n_sectors: int = 3,
        stocks_per_sector: int = 10,
        market_cap_min: float = 1e9
    ) -> Dict:
        """
        筛选强势板块中的股票

        参数:
            top_n_sectors: 筛选前N个强势板块
            stocks_per_sector: 每个板块筛选的股票数量
            market_cap_min: 最小市值

        返回:
            {sectors: [...], stocks_by_sector: {symbol: [...]}}
        """
        client = self._get_client()
        if not client:
            return {"error": "未配置 EODHD API Key", "sectors": [], "stocks_by_sector": {}}

        try:
            # 1. 获取板块强度排名
            sectors = self.calculate_sector_strength()
            if not sectors:
                return {"error": "无板块数据，请先同步", "sectors": [], "stocks_by_sector": {}}

            top_sectors = sectors[:top_n_sectors]

            # 2. 筛选每个板块的股票
            results = {
                "sectors": top_sectors,
                "stocks_by_sector": {}
            }

            for sector in top_sectors:
                sector_name = sector["name"]
                symbol = sector["symbol"]

                try:
                    stocks = client.screen_stocks_by_sector(
                        sector=sector_name,
                        market_cap_min=market_cap_min,
                        limit=stocks_per_sector
                    )

                    # 格式化股票数据
                    formatted_stocks = []
                    for stock in stocks:
                        code = stock.get("code", "")
                        formatted_stocks.append({
                            "symbol": f"{code}.US" if code else "",
                            "name": stock.get("name", ""),
                            "market_cap": stock.get("market_capitalization"),
                            "pe_ratio": stock.get("earnings_share"),
                            "price": stock.get("close"),
                            "change_pct": stock.get("change_p", 0)
                        })

                    results["stocks_by_sector"][symbol] = formatted_stocks

                    # 保存到数据库
                    self._save_sector_stocks(symbol, formatted_stocks)

                    logger.info(f"✅ 筛选 {sector_name} 股票: {len(formatted_stocks)} 只")

                except Exception as e:
                    logger.error(f"❌ 筛选板块股票失败 {sector_name}: {e}")
                    results["stocks_by_sector"][symbol] = []

            return results
        finally:
            client.close()

    def _save_sector_stocks(self, sector_symbol: str, stocks: List[Dict]):
        """保存板块股票数据"""
        with get_connection() as conn:
            # 先清除旧数据
            conn.execute(
                "DELETE FROM sector_stocks WHERE sector_symbol = ?",
                (sector_symbol,)
            )

            # 插入新数据
            for i, stock in enumerate(stocks):
                if not stock.get("symbol"):
                    continue
                conn.execute("""
                    INSERT INTO sector_stocks
                    (sector_symbol, stock_symbol, stock_name, market_cap,
                     pe_ratio, price, change_pct, rs_rank, screened_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    sector_symbol,
                    stock["symbol"],
                    stock.get("name"),
                    stock.get("market_cap"),
                    stock.get("pe_ratio"),
                    stock.get("price"),
                    stock.get("change_pct"),
                    i + 1,
                    datetime.now()
                ))

    # ========== 获取已筛选的股票 ==========

    def get_sector_stocks(self, sector_symbol: Optional[str] = None) -> Dict:
        """
        获取已筛选的板块股票

        参数:
            sector_symbol: 板块 ETF 代码，为空返回所有

        返回:
            {sector_symbol: [{symbol, name, ...}, ...], ...}
        """
        with get_connection() as conn:
            if sector_symbol:
                results = conn.execute("""
                    SELECT sector_symbol, stock_symbol, stock_name, market_cap,
                           pe_ratio, price, change_pct, rs_rank, screened_at
                    FROM sector_stocks
                    WHERE sector_symbol = ?
                    ORDER BY rs_rank
                """, (sector_symbol,)).fetchall()
            else:
                results = conn.execute("""
                    SELECT sector_symbol, stock_symbol, stock_name, market_cap,
                           pe_ratio, price, change_pct, rs_rank, screened_at
                    FROM sector_stocks
                    ORDER BY sector_symbol, rs_rank
                """).fetchall()

        stocks_by_sector = {}
        for row in results:
            sector = row[0]
            if sector not in stocks_by_sector:
                stocks_by_sector[sector] = []

            stocks_by_sector[sector].append({
                "symbol": row[1],
                "name": row[2],
                "market_cap": row[3],
                "pe_ratio": row[4],
                "price": row[5],
                "change_pct": row[6],
                "rs_rank": row[7],
                "screened_at": str(row[8]) if row[8] else None
            })

        return stocks_by_sector

    # ========== 与选股系统集成 ==========

    async def add_sector_stocks_to_picker(
        self,
        sector_symbol: str,
        pool_type: str = "LONG"
    ) -> Dict:
        """
        将板块股票添加到选股池

        参数:
            sector_symbol: 板块 ETF 代码
            pool_type: 池类型 LONG/SHORT

        返回:
            {added: count, message: str}
        """
        from .stock_picker import get_stock_picker_service

        # 获取板块股票
        stocks = self.get_sector_stocks(sector_symbol)
        sector_stocks = stocks.get(sector_symbol, [])

        if not sector_stocks:
            return {"added": 0, "message": f"未找到 {sector_symbol} 板块的股票，请先筛选"}

        # 获取选股服务
        picker_service = get_stock_picker_service()

        # 批量添加
        symbols = [s["symbol"] for s in sector_stocks if s.get("symbol")]
        result = picker_service.batch_add_stocks(pool_type, symbols)

        sector_info = SECTOR_ETFS.get(sector_symbol, {})
        sector_name = sector_info.get("name_cn", sector_symbol)

        return {
            "added": result.get("success_count", 0),
            "message": f"已将 {sector_name} 板块的 {result.get('success_count', 0)} 只股票添加到 {pool_type} 池"
        }

    # ========== Finviz 风格热力图 ==========

    def get_finviz_heatmap_data(self) -> Dict:
        """
        获取 Finviz 风格的热力图数据
        按板块分组，每个板块包含其成分股

        返回:
            {
                "sectors": [{name, symbol, change_pct, stocks: [...]}],
                "summary": {total_stocks, positive_count, negative_count}
            }
        """
        # 获取板块数据
        sectors = self.calculate_sector_strength()

        # 获取每个板块的股票
        all_stocks = self.get_sector_stocks()

        result = {
            "sectors": [],
            "summary": {
                "total_stocks": 0,
                "positive_count": 0,
                "negative_count": 0,
                "avg_change": 0
            }
        }

        total_change = 0
        stock_count = 0

        for sector in sectors:
            sector_symbol = sector["symbol"]
            sector_stocks = all_stocks.get(sector_symbol, [])

            # 计算板块内股票统计
            positive = sum(1 for s in sector_stocks if (s.get("change_pct") or 0) > 0)
            negative = sum(1 for s in sector_stocks if (s.get("change_pct") or 0) < 0)

            # 格式化股票数据用于热力图
            formatted_stocks = []
            for stock in sector_stocks:
                change = stock.get("change_pct") or 0
                market_cap = stock.get("market_cap") or 1e9

                formatted_stocks.append({
                    "symbol": stock["symbol"],
                    "name": stock.get("name", ""),
                    "change_pct": round(change, 2),
                    "market_cap": market_cap,
                    "size": max(10, min(100, market_cap / 1e10)),  # 归一化大小
                    "color": self._get_change_color(change)
                })

                total_change += change
                stock_count += 1

            result["sectors"].append({
                "symbol": sector_symbol,
                "name": sector["name_cn"] or sector["name"],
                "change_pct": sector["change_1d"],
                "strength_score": sector["strength_score"],
                "color": sector["color"],
                "stocks": formatted_stocks,
                "stock_count": len(formatted_stocks),
                "positive_count": positive,
                "negative_count": negative
            })

            result["summary"]["total_stocks"] += len(sector_stocks)
            result["summary"]["positive_count"] += positive
            result["summary"]["negative_count"] += negative

        if stock_count > 0:
            result["summary"]["avg_change"] = round(total_change / stock_count, 2)

        return result

    def _get_change_color(self, change: float) -> str:
        """根据涨跌幅返回颜色"""
        if change >= 5:
            return "#00c853"  # 深绿
        elif change >= 2:
            return "#4caf50"  # 绿
        elif change >= 0:
            return "#81c784"  # 浅绿
        elif change >= -2:
            return "#ef9a9a"  # 浅红
        elif change >= -5:
            return "#f44336"  # 红
        else:
            return "#c62828"  # 深红

    # ========== 因子强度分析 ==========

    def calculate_factor_strength(self) -> List[Dict]:
        """
        计算所有因子的强度评分

        返回:
            [{factor, name_cn, etfs: [...], avg_change_1d, avg_change_5d, strength_score, ...}]
        """
        with get_connection() as conn:
            # 获取所有因子类型 ETF 的最新数据
            results = conn.execute("""
                SELECT
                    sp.symbol,
                    sp.close,
                    sp.change_pct,
                    sp.change_5d,
                    sp.change_20d,
                    sp.change_60d,
                    sp.factor_name,
                    sp.date
                FROM sector_performance sp
                INNER JOIN (
                    SELECT symbol, MAX(date) as max_date
                    FROM sector_performance
                    WHERE etf_type = 'factor'
                    GROUP BY symbol
                ) latest ON sp.symbol = latest.symbol AND sp.date = latest.max_date
                WHERE sp.etf_type = 'factor'
            """).fetchall()

        if not results:
            return []

        # 按因子分组
        factor_data = {}
        for row in results:
            symbol, close, change_1d, change_5d, change_20d, change_60d, factor_name, date = row
            factor_name = factor_name or "unknown"

            if factor_name not in factor_data:
                factor_data[factor_name] = {
                    "factor": factor_name,
                    "name_cn": FACTOR_NAMES_CN.get(factor_name, factor_name),
                    "etfs": [],
                    "changes_1d": [],
                    "changes_5d": [],
                    "changes_20d": [],
                    "changes_60d": []
                }

            info = FACTOR_ETFS.get(symbol, {})
            factor_data[factor_name]["etfs"].append({
                "symbol": symbol,
                "name": info.get("name", ""),
                "name_cn": info.get("name_cn", ""),
                "change_1d": change_1d or 0,
                "change_5d": change_5d or 0
            })

            if change_1d is not None:
                factor_data[factor_name]["changes_1d"].append(change_1d)
            if change_5d is not None:
                factor_data[factor_name]["changes_5d"].append(change_5d)
            if change_20d is not None:
                factor_data[factor_name]["changes_20d"].append(change_20d)
            if change_60d is not None:
                factor_data[factor_name]["changes_60d"].append(change_60d)

        # 计算每个因子的平均值和强度评分
        factors = []
        for factor_name, data in factor_data.items():
            avg_1d = np.mean(data["changes_1d"]) if data["changes_1d"] else 0
            avg_5d = np.mean(data["changes_5d"]) if data["changes_5d"] else 0
            avg_20d = np.mean(data["changes_20d"]) if data["changes_20d"] else 0
            avg_60d = np.mean(data["changes_60d"]) if data["changes_60d"] else 0

            # 计算强度评分
            short_score = self._normalize_score(avg_5d, -10, 10)
            mid_score = self._normalize_score(avg_20d, -20, 20)
            long_score = self._normalize_score(avg_60d, -30, 30)
            strength_score = short_score * 0.4 + mid_score * 0.35 + long_score * 0.25

            factors.append({
                "factor": factor_name,
                "name_cn": data["name_cn"],
                "etfs": data["etfs"],
                "etf_count": len(data["etfs"]),
                "avg_change_1d": round(avg_1d, 2),
                "avg_change_5d": round(avg_5d, 2),
                "avg_change_20d": round(avg_20d, 2),
                "avg_change_60d": round(avg_60d, 2),
                "strength_score": round(strength_score, 1),
                "trend": self._get_trend_label(avg_5d, avg_20d),
                "momentum": "positive" if avg_5d > avg_20d else "negative"
            })

        # 按强度评分排序
        factors.sort(key=lambda x: x["strength_score"], reverse=True)

        # 添加排名
        for i, factor in enumerate(factors):
            factor["rank"] = i + 1

        return factors

    # ========== 因子轮动检测 ==========

    def detect_factor_rotation(self, lookback_days: int = 20) -> Dict:
        """
        检测因子轮动信号

        参数:
            lookback_days: 回溯天数

        返回:
            {
                dominant_factor: str,
                rotation_signal: str,
                factor_momentum: {...},
                recommendation: str
            }
        """
        with get_connection() as conn:
            # 获取历史因子数据
            results = conn.execute(f"""
                SELECT
                    sp.factor_name,
                    sp.date,
                    sp.change_pct,
                    sp.change_5d
                FROM sector_performance sp
                WHERE sp.etf_type = 'factor'
                  AND sp.date >= date('now', '-{lookback_days} days')
                  AND sp.factor_name IS NOT NULL
                ORDER BY sp.date
            """).fetchall()

        if not results:
            return {
                "dominant_factor": None,
                "rotation_signal": "no_data",
                "factor_momentum": {},
                "recommendation": "数据不足，请先同步因子 ETF 数据"
            }

        # 按因子和日期组织数据
        factor_series = {}
        for factor_name, date, change_pct, change_5d in results:
            if factor_name not in factor_series:
                factor_series[factor_name] = {"dates": [], "changes": [], "changes_5d": []}
            factor_series[factor_name]["dates"].append(str(date))
            factor_series[factor_name]["changes"].append(change_pct or 0)
            factor_series[factor_name]["changes_5d"].append(change_5d or 0)

        # 计算每个因子的动量和趋势
        factor_momentum = {}
        for factor_name, series in factor_series.items():
            changes = np.array(series["changes"])
            changes_5d = np.array(series["changes_5d"])

            # 计算近期表现 vs 远期表现
            if len(changes) >= 10:
                recent = np.mean(changes[-5:])
                earlier = np.mean(changes[-10:-5])
                momentum = recent - earlier
            else:
                recent = np.mean(changes[-3:]) if len(changes) >= 3 else np.mean(changes)
                momentum = 0

            # 计算趋势斜率
            if len(changes_5d) >= 5:
                x = np.arange(len(changes_5d[-10:]))
                y = changes_5d[-10:]
                slope = np.polyfit(x, y, 1)[0] if len(y) > 1 else 0
            else:
                slope = 0

            factor_momentum[factor_name] = {
                "name_cn": FACTOR_NAMES_CN.get(factor_name, factor_name),
                "recent_avg": round(recent, 2),
                "momentum": round(momentum, 2),
                "trend_slope": round(slope, 3),
                "is_strengthening": momentum > 0.5 and slope > 0
            }

        # 确定主导因子
        dominant = max(factor_momentum.items(),
                      key=lambda x: x[1]["recent_avg"] + x[1]["momentum"])
        dominant_factor = dominant[0]

        # 确定轮动信号
        strengthening_factors = [f for f, m in factor_momentum.items()
                                if m["is_strengthening"]]
        weakening_factors = [f for f, m in factor_momentum.items()
                            if m["momentum"] < -0.5]

        if len(strengthening_factors) >= 2:
            rotation_signal = "rotation_in_progress"
            signal_desc = "多个因子同时走强，可能正在发生因子轮动"
        elif len(weakening_factors) >= 2:
            rotation_signal = "rotation_ending"
            signal_desc = "多个因子走弱，当前轮动周期可能结束"
        elif dominant[1]["is_strengthening"]:
            rotation_signal = "trend_continuation"
            signal_desc = f"{FACTOR_NAMES_CN.get(dominant_factor, dominant_factor)}因子持续走强"
        else:
            rotation_signal = "neutral"
            signal_desc = "因子表现平稳，无明显轮动信号"

        # 生成建议
        if rotation_signal == "rotation_in_progress":
            recommendation = f"建议关注走强因子: {', '.join([FACTOR_NAMES_CN.get(f, f) for f in strengthening_factors])}"
        elif rotation_signal == "trend_continuation":
            recommendation = f"建议继续持有{FACTOR_NAMES_CN.get(dominant_factor, dominant_factor)}相关标的"
        else:
            recommendation = "建议保持观望，等待明确的轮动信号"

        # 保存轮动信号
        self._save_factor_rotation_signal(
            dominant_factor, rotation_signal, factor_momentum, recommendation
        )

        return {
            "dominant_factor": dominant_factor,
            "dominant_factor_cn": FACTOR_NAMES_CN.get(dominant_factor, dominant_factor),
            "rotation_signal": rotation_signal,
            "signal_description": signal_desc,
            "factor_momentum": factor_momentum,
            "strengthening_factors": strengthening_factors,
            "weakening_factors": weakening_factors,
            "recommendation": recommendation
        }

    def _save_factor_rotation_signal(
        self,
        dominant_factor: str,
        rotation_signal: str,
        factor_momentum: Dict,
        recommendation: str
    ):
        """保存因子轮动信号"""
        with get_connection() as conn:
            conn.execute("""
                INSERT INTO factor_rotation_signals
                (date, dominant_factor, rotation_signal, factor_momentum, recommendation)
                VALUES (date('now'), ?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    dominant_factor = excluded.dominant_factor,
                    rotation_signal = excluded.rotation_signal,
                    factor_momentum = excluded.factor_momentum,
                    recommendation = excluded.recommendation
            """, (
                dominant_factor,
                rotation_signal,
                json.dumps(factor_momentum, ensure_ascii=False),
                recommendation
            ))

    # ========== 获取所有 ETF 表现 ==========

    def get_all_etf_performance(self, etf_type: Optional[str] = None) -> List[Dict]:
        """
        获取所有 ETF 的表现数据

        参数:
            etf_type: 可选，筛选特定类型 (sector/factor/theme)

        返回:
            [{symbol, name, name_cn, type, change_1d, change_5d, ...}]
        """
        with get_connection() as conn:
            if etf_type:
                results = conn.execute("""
                    SELECT
                        sp.symbol,
                        sp.close,
                        sp.change_pct,
                        sp.change_5d,
                        sp.change_20d,
                        sp.change_60d,
                        sp.etf_type,
                        sp.factor_name,
                        sp.date
                    FROM sector_performance sp
                    INNER JOIN (
                        SELECT symbol, MAX(date) as max_date
                        FROM sector_performance
                        WHERE etf_type = ?
                        GROUP BY symbol
                    ) latest ON sp.symbol = latest.symbol AND sp.date = latest.max_date
                    WHERE sp.etf_type = ?
                """, (etf_type, etf_type)).fetchall()
            else:
                results = conn.execute("""
                    SELECT
                        sp.symbol,
                        sp.close,
                        sp.change_pct,
                        sp.change_5d,
                        sp.change_20d,
                        sp.change_60d,
                        sp.etf_type,
                        sp.factor_name,
                        sp.date
                    FROM sector_performance sp
                    INNER JOIN (
                        SELECT symbol, MAX(date) as max_date
                        FROM sector_performance
                        GROUP BY symbol
                    ) latest ON sp.symbol = latest.symbol AND sp.date = latest.max_date
                """).fetchall()

        etfs = []
        for row in results:
            symbol = row[0]
            info = ALL_ETFS.get(symbol, {})

            etfs.append({
                "symbol": symbol,
                "name": info.get("name", ""),
                "name_cn": info.get("name_cn", ""),
                "type": row[6] or "sector",
                "factor": row[7],
                "color": info.get("color", "#666"),
                "close": row[1],
                "change_1d": round(row[2] or 0, 2),
                "change_5d": round(row[3] or 0, 2),
                "change_20d": round(row[4] or 0, 2),
                "change_60d": round(row[5] or 0, 2),
                "date": str(row[8])
            })

        return etfs

    # ========== ETF 列表 ==========

    def get_etf_list(self, etf_type: Optional[str] = None) -> List[Dict]:
        """
        获取 ETF 列表

        参数:
            etf_type: 可选，筛选特定类型 (sector/index/industry/factor/theme)

        返回:
            [{symbol, name, name_cn, type, color}]
        """
        if etf_type == "factor":
            etf_dict = FACTOR_ETFS
        elif etf_type == "theme":
            etf_dict = THEME_ETFS
        elif etf_type == "index":
            etf_dict = INDEX_ETFS
        elif etf_type == "industry":
            etf_dict = INDUSTRY_ETFS
        elif etf_type == "sector":
            etf_dict = SECTOR_ETFS
        else:
            etf_dict = ALL_ETFS

        return [
            {
                "symbol": symbol,
                "name": info.get("name", ""),
                "name_cn": info.get("name_cn", ""),
                "type": info.get("type", "sector"),
                "factor": info.get("factor"),
                "theme": info.get("theme"),
                "index": info.get("index"),
                "industry": info.get("industry"),
                "color": info.get("color", "#666")
            }
            for symbol, info in etf_dict.items()
        ]

    # ========== ETF 持仓数据 ==========

    async def get_etf_holdings(self, symbol: str) -> Dict:
        """
        获取 ETF 持仓和板块权重数据

        参数:
            symbol: ETF 代码，如 XLK, SPY

        返回:
            {symbol, general, holdings, sector_weights, top_10_holdings, total_assets}
        """
        client = self._get_client()
        if not client:
            return {"error": "未配置 EODHD API Key", "symbol": symbol}

        try:
            data = client.get_etf_holdings(symbol)
            if not data:
                return {"error": f"无法获取 {symbol} 持仓数据", "symbol": symbol}

            # 保存持仓数据到数据库
            self._save_etf_holdings(symbol, data)

            return data
        finally:
            client.close()

    def _save_etf_holdings(self, etf_symbol: str, data: Dict):
        """保存 ETF 持仓数据到数据库"""
        holdings = data.get("holdings", []) or data.get("top_10_holdings", [])
        if not holdings:
            return

        with get_connection() as conn:
            # 清除旧数据
            conn.execute(
                "DELETE FROM sector_stocks WHERE sector_symbol = ?",
                (etf_symbol,)
            )

            # 插入新数据
            for i, holding in enumerate(holdings[:50]):  # 最多保存前50只
                if not holding.get("symbol") and not holding.get("code"):
                    continue

                symbol = holding.get("symbol") or f"{holding.get('code')}.US"
                conn.execute("""
                    INSERT INTO sector_stocks
                    (sector_symbol, stock_symbol, stock_name, market_cap,
                     pe_ratio, price, change_pct, rs_rank, screened_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    etf_symbol,
                    symbol,
                    holding.get("name", ""),
                    None,  # market_cap not available
                    None,  # pe_ratio not available
                    None,  # price not available
                    holding.get("assets_pct", 0),  # 用 assets_pct 作为权重
                    i + 1,
                    datetime.now()
                ))

    async def sync_etf_holdings_batch(self, etf_symbols: List[str] = None) -> Dict:
        """
        批量同步 ETF 持仓数据

        参数:
            etf_symbols: ETF 代码列表，为空则同步所有板块 ETF

        返回:
            {success: [...], failed: [...]}
        """
        if etf_symbols is None:
            etf_symbols = list(SECTOR_ETFS.keys())

        client = self._get_client()
        if not client:
            return {"error": "未配置 EODHD API Key", "success": [], "failed": []}

        results = {"success": [], "failed": []}

        try:
            for i, symbol in enumerate(etf_symbols):
                try:
                    logger.info(f"📥 [{i+1}/{len(etf_symbols)}] 同步 {symbol} 持仓...")
                    data = client.get_etf_holdings(symbol)

                    if data and (data.get("holdings") or data.get("top_10_holdings")):
                        self._save_etf_holdings(symbol, data)
                        results["success"].append({
                            "symbol": symbol,
                            "holdings_count": len(data.get("holdings", [])) or len(data.get("top_10_holdings", []))
                        })
                        logger.info(f"✅ [{i+1}/{len(etf_symbols)}] {symbol} 持仓同步成功")
                    else:
                        results["failed"].append(symbol)
                        logger.warning(f"⚠️ [{i+1}/{len(etf_symbols)}] {symbol} 无持仓数据")

                    # 添加延迟避免 API 速率限制
                    if i % 3 == 0 and i < len(etf_symbols) - 1:
                        await asyncio.sleep(0.5)

                except Exception as e:
                    logger.error(f"❌ [{i+1}/{len(etf_symbols)}] {symbol} 同步失败: {e}")
                    results["failed"].append(symbol)

            logger.info(f"📊 持仓同步完成: {len(results['success'])} 成功, {len(results['failed'])} 失败")
            return results
        finally:
            client.close()

    def get_market_overview(self) -> Dict:
        """
        获取市场概览数据

        返回:
            {indices, sectors, market_status, updated_at}
        """
        client = self._get_client()
        if not client:
            # 如果没有 API Key，从数据库获取缓存数据
            return self._get_cached_market_overview()

        try:
            data = client.get_market_overview()
            data["updated_at"] = datetime.now().isoformat()
            return data
        finally:
            client.close()

    def _get_cached_market_overview(self) -> Dict:
        """从数据库获取缓存的市场概览数据"""
        sectors = self.calculate_sector_strength()

        return {
            "indices": [],
            "sectors": [
                {
                    "symbol": s["symbol"],
                    "name": s["name_cn"],
                    "name_en": s["name"],
                    "color": s["color"],
                    "price": s.get("close", 0),
                    "change_pct": s["change_1d"]
                }
                for s in sectors
            ],
            "market_status": "cached",
            "updated_at": sectors[0]["date"] if sectors else None
        }


# 全局单例
_sector_rotation_service = None


def get_sector_rotation_service() -> SectorRotationService:
    """获取板块轮动服务单例"""
    global _sector_rotation_service
    if _sector_rotation_service is None:
        _sector_rotation_service = SectorRotationService()
    return _sector_rotation_service
