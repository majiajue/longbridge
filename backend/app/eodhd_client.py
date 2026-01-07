"""
EODHD API 客户端
用于获取板块 ETF 数据和股票筛选
"""
import httpx
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# 板块 ETF 映射（SPDR Select Sector ETFs）
SECTOR_ETFS = {
    "XLK": {"name": "Technology", "name_cn": "科技", "color": "#3b82f6", "type": "sector"},
    "XLF": {"name": "Financials", "name_cn": "金融", "color": "#10b981", "type": "sector"},
    "XLE": {"name": "Energy", "name_cn": "能源", "color": "#f59e0b", "type": "sector"},
    "XLV": {"name": "Healthcare", "name_cn": "医疗保健", "color": "#ef4444", "type": "sector"},
    "XLY": {"name": "Consumer Discretionary", "name_cn": "可选消费", "color": "#8b5cf6", "type": "sector"},
    "XLP": {"name": "Consumer Staples", "name_cn": "必需消费", "color": "#06b6d4", "type": "sector"},
    "XLI": {"name": "Industrials", "name_cn": "工业", "color": "#6366f1", "type": "sector"},
    "XLB": {"name": "Materials", "name_cn": "原材料", "color": "#84cc16", "type": "sector"},
    "XLU": {"name": "Utilities", "name_cn": "公用事业", "color": "#f97316", "type": "sector"},
    "XLRE": {"name": "Real Estate", "name_cn": "房地产", "color": "#ec4899", "type": "sector"},
    "XLC": {"name": "Communication Services", "name_cn": "通信服务", "color": "#14b8a6", "type": "sector"},
}

# 主要指数 ETF
INDEX_ETFS = {
    # 三大指数
    "SPY": {"name": "S&P 500", "name_cn": "标普500", "index": "sp500", "color": "#3b82f6", "type": "index"},
    "QQQ": {"name": "Nasdaq 100", "name_cn": "纳斯达克100", "index": "nasdaq", "color": "#10b981", "type": "index"},
    "DIA": {"name": "Dow Jones", "name_cn": "道琼斯", "index": "dow", "color": "#f59e0b", "type": "index"},
    # 罗素指数
    "IWM": {"name": "Russell 2000", "name_cn": "罗素2000小盘", "index": "russell", "color": "#8b5cf6", "type": "index"},
    "IWB": {"name": "Russell 1000", "name_cn": "罗素1000大盘", "index": "russell", "color": "#6366f1", "type": "index"},
    "IWF": {"name": "Russell 1000 Growth", "name_cn": "罗素1000成长", "index": "russell", "color": "#059669", "type": "index"},
    "IWD": {"name": "Russell 1000 Value", "name_cn": "罗素1000价值", "index": "russell", "color": "#1d4ed8", "type": "index"},
    # 全市场
    "VTI": {"name": "Total Stock Market", "name_cn": "全美股票", "index": "total", "color": "#14b8a6", "type": "index"},
    "VT": {"name": "Total World Stock", "name_cn": "全球股票", "index": "world", "color": "#0891b2", "type": "index"},
}

# 细分行业 ETF
INDUSTRY_ETFS = {
    # 半导体
    "SOXX": {"name": "Semiconductors", "name_cn": "半导体", "industry": "semiconductor", "color": "#3b82f6", "type": "industry"},
    "SMH": {"name": "Semiconductor", "name_cn": "半导体ETF", "industry": "semiconductor", "color": "#1d4ed8", "type": "industry"},
    # 银行金融
    "KBE": {"name": "Banks", "name_cn": "银行", "industry": "bank", "color": "#10b981", "type": "industry"},
    "KRE": {"name": "Regional Banks", "name_cn": "区域银行", "industry": "bank", "color": "#059669", "type": "industry"},
    # 生物医药
    "XBI": {"name": "Biotech", "name_cn": "生物科技", "industry": "biotech", "color": "#ef4444", "type": "industry"},
    "IBB": {"name": "Nasdaq Biotech", "name_cn": "纳斯达克生科", "industry": "biotech", "color": "#dc2626", "type": "industry"},
    # 零售消费
    "XRT": {"name": "Retail", "name_cn": "零售", "industry": "retail", "color": "#8b5cf6", "type": "industry"},
    "XHB": {"name": "Homebuilders", "name_cn": "房屋建筑", "industry": "housing", "color": "#7c3aed", "type": "industry"},
    # 能源资源
    "XOP": {"name": "Oil & Gas E&P", "name_cn": "油气开采", "industry": "oil_gas", "color": "#f59e0b", "type": "industry"},
    "XME": {"name": "Metals & Mining", "name_cn": "金属矿业", "industry": "mining", "color": "#d97706", "type": "industry"},
    "GDX": {"name": "Gold Miners", "name_cn": "黄金矿业", "industry": "gold", "color": "#b45309", "type": "industry"},
    # 交通运输
    "JETS": {"name": "Airlines", "name_cn": "航空", "industry": "airline", "color": "#06b6d4", "type": "industry"},
    "IYT": {"name": "Transportation", "name_cn": "交通运输", "industry": "transport", "color": "#0891b2", "type": "industry"},
    # 国防军工
    "ITA": {"name": "Aerospace & Defense", "name_cn": "航空国防", "industry": "defense", "color": "#6366f1", "type": "industry"},
    "XAR": {"name": "Aerospace & Defense", "name_cn": "航天国防", "industry": "defense", "color": "#4f46e5", "type": "industry"},
}

# 因子 ETF 映射
FACTOR_ETFS = {
    # 价值因子
    "VTV": {"name": "Value", "name_cn": "价值", "factor": "value", "color": "#3b82f6", "type": "factor"},
    "IVE": {"name": "S&P 500 Value", "name_cn": "标普价值", "factor": "value", "color": "#1d4ed8", "type": "factor"},
    "VLUE": {"name": "MSCI USA Value", "name_cn": "MSCI价值", "factor": "value", "color": "#2563eb", "type": "factor"},

    # 成长因子
    "VUG": {"name": "Growth", "name_cn": "成长", "factor": "growth", "color": "#10b981", "type": "factor"},
    "IVW": {"name": "S&P 500 Growth", "name_cn": "标普成长", "factor": "growth", "color": "#059669", "type": "factor"},
    "MTUM": {"name": "MSCI USA Momentum", "name_cn": "动量", "factor": "momentum", "color": "#047857", "type": "factor"},

    # 质量因子
    "QUAL": {"name": "Quality", "name_cn": "质量", "factor": "quality", "color": "#8b5cf6", "type": "factor"},

    # 低波动因子
    "USMV": {"name": "Min Volatility", "name_cn": "低波动", "factor": "low_vol", "color": "#6366f1", "type": "factor"},
    "SPLV": {"name": "Low Volatility", "name_cn": "低波动", "factor": "low_vol", "color": "#4f46e5", "type": "factor"},

    # 高分红因子
    "VYM": {"name": "High Dividend", "name_cn": "高分红", "factor": "dividend", "color": "#f59e0b", "type": "factor"},
    "DVY": {"name": "Dividend Select", "name_cn": "精选分红", "factor": "dividend", "color": "#d97706", "type": "factor"},
    "SDY": {"name": "Dividend Aristocrats", "name_cn": "分红贵族", "factor": "dividend", "color": "#b45309", "type": "factor"},

    # 规模因子
    "IJR": {"name": "Small Cap", "name_cn": "小盘", "factor": "size", "color": "#ec4899", "type": "factor"},
    "IJH": {"name": "Mid Cap", "name_cn": "中盘", "factor": "size", "color": "#db2777", "type": "factor"},
}

# 主题 ETF 映射
THEME_ETFS = {
    "ARKK": {"name": "Innovation", "name_cn": "创新科技", "theme": "innovation", "color": "#8b5cf6", "type": "theme"},
    "ARKG": {"name": "Genomic Revolution", "name_cn": "基因革命", "theme": "genomic", "color": "#a855f7", "type": "theme"},
    "ARKF": {"name": "Fintech Innovation", "name_cn": "金融科技", "theme": "fintech", "color": "#c084fc", "type": "theme"},
    "ICLN": {"name": "Clean Energy", "name_cn": "清洁能源", "theme": "clean_energy", "color": "#10b981", "type": "theme"},
    "TAN": {"name": "Solar", "name_cn": "太阳能", "theme": "solar", "color": "#f59e0b", "type": "theme"},
    "LIT": {"name": "Lithium & Battery", "name_cn": "锂电池", "theme": "battery", "color": "#06b6d4", "type": "theme"},
    "HACK": {"name": "Cybersecurity", "name_cn": "网络安全", "theme": "cyber", "color": "#ef4444", "type": "theme"},
    "ROBO": {"name": "Robotics & AI", "name_cn": "机器人与AI", "theme": "ai", "color": "#6366f1", "type": "theme"},
    "BOTZ": {"name": "Robotics & AI", "name_cn": "机器人AI", "theme": "ai", "color": "#4f46e5", "type": "theme"},
    "SKYY": {"name": "Cloud Computing", "name_cn": "云计算", "theme": "cloud", "color": "#0ea5e9", "type": "theme"},
    "WCLD": {"name": "Cloud Computing", "name_cn": "云计算ETF", "theme": "cloud", "color": "#0284c7", "type": "theme"},
    "ESPO": {"name": "Video Games & Esports", "name_cn": "电竞游戏", "theme": "gaming", "color": "#ec4899", "type": "theme"},
    "BLOK": {"name": "Blockchain", "name_cn": "区块链", "theme": "blockchain", "color": "#f97316", "type": "theme"},
}

# 合并所有 ETF
ALL_ETFS = {**SECTOR_ETFS, **INDEX_ETFS, **INDUSTRY_ETFS, **FACTOR_ETFS, **THEME_ETFS}

# 因子中文名映射
FACTOR_NAMES_CN = {
    "value": "价值",
    "growth": "成长",
    "momentum": "动量",
    "quality": "质量",
    "low_vol": "低波动",
    "dividend": "高分红",
    "size": "规模",
}

# EODHD 板块名称到 ETF 的反向映射
SECTOR_NAME_TO_ETF = {
    "Technology": "XLK",
    "Financial Services": "XLF",
    "Financials": "XLF",
    "Energy": "XLE",
    "Healthcare": "XLV",
    "Consumer Cyclical": "XLY",
    "Consumer Discretionary": "XLY",
    "Consumer Defensive": "XLP",
    "Consumer Staples": "XLP",
    "Industrials": "XLI",
    "Basic Materials": "XLB",
    "Materials": "XLB",
    "Utilities": "XLU",
    "Real Estate": "XLRE",
    "Communication Services": "XLC",
}

# 板块英文名到中文名映射
SECTOR_NAME_CN = {
    "Technology": "科技",
    "Financial Services": "金融",
    "Financials": "金融",
    "Energy": "能源",
    "Healthcare": "医疗保健",
    "Consumer Cyclical": "可选消费",
    "Consumer Discretionary": "可选消费",
    "Consumer Defensive": "必需消费",
    "Consumer Staples": "必需消费",
    "Industrials": "工业",
    "Basic Materials": "原材料",
    "Materials": "原材料",
    "Utilities": "公用事业",
    "Real Estate": "房地产",
    "Communication Services": "通信服务",
}


class EODHDClient:
    """EODHD API 客户端"""

    BASE_URL = "https://eodhd.com/api"

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("EODHD API Key 不能为空")
        self.api_key = api_key
        self.client = httpx.Client(timeout=30.0)
        logger.info("✅ EODHD 客户端已初始化")

    def get_etf_eod(self, symbol: str, days: int = 60) -> List[Dict]:
        """
        获取 ETF 历史数据（End of Day）

        参数:
            symbol: ETF 代码，如 XLK
            days: 获取天数

        返回:
            [{date, open, high, low, close, volume, adjusted_close}, ...]
        """
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        url = f"{self.BASE_URL}/eod/{symbol}.US"
        params = {
            "api_token": self.api_key,
            "from": from_date,
            "fmt": "json"
        }

        try:
            logger.info(f"📊 获取 ETF 数据: {symbol} (最近 {days} 天)")
            response = self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            logger.info(f"✅ 获取 {symbol} 数据成功: {len(data)} 条记录")
            return data
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ EODHD API 错误 {symbol}: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"❌ 获取 ETF 数据失败 {symbol}: {e}")
            return []

    def get_bulk_eod(self, exchange: str = "US", date: Optional[str] = None) -> List[Dict]:
        """
        批量获取某个交易所的 EOD 数据

        参数:
            exchange: 交易所代码，如 US
            date: 日期，格式 YYYY-MM-DD，默认最新

        返回:
            [{code, exchange_short_name, date, open, high, low, close, volume}, ...]
        """
        url = f"{self.BASE_URL}/eod-bulk-last-day/{exchange}"
        params = {
            "api_token": self.api_key,
            "fmt": "json"
        }
        if date:
            params["date"] = date

        try:
            logger.info(f"📊 批量获取 {exchange} 数据")
            response = self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            logger.info(f"✅ 批量获取成功: {len(data)} 只股票")
            return data
        except Exception as e:
            logger.error(f"❌ 批量获取数据失败: {e}")
            return []

    def screen_stocks_by_sector(
        self,
        sector: str,
        market_cap_min: float = 1e9,
        limit: int = 50
    ) -> List[Dict]:
        """
        使用 EODHD Screener API 按板块筛选股票

        参数:
            sector: 板块名称，如 Technology, Healthcare
            market_cap_min: 最小市值（美元），默认 10 亿
            limit: 返回数量

        返回:
            [{code, name, exchange, sector, market_capitalization, ...}, ...]
        """
        url = f"{self.BASE_URL}/screener"

        # 构建筛选条件
        import json
        filters = [
            ["sector", "=", sector],
            ["market_capitalization", ">", int(market_cap_min)],
            ["exchange", "=", "us"]
        ]

        params = {
            "api_token": self.api_key,
            "filters": json.dumps(filters),
            "limit": limit,
            "sort": "market_capitalization.desc",
            "fmt": "json"
        }

        try:
            logger.info(f"🔍 筛选板块股票: {sector} (市值 > ${market_cap_min/1e9:.1f}B)")
            response = self.client.get(url, params=params)
            response.raise_for_status()
            result = response.json()
            stocks = result.get("data", [])
            logger.info(f"✅ 筛选到 {len(stocks)} 只 {sector} 股票")
            return stocks
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Screener API 错误: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"❌ 板块筛选失败 {sector}: {e}")
            return []

    def get_stock_fundamentals(self, symbol: str) -> Dict:
        """
        获取股票基本面数据

        参数:
            symbol: 股票代码，如 AAPL

        返回:
            {General, Highlights, Valuation, ...}
        """
        url = f"{self.BASE_URL}/fundamentals/{symbol}.US"
        params = {
            "api_token": self.api_key,
            "fmt": "json"
        }

        try:
            response = self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"❌ 获取基本面数据失败 {symbol}: {e}")
            return {}

    def get_real_time_quote(self, symbol: str) -> Dict:
        """
        获取实时行情（延迟 15-20 分钟）

        参数:
            symbol: 股票代码

        返回:
            {code, timestamp, open, high, low, close, volume, ...}
        """
        url = f"{self.BASE_URL}/real-time/{symbol}.US"
        params = {
            "api_token": self.api_key,
            "fmt": "json"
        }

        try:
            response = self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"❌ 获取实时行情失败 {symbol}: {e}")
            return {}

    def get_etf_holdings(self, symbol: str) -> Dict:
        """
        获取 ETF 持仓和板块权重数据

        参数:
            symbol: ETF 代码，如 XLK, SPY

        返回:
            {
                general: {...},
                holdings: [{code, name, sector, assets_pct, ...}],
                sector_weights: {Technology: 25.5, ...},
                top_10_holdings: [...],
                total_assets: float
            }
        """
        url = f"{self.BASE_URL}/fundamentals/{symbol}.US"
        params = {
            "api_token": self.api_key,
            "fmt": "json"
        }

        try:
            logger.info(f"📊 获取 ETF 持仓数据: {symbol}")
            response = self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            result = {
                "symbol": symbol,
                "general": {},
                "holdings": [],
                "sector_weights": {},
                "top_10_holdings": [],
                "total_assets": 0
            }

            # 解析通用信息
            if "General" in data:
                general = data["General"]
                result["general"] = {
                    "name": general.get("Name", ""),
                    "description": general.get("Description", ""),
                    "category": general.get("Category", ""),
                    "fund_family": general.get("Fund_Family", ""),
                    "fund_type": general.get("Fund_Type", ""),
                    "exchange": general.get("Exchange", ""),
                    "currency": general.get("CurrencyCode", "USD")
                }

            # 解析 ETF 数据
            if "ETF_Data" in data:
                etf_data = data["ETF_Data"]

                # 总资产
                result["total_assets"] = etf_data.get("TotalAssets", 0)
                result["general"]["avg_market_cap"] = etf_data.get("Average_Mkt_Cap_Mil", 0)
                result["general"]["holdings_turnover"] = etf_data.get("AnnualHoldingsTurnover", 0)

                # 板块权重
                sector_weights = etf_data.get("Sector_Weights", {})
                if sector_weights:
                    for sector_name, weights in sector_weights.items():
                        if isinstance(weights, dict):
                            pct = weights.get("Equity_%", 0)
                        else:
                            pct = weights
                        if pct and pct > 0:
                            result["sector_weights"][sector_name] = round(float(pct), 2)

                # 前10大持仓
                top_10 = etf_data.get("Top_10_Holdings", {})
                if top_10:
                    for ticker, holding_data in top_10.items():
                        if isinstance(holding_data, dict):
                            result["top_10_holdings"].append({
                                "symbol": ticker,
                                "code": holding_data.get("Code", ticker.split(".")[0] if "." in ticker else ticker),
                                "name": holding_data.get("Name", ""),
                                "sector": holding_data.get("Sector", ""),
                                "industry": holding_data.get("Industry", ""),
                                "country": holding_data.get("Country", ""),
                                "assets_pct": round(float(holding_data.get("Assets_%", 0)), 2)
                            })

                # 全部持仓（如果有）
                all_holdings = etf_data.get("Holdings", {})
                if all_holdings:
                    for ticker, holding_data in all_holdings.items():
                        if isinstance(holding_data, dict):
                            result["holdings"].append({
                                "symbol": ticker,
                                "code": holding_data.get("Code", ticker.split(".")[0] if "." in ticker else ticker),
                                "name": holding_data.get("Name", ""),
                                "sector": holding_data.get("Sector", ""),
                                "industry": holding_data.get("Industry", ""),
                                "country": holding_data.get("Country", ""),
                                "assets_pct": round(float(holding_data.get("Assets_%", 0)), 4)
                            })

            # 按权重排序
            result["top_10_holdings"].sort(key=lambda x: x["assets_pct"], reverse=True)
            result["holdings"].sort(key=lambda x: x["assets_pct"], reverse=True)

            logger.info(f"✅ 获取 {symbol} 持仓成功: {len(result['holdings'])} 只股票, {len(result['sector_weights'])} 个板块")
            return result

        except httpx.HTTPStatusError as e:
            logger.error(f"❌ ETF 持仓 API 错误 {symbol}: {e.response.status_code}")
            return {}
        except Exception as e:
            logger.error(f"❌ 获取 ETF 持仓失败 {symbol}: {e}")
            return {}

    def get_market_overview(self) -> Dict:
        """
        获取市场概览数据（主要指数和板块表现）

        返回:
            {
                indices: [{symbol, name, price, change, change_pct}, ...],
                sectors: [{symbol, name, change_pct}, ...],
                market_status: str
            }
        """
        result = {
            "indices": [],
            "sectors": [],
            "market_status": "unknown"
        }

        # 获取主要指数实时数据
        major_indices = ["SPY", "QQQ", "DIA", "IWM", "VTI"]
        for idx_symbol in major_indices:
            try:
                quote = self.get_real_time_quote(idx_symbol)
                if quote:
                    result["indices"].append({
                        "symbol": idx_symbol,
                        "name": INDEX_ETFS.get(idx_symbol, {}).get("name_cn", idx_symbol),
                        "price": quote.get("close", 0),
                        "change": quote.get("change", 0),
                        "change_pct": quote.get("change_p", 0),
                        "volume": quote.get("volume", 0)
                    })
            except Exception as e:
                logger.warning(f"获取 {idx_symbol} 行情失败: {e}")

        # 获取板块 ETF 实时数据
        for sector_symbol in SECTOR_ETFS.keys():
            try:
                quote = self.get_real_time_quote(sector_symbol)
                if quote:
                    result["sectors"].append({
                        "symbol": sector_symbol,
                        "name": SECTOR_ETFS[sector_symbol].get("name_cn", sector_symbol),
                        "name_en": SECTOR_ETFS[sector_symbol].get("name", sector_symbol),
                        "color": SECTOR_ETFS[sector_symbol].get("color", "#666"),
                        "price": quote.get("close", 0),
                        "change_pct": quote.get("change_p", 0)
                    })
            except Exception as e:
                logger.warning(f"获取 {sector_symbol} 行情失败: {e}")

        # 按涨跌幅排序
        result["sectors"].sort(key=lambda x: x["change_pct"], reverse=True)

        return result

    def close(self):
        """关闭 HTTP 客户端"""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def get_eodhd_client(api_key: str) -> Optional[EODHDClient]:
    """获取 EODHD 客户端实例"""
    try:
        return EODHDClient(api_key)
    except Exception as e:
        logger.error(f"❌ 无法初始化 EODHD 客户端: {e}")
        return None
