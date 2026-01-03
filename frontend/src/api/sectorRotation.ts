/**
 * 板块轮动 API 客户端
 * 支持板块、因子、主题 ETF 分析
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

// ========== 类型定义 ==========

export type ETFType = "sector" | "index" | "industry" | "factor" | "theme" | "all";

export interface SectorInfo {
  symbol: string;
  name: string;
  name_cn: string;
  color: string;
  close: number;
  change_1d: number;
  change_5d: number;
  change_20d: number;
  change_60d: number;
  strength_score: number;
  trend: string;
  rank: number;
  date: string;
}

export interface HeatmapItem {
  name: string;
  symbol: string;
  value: number;
  strength: number;
  trend: string;
  change_5d: number;
  change_20d: number;
  color: string;
}

export interface TrendData {
  dates: string[];
  data: Record<string, Record<string, { name: string; change_5d: number; close: number }>>;
  sectors: string[];
}

export interface SectorStock {
  symbol: string;
  name: string;
  market_cap: number | null;
  pe_ratio: number | null;
  price: number | null;
  change_pct: number | null;
  rs_rank?: number;
  screened_at?: string;
  size?: number;
  color?: string;
}

export interface ScreenResult {
  sectors: SectorInfo[];
  stocks_by_sector: Record<string, SectorStock[]>;
}

export interface SectorETF {
  symbol: string;
  name: string;
  name_cn: string;
  color: string;
  type?: string;
  factor?: string;
  theme?: string;
  index?: string;
  industry?: string;
}

// Finviz 热力图数据
export interface FinvizSector {
  symbol: string;
  name: string;
  change_pct: number;
  strength_score: number;
  color: string;
  stocks: SectorStock[];
  stock_count: number;
  positive_count: number;
  negative_count: number;
}

export interface FinvizHeatmapData {
  sectors: FinvizSector[];
  summary: {
    total_stocks: number;
    positive_count: number;
    negative_count: number;
    avg_change: number;
  };
}

// 因子数据
export interface FactorETF {
  symbol: string;
  name: string;
  name_cn: string;
  change_1d: number;
  change_5d: number;
}

export interface FactorInfo {
  factor: string;
  name_cn: string;
  etfs: FactorETF[];
  etf_count: number;
  avg_change_1d: number;
  avg_change_5d: number;
  avg_change_20d: number;
  avg_change_60d: number;
  strength_score: number;
  trend: string;
  momentum: string;
  rank: number;
}

// 因子轮动信号
export interface FactorMomentum {
  name_cn: string;
  recent_avg: number;
  momentum: number;
  trend_slope: number;
  is_strengthening: boolean;
}

export interface FactorRotation {
  dominant_factor: string | null;
  dominant_factor_cn: string;
  rotation_signal: string;
  signal_description: string;
  factor_momentum: Record<string, FactorMomentum>;
  strengthening_factors: string[];
  weakening_factors: string[];
  recommendation: string;
}

// ETF 表现
export interface ETFPerformance {
  symbol: string;
  name: string;
  name_cn: string;
  type: string;
  factor?: string;
  color: string;
  close: number;
  change_1d: number;
  change_5d: number;
  change_20d: number;
  change_60d: number;
  date: string;
}

// ========== API 响应类型 ==========

interface BaseResponse {
  status: string;
  message?: string;
}

interface SyncResponse extends BaseResponse {
  etf_type?: string;
  success: string[];
  failed: string[];
}

interface SectorsResponse extends BaseResponse {
  count: number;
  sectors: SectorInfo[];
}

interface HeatmapResponse extends BaseResponse {
  count: number;
  data: HeatmapItem[];
}

interface TrendResponse extends BaseResponse {
  days: number;
  dates: string[];
  data: Record<string, Record<string, { name: string; change_5d: number; close: number }>>;
  sectors: string[];
}

interface ScreenResponse extends BaseResponse {
  sectors: SectorInfo[];
  stocks_by_sector: Record<string, SectorStock[]>;
}

interface StocksResponse extends BaseResponse {
  total: number;
  sectors_count: number;
  stocks_by_sector: Record<string, SectorStock[]>;
}

interface AddToPickerResponse extends BaseResponse {
  added: number;
}

interface ETFListResponse extends BaseResponse {
  etf_type?: string;
  count: number;
  etfs: SectorETF[];
}

interface FinvizHeatmapResponse extends BaseResponse {
  sectors: FinvizSector[];
  summary: {
    total_stocks: number;
    positive_count: number;
    negative_count: number;
    avg_change: number;
  };
}

interface FactorsResponse extends BaseResponse {
  count: number;
  factors: FactorInfo[];
}

interface FactorRotationResponse extends BaseResponse {
  lookback_days: number;
  dominant_factor: string | null;
  dominant_factor_cn: string;
  rotation_signal: string;
  signal_description: string;
  factor_momentum: Record<string, FactorMomentum>;
  strengthening_factors: string[];
  weakening_factors: string[];
  recommendation: string;
}

interface ETFPerformanceResponse extends BaseResponse {
  etf_type?: string;
  count: number;
  etfs: ETFPerformance[];
}

// ========== API 函数 ==========

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = `请求失败 (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.detail) {
        errorMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {
      // 非 JSON 响应
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * 同步 ETF 数据
 * @param days 同步天数
 * @param etfType ETF 类型: sector/factor/theme/all
 */
export async function syncSectorData(
  days: number = 60,
  etfType: ETFType = "sector"
): Promise<SyncResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days, etf_type: etfType }),
  });
  return handleResponse(res);
}

/**
 * 获取板块强度排名
 */
export async function getSectors(): Promise<SectorsResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/sectors`);
  return handleResponse(res);
}

/**
 * 获取热力图数据
 */
export async function getHeatmapData(): Promise<HeatmapResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/heatmap`);
  return handleResponse(res);
}

/**
 * 获取轮动趋势数据
 */
export async function getRotationTrend(days: number = 30): Promise<TrendResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/trend?days=${days}`);
  return handleResponse(res);
}

/**
 * 筛选强势板块股票
 */
export async function screenTopSectorStocks(
  topN: number = 3,
  stocksPerSector: number = 10,
  marketCapMin: number = 1e9
): Promise<ScreenResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      top_n_sectors: topN,
      stocks_per_sector: stocksPerSector,
      market_cap_min: marketCapMin,
    }),
  });
  return handleResponse(res);
}

/**
 * 获取已筛选的板块股票
 */
export async function getSectorStocks(sectorSymbol?: string): Promise<StocksResponse> {
  const url = sectorSymbol
    ? `${API_BASE}/api/sector-rotation/stocks?sector_symbol=${sectorSymbol}`
    : `${API_BASE}/api/sector-rotation/stocks`;
  const res = await fetch(url);
  return handleResponse(res);
}

/**
 * 将板块股票添加到选股池
 */
export async function addSectorStocksToPicker(
  sectorSymbol: string,
  poolType: string = "LONG"
): Promise<AddToPickerResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/add-to-picker/${sectorSymbol}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pool_type: poolType }),
  });
  return handleResponse(res);
}

/**
 * 获取支持的 ETF 列表
 * @param etfType ETF 类型: sector/factor/theme，为空返回全部
 */
export async function getETFList(etfType?: ETFType): Promise<ETFListResponse> {
  const url = etfType
    ? `${API_BASE}/api/sector-rotation/etf-list?etf_type=${etfType}`
    : `${API_BASE}/api/sector-rotation/etf-list`;
  const res = await fetch(url);
  return handleResponse(res);
}

// ========== 新增 API ==========

/**
 * 获取 Finviz 风格热力图数据
 */
export async function getFinvizHeatmap(): Promise<FinvizHeatmapResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/finviz-heatmap`);
  return handleResponse(res);
}

/**
 * 获取因子强度排名
 */
export async function getFactors(): Promise<FactorsResponse> {
  const res = await fetch(`${API_BASE}/api/sector-rotation/factors`);
  return handleResponse(res);
}

/**
 * 获取因子轮动信号
 * @param lookbackDays 回溯天数
 */
export async function getFactorRotation(
  lookbackDays: number = 20
): Promise<FactorRotationResponse> {
  const res = await fetch(
    `${API_BASE}/api/sector-rotation/factor-rotation?lookback_days=${lookbackDays}`
  );
  return handleResponse(res);
}

/**
 * 获取所有 ETF 的表现数据
 * @param etfType ETF 类型: sector/factor/theme，为空返回全部
 */
export async function getETFPerformance(
  etfType?: ETFType
): Promise<ETFPerformanceResponse> {
  const url = etfType
    ? `${API_BASE}/api/sector-rotation/etf-performance?etf_type=${etfType}`
    : `${API_BASE}/api/sector-rotation/etf-performance`;
  const res = await fetch(url);
  return handleResponse(res);
}
