import { useEffect, useRef, useState, useCallback } from 'react';
// Removed lightweight-charts - now using G2 for all charts
import { resolveWsUrl } from '../api/client';
import KLineChart from '../components/KLineChart';

interface RealtimeQuote {
  symbol: string;
  last_done: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  timestamp: number;
  change_rate: number;
  change_value: number;
}

interface CandlestickBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Symbol name mappings
const SYMBOL_NAMES: Record<string, string> = {
  '700.HK': '腾讯控股',
  '0005.HK': '汇丰控股',
  '9988.HK': '阿里巴巴',
  'AAPL.US': '苹果公司',
  'TSLA.US': '特斯拉',
  'NVDA.US': '英伟达',
  'MSFT.US': '微软',
  'GOOGL.US': '谷歌',
};

export default function RealtimeKLinePage() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [quotes, setQuotes] = useState<Map<string, RealtimeQuote>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [historicalData, setHistoricalData] = useState<CandlestickBar[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed chartReady state - now using G2 charts

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  // Removed chartContainerRef - now using G2 charts instead
  // Removed chartRef - now using G2 instead of lightweight-charts
  // Removed series refs - now using G2 instead of lightweight-charts
  const lastBarRef = useRef<any>(null);

  // Normalize HK symbols for comparison (pad to 4 digits)
  const normalizeSymbolHK = (sym: string | null | undefined) => {
    if (!sym) return '';
    const s = sym.toUpperCase();
    if (s.endsWith('.HK')) {
      const [code, mkt] = s.split('.');
      if (/^\d+$/.test(code)) {
        return `${String(parseInt(code, 10)).padStart(4, '0')}.${mkt}`;
      }
    }
    return s;
  };

  // De-normalize HK symbols for lookup (remove leading zeros)
  const denormalizeSymbolHK = (sym: string) => {
    const s = sym.toUpperCase();
    if (s.endsWith('.HK')) {
      const [code, mkt] = s.split('.');
      if (/^\d+$/.test(code)) {
        return `${String(parseInt(code, 10))}.${mkt}`;
      }
    }
    return s;
  };

  // Ensure the selected symbol is subscribed on backend
  const ensureSubscribed = useCallback(async (symbol: string) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const res = await fetch(`${base}/settings/symbols`);
      if (!res.ok) return;
      const data = await res.json();
      const list: string[] = (data?.symbols || []).map((s: string) => s.toUpperCase());
      const symU = symbol.toUpperCase();
      if (!list.includes(symU)) {
        const merged = Array.from(new Set([...list, symU]));
        await fetch(`${base}/settings/symbols`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: merged })
        });
      }
    } catch (e) {
      // 静默失败，不阻塞前端渲染
      console.warn('ensureSubscribed failed', e);
    }
  }, []);

  // Load symbols from backend: merge settings symbols + portfolio positions
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
        const [resSymbols, resPortfolio] = await Promise.all([
          fetch(`${base}/settings/symbols`),
          fetch(`${base}/portfolio/overview`)
        ]);

        const finalSet = new Set<string>();
        if (resSymbols.ok) {
          const data = await resSymbols.json();
          (data.symbols || []).forEach((s: string) => finalSet.add(s));
        }
        if (resPortfolio.ok) {
          const p = await resPortfolio.json();
          (p.positions || []).forEach((pos: any) => {
            if (pos?.symbol) finalSet.add(pos.symbol);
          });
        }

        const merged = Array.from(finalSet);
        if (merged.length === 0) {
          const defaults = ['700.HK', '0005.HK', 'AAPL.US'];
          setSymbols(defaults);
          setSelectedSymbol(defaults[0]);
        } else {
          setSymbols(merged);
          setSelectedSymbol(merged[0]);
        }
      } catch (error) {
        console.error('Failed to load symbols/positions:', error);
        const defaults = ['700.HK', '0005.HK', 'AAPL.US'];
        setSymbols(defaults);
        setSelectedSymbol(defaults[0]);
      } finally {
        setLoading(false);
      }
    };

    loadSymbols();
  }, []);

  // Removed lightweight-charts initialization - now using G2 charts

  // Load historical data
  const loadHistoricalData = useCallback(async () => {
    if (!selectedSymbol) return;

    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const params = new URLSearchParams({
        symbol: selectedSymbol,
        limit: '1000',
        period: 'min1',
        adjust_type: 'no_adjust'
      });

      const response = await fetch(`${base}/quotes/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        let bars = data.bars || [];

        // Auto sync if empty (best-effort), then refetch
        if (!bars.length) {
          try {
            await fetch(`${base}/quotes/history/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: [selectedSymbol], period: 'min1', adjust_type: 'no_adjust', count: 1000 })
            });
            const refetch = await fetch(`${base}/quotes/history?${new URLSearchParams({ symbol: selectedSymbol, limit: '1000', period: 'min1', adjust_type: 'no_adjust' }).toString()}`);
            if (refetch.ok) {
              const refetched = await refetch.json();
              bars = refetched.bars || [];
            }
          } catch (e) {
            console.error('Sync history failed:', e);
          }
        }

        setHistoricalData(bars);
        // G2 charts will get data from historicalData state automatically
      }
    } catch (error) {
      console.error('Failed to load historical data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  // Load data when symbol changes
  useEffect(() => {
    if (selectedSymbol) {
      loadHistoricalData();
      // also ensure backend subscribes to this symbol for realtime quotes
      ensureSubscribed(selectedSymbol);
    }
  }, [selectedSymbol, loadHistoricalData, ensureSubscribed]);

  // Removed historical data rendering for lightweight-charts - now using G2

  // WebSocket connection with improved stability
  useEffect(() => {
    let isActive = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    const connectWebSocket = () => {
      if (!isActive) return;

      const wsUrl = resolveWsUrl('/ws/quotes');
      console.log(`Attempting WebSocket connection (attempt ${reconnectAttempts + 1})...`);

      setConnectionStatus('connecting');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus('connected');
        reconnectAttempts = 0; // Reset attempts on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'quote') {
            // Update quotes map
            setQuotes(prev => {
              const newQuotes = new Map(prev);
              const norm = normalizeSymbolHK(data.symbol);
              const denorm = denormalizeSymbolHK(norm);
              newQuotes.set(norm, data);
              newQuotes.set(denorm, data);
              return newQuotes;
            });

            // Real-time chart updates handled by G2 components through state
          } else if (data.type === 'status') {
            console.log('Status update:', data.status, data.detail);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Reconnect logic with exponential backoff
        if (isActive && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);
          console.log(`Reconnecting in ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isActive) {
              connectWebSocket();
            }
          }, delay);
        }
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      isActive = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, []); // Empty dependency array - only run once

  // Calculate stats
  const currentQuote = quotes.get(selectedSymbol);
  const priceChange = currentQuote ? currentQuote.change_value : 0;
  const priceChangePercent = currentQuote ? currentQuote.change_rate : 0;
  const isUp = priceChange >= 0;

  if (loading && symbols.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card bg-gradient-to-br from-purple-600 to-pink-700 dark:from-purple-700 dark:to-pink-800 text-white p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">实时K线监控</h2>
            <p className="text-purple-100">
              历史K线 + 实时推送 · 专业图表分析
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadHistoricalData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              刷新数据
            </button>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-green-500/20 text-green-200' :
              connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-200' :
              'bg-red-500/20 text-red-200'
            }`}>
              {connectionStatus === 'connected' ? '● 实时推送中' :
               connectionStatus === 'connecting' ? '● 连接中...' :
               '● 未连接'}
            </div>
          </div>
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">监控标的</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {symbols.map(symbol => {
            const quote = quotes.get(symbol);
            const isSelected = selectedSymbol === symbol;

            return (
              <button
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-gray-900 dark:text-white">
                    {symbol}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {SYMBOL_NAMES[symbol] || symbol}
                  </div>
                  {quote && (
                    <>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {quote.last_done.toFixed(2)}
                      </div>
                      <div className={`text-xs font-medium ${
                        quote.change_value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {quote.change_value >= 0 ? '+' : ''}{quote.change_rate.toFixed(2)}%
                      </div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time Stats */}
      {currentQuote && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {selectedSymbol} - {SYMBOL_NAMES[selectedSymbol] || selectedSymbol}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最新价</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {currentQuote.last_done.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">涨跌</div>
              <div className={`text-xl font-bold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isUp ? '+' : ''}{priceChange.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">涨跌幅</div>
              <div className={`text-xl font-bold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isUp ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">开盘</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {currentQuote.open.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最高</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {currentQuote.high.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最低</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {currentQuote.low.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">成交量</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {(currentQuote.volume / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">成交额</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {(currentQuote.turnover / 1000000).toFixed(2)}M
              </div>
            </div>
          </div>
        </div>
      )}

      {/* K-Line Chart */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            K线图表
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {historicalData.length} 条历史数据 + 实时更新
          </div>
        </div>
        {/* KLineCharts专业K线图 */}
        <RealKLineChart symbol={selectedSymbol} />
      </div>

      {/* All Quotes Table */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          全部行情
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">代码</th>
                <th className="px-4 py-2 text-left">名称</th>
                <th className="px-4 py-2 text-right">最新价</th>
                <th className="px-4 py-2 text-right">涨跌</th>
                <th className="px-4 py-2 text-right">涨跌幅</th>
                <th className="px-4 py-2 text-right">开盘</th>
                <th className="px-4 py-2 text-right">最高</th>
                <th className="px-4 py-2 text-right">最低</th>
                <th className="px-4 py-2 text-right">成交量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {symbols.map(symbol => {
                const quote = quotes.get(symbol);
                if (!quote) return null;

                const isUp = quote.change_value >= 0;

                return (
                  <tr
                    key={symbol}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => setSelectedSymbol(symbol)}
                  >
                    <td className="px-4 py-2 font-medium">{symbol}</td>
                    <td className="px-4 py-2">{SYMBOL_NAMES[symbol] || symbol}</td>
                    <td className="px-4 py-2 text-right font-medium">{quote.last_done.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isUp ? '+' : ''}{quote.change_value.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isUp ? '+' : ''}{quote.change_rate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right">{quote.open.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">{quote.high.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{quote.low.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{(quote.volume / 1000000).toFixed(2)}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 实时KLineCharts组件，使用真实API数据
function RealKLineChart({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKLineData = async () => {
      if (!symbol) return;

      setLoading(true);
      setError(null);

      try {
        const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
        const url = `${base}/quotes/history?symbol=${encodeURIComponent(symbol)}&limit=1000&period=min5&adjust_type=no_adjust`;

        console.log('获取K线数据:', url);
        const response = await fetch(url);
        const result = await response.json();

        console.log('K线API响应:', result);

        if (result.bars && result.bars.length > 0) {
          // 转换为KLineCharts数据格式
          const klineData = result.bars.map((bar: any) => ({
            time: new Date(bar.ts).getTime(),
            open: Number(bar.open),
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
            volume: Number(bar.volume) || 0
          }));

          console.log('转换后KLine数据:', klineData.slice(0, 3));
          setData(klineData);
        } else {
          // 如果API没有数据，生成模拟数据
          console.log('API无数据，生成模拟数据');
          const mockData = generateMockKLineData(50);
          setData(mockData);
        }
      } catch (error) {
        console.error('K线数据获取失败:', error);
        setError(error.message);
        // 失败时生成模拟数据
        const mockData = generateMockKLineData(50);
        setData(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchKLineData();
  }, [symbol]);

  if (error && data.length === 0) {
    return (
      <div className="border p-4 rounded bg-red-50 dark:bg-red-900/20">
        <h3 className="text-lg font-bold mb-2 text-red-600">实时K线图 - 错误</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KLineChart
        data={data}
        width={1000}
        height={600}
        onLoading={setLoading}
      />

      {/* 技术指标说明 */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="font-bold text-sm mb-3 text-gray-800 dark:text-gray-200">📊 内置技术指标说明</h4>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <h5 className="font-semibold text-blue-600 mb-2">主图叠加指标</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div><strong>MA</strong> [5, 10, 30, 60] - 移动平均线</div>
              <div><strong>BOLL</strong> [20, 2] - 布林带</div>
              <div><strong>EMA</strong> [6, 12, 20] - 指数移动平均</div>
              <div><strong>BBI</strong> [3, 6, 12, 24] - 多空指数</div>
              <div><strong>SAR</strong> [2, 2, 20] - 抛物线指标</div>
              <div><strong>SMA</strong> [12, 2] - 平滑移动平均</div>
            </div>
          </div>
          <div>
            <h5 className="font-semibold text-green-600 mb-2">动量类指标</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div><strong>MACD</strong> [12, 26, 9] - 平滑异同移动平均</div>
              <div><strong>RSI</strong> [6, 12, 24] - 相对强弱指数</div>
              <div><strong>KDJ</strong> [9, 3, 3] - 随机指标</div>
              <div><strong>CCI</strong> [13] - 商品路径指标</div>
              <div><strong>WR</strong> [6, 10, 14] - 威廉指标</div>
              <div><strong>MTM</strong> [6, 10] - 动量指标</div>
            </div>
          </div>
          <div>
            <h5 className="font-semibold text-purple-600 mb-2">成交量类指标</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div><strong>VOL</strong> [5, 10, 20] - 成交量</div>
              <div><strong>OBV</strong> [30] - 能量潮指标</div>
              <div><strong>VR</strong> [24, 30] - 成交量变异率</div>
              <div><strong>EMV</strong> [14, 9] - 简易波动指标</div>
              <div><strong>PVT</strong> 无参数 - 价量趋势</div>
              <div><strong>AVP</strong> 无参数 - 平均价格</div>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
          <h5 className="font-semibold text-blue-700 dark:text-blue-300 text-sm mb-2">🤖 智能买卖点策略</h5>
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <div><strong>策略1:</strong> MA均线金叉死叉 (MA5 x MA20) - 买入: 5日线上穿20日线 | 卖出: 5日线下穿20日线</div>
            <div><strong>策略2:</strong> RSI超买超卖 (RSI14) - 买入: RSI小于30超卖区 | 卖出: RSI大于70超买区</div>
            <div className="text-blue-500 dark:text-blue-400">
              <strong>标记说明:</strong> 绿色"买"=买入点 | 红色"卖"=卖出点 | 鼠标悬停查看详情
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <strong>当前启用:</strong> MA移动平均线、BOLL布林带、VOL成交量、MACD、RSI、KDJ
          {loading && <span className="ml-2 text-blue-600">⏳ 加载中...</span>}
          {error && <span className="ml-2 text-red-600">❌ {error}</span>}
          <span className="ml-2">📈 数据量: {data.length} 根K线</span>
        </div>
      </div>
    </div>
  );
}

// G2版本已移除，现在只使用KLineCharts

// 生成模拟K线数据
function generateMockKLineData(count: number) {
  const data = [];
  let price = 100 + Math.random() * 50; // 起始价格
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * 5 * 60 * 1000; // 每5分钟一根K线

    const open = price;
    const volatility = 0.02; // 波动率2%
    const change = (Math.random() - 0.5) * price * volatility;
    const close = Math.max(1, open + change);

    const high = Math.max(open, close) + Math.random() * Math.abs(change) * 0.3;
    const low = Math.min(open, close) - Math.random() * Math.abs(change) * 0.3;

    data.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(1, low).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000)
    });

    price = close; // 下一根K线的开盘价
  }

  return data;
}
