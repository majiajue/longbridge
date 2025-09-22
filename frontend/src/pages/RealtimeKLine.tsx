import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, Time, ISeriesApi } from 'lightweight-charts';
import { resolveWsUrl } from '../api/client';

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

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
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

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        textColor: isDark ? '#d1d5db' : '#374151',
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
        horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
      },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    // Handle theme change
    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark');
      chart.applyOptions({
        layout: {
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          textColor: isDark ? '#d1d5db' : '#374151',
        },
        grid: {
          vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
          horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
        },
      });
    };

    window.addEventListener('resize', handleResize);
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      chart.remove();
    };
  }, []);

  // Load historical data
  const loadHistoricalData = useCallback(async () => {
    if (!selectedSymbol) return;

    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const params = new URLSearchParams({
        symbol: selectedSymbol,
        limit: '200',
        period: 'day',
        adjust_type: 'forward_adjust'
      });

      const response = await fetch(`${base}/quotes/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        let bars = data.bars || [];

        // Auto sync 1000 bars if empty, then refetch with larger limit
        if (!bars.length) {
          try {
            await fetch(`${base}/quotes/history/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: [selectedSymbol], period: 'day', adjust_type: 'forward_adjust', count: 1000 })
            });
            const refetch = await fetch(`${base}/quotes/history?${new URLSearchParams({ symbol: selectedSymbol, limit: '1000', period: 'day', adjust_type: 'forward_adjust' }).toString()}`);
            if (refetch.ok) {
              const refetched = await refetch.json();
              bars = refetched.bars || [];
            }
          } catch (e) {
            console.error('Sync history failed:', e);
          }
        }

        setHistoricalData(bars);

        // Update chart with historical data
        if (bars && bars.length > 0 && candlestickSeriesRef.current && volumeSeriesRef.current) {
          const raw = bars as any[];
          const filtered = raw.filter((bar) =>
            [bar.open, bar.high, bar.low, bar.close].every((v: any) => typeof v === 'number' && Number.isFinite(v))
          );

          const toUnix = (s: any): Time => {
            try {
              if (typeof s === 'number') return (Math.floor(s / 1000) as Time);
              const d = new Date(String(s));
              if (!Number.isNaN(d.getTime())) return (Math.floor(d.getTime() / 1000) as Time);
            } catch {}
            return (Math.floor(Date.now() / 1000) as Time);
          };

          const candlestickData = filtered.map((bar: any) => ({
            time: toUnix(bar.time || bar.ts),
            open: bar.open as number,
            high: bar.high as number,
            low: bar.low as number,
            close: bar.close as number,
          }));

          const volumeData = filtered.map((bar: any) => ({
            time: toUnix(bar.time || bar.ts),
            value: (typeof bar.volume === 'number' && Number.isFinite(bar.volume)) ? bar.volume : 0,
            color: (bar.close as number) >= (bar.open as number) ? '#10b981' : '#ef4444',
          }));

          // Sort ascending by time (DuckDB query returns DESC)
          candlestickData.sort((a, b) => Number(a.time as number) - Number(b.time as number));
          volumeData.sort((a, b) => Number(a.time as number) - Number(b.time as number));

          // Sort by time
          candlestickData.sort((a, b) => (a.time as string).localeCompare(b.time as string));
          volumeData.sort((a, b) => (a.time as string).localeCompare(b.time as string));

          candlestickSeriesRef.current.setData(candlestickData);
          volumeSeriesRef.current.setData(volumeData);

          // Store last bar for real-time updates
          lastBarRef.current = candlestickData[candlestickData.length - 1];

          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        }
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

  // Render historicalData after chart is ready (covers effect ordering/race)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (!historicalData || historicalData.length === 0) return;

    const toUnix = (s: any): Time => {
      try {
        if (typeof s === 'number') return (Math.floor(s / 1000) as Time);
        const d = new Date(String(s));
        if (!Number.isNaN(d.getTime())) return (Math.floor(d.getTime() / 1000) as Time);
      } catch {}
      return (Math.floor(Date.now() / 1000) as Time);
    };

    const filtered = (historicalData as any[]).filter((bar) =>
      [bar.open, bar.high, bar.low, bar.close].every((v: any) => typeof v === 'number' && Number.isFinite(v))
    );
    const candlestickData = filtered.map((bar: any) => ({
      time: toUnix((bar as any).time || (bar as any).ts),
      open: bar.open as number,
      high: bar.high as number,
      low: bar.low as number,
      close: bar.close as number,
    }));
    const volumeData = filtered.map((bar: any) => ({
      time: toUnix((bar as any).time || (bar as any).ts),
      value: (typeof bar.volume === 'number' && Number.isFinite(bar.volume)) ? bar.volume : 0,
      color: (bar.close as number) >= (bar.open as number) ? '#10b981' : '#ef4444',
    }));
    candlestickData.sort((a, b) => Number(a.time as number) - Number(b.time as number));
    volumeData.sort((a, b) => Number(a.time as number) - Number(b.time as number));

    candlestickSeriesRef.current.setData(candlestickData);
    volumeSeriesRef.current.setData(volumeData);
    lastBarRef.current = candlestickData[candlestickData.length - 1] || null;
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [historicalData]);

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

            // Update real-time chart for selected symbol
            const sameSymbol = normalizeSymbolHK(data.symbol) === normalizeSymbolHK(selectedSymbol);
            if (sameSymbol && candlestickSeriesRef.current) {
              const currentDate = new Date().toISOString().split('T')[0];

              // Update or create today's bar
              if (lastBarRef.current) {
                const updatedBar = {
                  time: currentDate as Time,
                  open: lastBarRef.current.open || data.open,
                  high: Math.max(lastBarRef.current.high || data.high, data.last_done),
                  low: Math.min(lastBarRef.current.low || data.low, data.last_done),
                  close: data.last_done,
                };
                candlestickSeriesRef.current.update(updatedBar);
                lastBarRef.current = updatedBar;
              } else {
                const newBar = {
                  time: currentDate as Time,
                  open: data.open ?? data.last_done,
                  high: data.high ?? data.last_done,
                  low: data.low ?? data.last_done,
                  close: data.last_done,
                };
                candlestickSeriesRef.current.update(newBar);
                lastBarRef.current = newBar;
              }

              // Update volume
              if (volumeSeriesRef.current && data.volume) {
                volumeSeriesRef.current.update({
                  time: currentDate as Time,
                  value: data.volume,
                  color: data.last_done >= (lastBarRef.current?.open ?? data.open ?? data.last_done) ? '#10b981' : '#ef4444',
                });
              }
            }
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
        <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" style={{ height: '400px' }} />
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