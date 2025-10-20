export type Credentials = {
  LONGPORT_APP_KEY: string;
  LONGPORT_APP_SECRET: string;
  LONGPORT_ACCESS_TOKEN: string;
};

export type SymbolsResponse = {
  symbols: string[];
};

export type VerifyResponse = {
  status: string;
  tested_symbols: string;
};

export type SyncHistoryPayload = {
  symbols?: string[];
  period?: string;
  adjust_type?: string;
  count?: number;
};

export type SyncHistoryResponse = {
  status: string;
  processed: Record<string, number>;
  period: string;
  adjust_type: string;
};

export type HistoryBar = {
  ts: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  turnover: number | null;
};

export type HistoryBarsResponse = {
  symbol: string;
  period: string;
  adjust_type: string;
  bars: HistoryBar[];
};

export type TickItem = {
  ts: string;
  sequence: number | null;
  price: number | null;
  volume: number | null;
  turnover: number | null;
  current_volume: number | null;
  current_turnover: number | null;
};

export type TickListResponse = {
  symbol: string;
  limit: number;
  ticks: TickItem[];
};

export type StreamStatusResponse = {
  status: string;
  detail?: string | null;
  subscribed: string[];
  listeners: number;
  last_quote_at?: string | null;
};

export type PositionListResponse = {
  positions: PortfolioPosition[];
};

export type PortfolioPosition = {
  symbol: string;
  symbol_name: string | null;
  currency: string | null;
  market: string | null;
  qty: number;
  available_quantity: number | null;
  avg_price: number;
  cost_value: number;
  last_price: number | null;
  last_price_time: string | null;
  market_value: number;
  pnl: number;
  pnl_percent: number;
  account_channel: string | null;
  direction: string;
};

export type PortfolioOverviewResponse = {
  positions: PortfolioPosition[];
  totals: {
    cost: number;
    market_value: number;
    pnl: number;
    pnl_percent: number;
    day_pnl?: number;
    day_pnl_percent?: number;
  };
  // 后端返回的账户资金信息（按币种分组），这里仅使用 USD
  account_balance?: Record<string, any>;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export class APIError extends Error {
  status: number;
  errorCode?: string;
  solution?: string;
  steps?: string[];
  platformUrl?: string;
  rawError?: string;

  constructor(message: string, options: {
    status: number;
    errorCode?: string;
    solution?: string;
    steps?: string[];
    platformUrl?: string;
    rawError?: string;
  }) {
    super(message);
    this.name = 'APIError';
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.solution = options.solution;
    this.steps = options.steps;
    this.platformUrl = options.platformUrl;
    this.rawError = options.rawError;
  }
}

function parseErrorMessage(text: string, status: number): string | APIError {
  try {
    const parsed = JSON.parse(text);
    
    // 如果是新的详细错误格式
    if (parsed.detail && typeof parsed.detail === 'object') {
      const detail = parsed.detail;
      return new APIError(
        detail.message || `请求失败 (${status})`,
        {
          status,
          errorCode: detail.error_code || detail.error,
          solution: detail.solution,
          steps: detail.steps,
          platformUrl: detail.platform_url,
          rawError: detail.raw_error
        }
      );
    }
    
    // 兼容旧格式
    if (parsed.detail) {
      return typeof parsed.detail === 'string' 
        ? parsed.detail 
        : JSON.stringify(parsed.detail);
    }
  } catch {
    // 非 JSON 响应忽略
  }
  
  return `请求失败 (${status})`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorMessage(text, res.status);
    if (error instanceof APIError) {
      throw error;
    }
    throw new Error(error);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}

export function resolveWsUrl(path: string): string {
  const base = API_BASE;
  if (base.startsWith("https")) {
    return base.replace(/^https/, "wss") + path;
  }
  return base.replace(/^http/, "ws") + path;
}

export async function fetchCredentials(): Promise<Partial<Credentials>> {
  const res = await fetch(`${API_BASE}/settings/credentials`);
  return handleResponse(res);
}

export async function updateCredentials(payload: Credentials): Promise<void> {
  const res = await fetch(`${API_BASE}/settings/credentials`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse<void>(res);
}

export async function fetchSymbols(): Promise<SymbolsResponse> {
  const res = await fetch(`${API_BASE}/settings/symbols`);
  return handleResponse(res);
}

export async function updateSymbols(symbols: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/settings/symbols`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  await handleResponse<void>(res);
}

export async function verifySettings(symbols: string[] = []): Promise<VerifyResponse> {
  const res = await fetch(`${API_BASE}/settings/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  return handleResponse(res);
}

export async function syncHistory(payload: SyncHistoryPayload): Promise<SyncHistoryResponse> {
  const res = await fetch(`${API_BASE}/quotes/history/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function fetchHistory(
  symbol: string,
  limit = 200,
  period = "day",
  adjust_type = "no_adjust"
): Promise<HistoryBarsResponse> {
  const params = new URLSearchParams({ symbol, limit: String(limit), period, adjust_type });
  const res = await fetch(`${API_BASE}/quotes/history?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchTicks(symbol: string, limit = 100): Promise<TickListResponse> {
  const params = new URLSearchParams({ symbol, limit: String(limit) });
  const res = await fetch(`${API_BASE}/quotes/ticks?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchStreamStatus(): Promise<StreamStatusResponse> {
  const res = await fetch(`${API_BASE}/quotes/stream/status`);
  return handleResponse(res);
}

export async function fetchPortfolioOverview(): Promise<PortfolioOverviewResponse> {
  const res = await fetch(`${API_BASE}/portfolio/overview`);
  return handleResponse(res);
}
