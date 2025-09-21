const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export interface CandlestickBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryBarsResponse {
  symbol: string;
  period: string;
  adjust_type: string;
  bars: CandlestickBar[];
}

export interface HistorySyncResponse {
  processed: Record<string, number>;
  period: string;
  adjust_type: string;
}

export async function getCandlesticks(
  symbol: string,
  limit: number = 200,
  period: string = 'day',
  adjustType: string = 'no_adjust'
): Promise<HistoryBarsResponse> {
  const params = new URLSearchParams({
    symbol,
    limit: limit.toString(),
    period,
    adjust_type: adjustType,
  });

  const response = await fetch(`${API_BASE}/quotes/history?${params}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to fetch candlesticks');
  }

  return response.json();
}

export async function syncCandlesticks(
  symbols?: string[],
  period: string = 'day',
  adjustType: string = 'forward_adjust',
  count: number = 120
): Promise<HistorySyncResponse> {
  const response = await fetch(`${API_BASE}/quotes/history/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      symbols,
      period,
      adjust_type: adjustType,
      count,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to sync candlesticks');
  }

  return response.json();
}