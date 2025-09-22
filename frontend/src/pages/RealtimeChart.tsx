import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, CandlestickData as TVCandlestickData, ColorType } from 'lightweight-charts';
import { resolveWsUrl } from '../api/client';
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

const SYMBOLS = [
  { code: '700.HK', name: '腾讯控股' },
  { code: '0005.HK', name: '汇丰控股' },
  { code: 'AAPL.US', name: '苹果公司' },
  { code: 'TSLA.US', name: '特斯拉' },
  { code: 'NVDA.US', name: '英伟达' },
];

export default function RealtimeChartPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('700.HK');
  const [quotes, setQuotes] = useState<Map<string, RealtimeQuote>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [historicalData, setHistoricalData] = useState<CandlestickBar[]>([]);
  const [loading, setLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const realtimeBarsRef = useRef<Map<string, TVCandlestickData>>(new Map());

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
      console.warn('ensureSubscribed failed', e);
    }
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: isDark ? '#1f2937' : '#ffffff' },
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
        secondsVisible: true,
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

    // Handle resize and theme changes
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark');
      chart.applyOptions({
        layout: {
          background: { color: isDark ? '#1f2937' : '#ffffff' },
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

  // Load historical data for selected symbol
  const loadHistoricalData = useCallback(async () => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const params = new URLSearchParams({
        symbol: selectedSymbol,
        limit: '100',
        period: 'min1',
        adjust_type: 'no_adjust'
      });

      const response = await fetch(`${base}/quotes/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        let bars = data.bars || [];

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
            console.error('Sync minute history failed:', e);
          }
        }

        setHistoricalData(bars);

        // Update chart with historical data
        if (bars && bars.length > 0 && candlestickSeriesRef.current && volumeSeriesRef.current) {
          const candlestickData = bars.map((bar: CandlestickBar) => ({
            time: (Date.parse((bar as any).time || (bar as any).ts) / 1000) as Time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }));

          const volumeData = bars.map((bar: CandlestickBar) => ({
            time: (Date.parse((bar as any).time || (bar as any).ts) / 1000) as Time,
            value: bar.volume,
            color: bar.close >= bar.open ? '#10b981' : '#ef4444',
          }));

          // Sort ascending by time to display correctly
          candlestickData.sort((a, b) => Number(a.time as number) - Number(b.time as number));
          volumeData.sort((a, b) => Number(a.time as number) - Number(b.time as number));

          candlestickSeriesRef.current.setData(candlestickData);
          volumeSeriesRef.current.setData(volumeData);

          // Store the last bar for real-time updates
          const lastBar = candlestickData[candlestickData.length - 1];
          if (lastBar) {
            realtimeBarsRef.current.set(selectedSymbol, lastBar);
          }

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

  // Load historical data when symbol changes
  useEffect(() => {
    loadHistoricalData();
  }, [selectedSymbol, loadHistoricalData]);

  // WebSocket connection for real-time data
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = resolveWsUrl('/ws/quotes');

      setConnectionStatus('connecting');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'quote') {
            // Update quotes map
            setQuotes(prev => {
              const newQuotes = new Map(prev);
              newQuotes.set(data.symbol, data);
              return newQuotes;
            });

            // Update real-time chart if this is the selected symbol
            if (data.symbol === selectedSymbol && candlestickSeriesRef.current && volumeSeriesRef.current) {
              const currentTime = Math.floor(Date.now() / 1000) as Time;
              const lastBar = realtimeBarsRef.current.get(selectedSymbol);

              if (lastBar) {
                // Update the current bar
                const updatedBar: TVCandlestickData = {
                  time: currentTime,
                  open: lastBar.open,
                  high: Math.max(lastBar.high, data.last_done),
                  low: Math.min(lastBar.low, data.last_done),
                  close: data.last_done,
                };

                candlestickSeriesRef.current.update(updatedBar);
                realtimeBarsRef.current.set(selectedSymbol, updatedBar);

                // Update volume
                if (data.volume) {
                  volumeSeriesRef.current.update({
                    time: currentTime,
                    value: data.volume,
                    color: data.last_done >= lastBar.open ? '#10b981' : '#ef4444',
                  });
                }
              } else {
                const initialBar: TVCandlestickData = {
                  time: currentTime,
                  open: data.open ?? data.last_done,
                  high: data.high ?? data.last_done,
                  low: data.low ?? data.last_done,
                  close: data.last_done,
                };
                candlestickSeriesRef.current.update(initialBar);
                realtimeBarsRef.current.set(selectedSymbol, initialBar);
                if (data.volume) {
                  volumeSeriesRef.current.update({
                    time: currentTime,
                    value: data.volume,
                    color: data.last_done >= (initialBar.open ?? data.last_done) ? '#10b981' : '#ef4444',
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');

        // Reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket();
          }
        }, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedSymbol]);

  // subscribe on symbol change
  useEffect(() => {
    ensureSubscribed(selectedSymbol);
  }, [selectedSymbol, ensureSubscribed]);

  // Calculate current quote stats
  const currentQuote = quotes.get(selectedSymbol);
  const priceChange = currentQuote ? currentQuote.change_value : 0;
  const priceChangePercent = currentQuote ? currentQuote.change_rate : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-indigo-700 dark:to-purple-800 text-white p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">实时K线盯盘</h2>
            <p className="text-indigo-100">
              实时行情推送 · 分钟级K线图表
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-green-500/20 text-green-200' :
              connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-200' :
              'bg-red-500/20 text-red-200'
            }`}>
              {connectionStatus === 'connected' ? '● 已连接' :
               connectionStatus === 'connecting' ? '● 连接中...' :
               '● 未连接'}
            </div>
          </div>
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">选择标的</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SYMBOLS.map(symbol => {
            const quote = quotes.get(symbol.code);
            const isSelected = selectedSymbol === symbol.code;

            return (
              <button
                key={symbol.code}
                onClick={() => setSelectedSymbol(symbol.code)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-gray-900 dark:text-white">
                    {symbol.code}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {symbol.name}
                  </div>
                  {quote && (
                    <>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {quote.last_done.toFixed(2)}
                      </div>
                      <div className={`text-sm font-medium ${
                        quote.change_value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {quote.change_value >= 0 ? '+' : ''}{quote.change_value.toFixed(2)}
                        ({quote.change_value >= 0 ? '+' : ''}{quote.change_rate.toFixed(2)}%)
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
            {selectedSymbol} 实时行情
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最新价</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {currentQuote.last_done.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">涨跌</div>
              <div className={`text-lg font-bold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isUp ? '+' : ''}{priceChange.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">涨跌幅</div>
              <div className={`text-lg font-bold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isUp ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">开盘</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {currentQuote.open.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最高</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {currentQuote.high.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最低</div>
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {currentQuote.low.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">成交量</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {(currentQuote.volume / 1000000).toFixed(2)}M
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">成交额</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {(currentQuote.turnover / 1000000).toFixed(2)}M
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Chart */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            实时K线图表
          </h3>
          {loading && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              加载中...
            </div>
          )}
        </div>
        <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" style={{ height: '400px' }} />
      </div>

      {/* Real-time Quotes Table */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          实时行情列表
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
                <th className="px-4 py-2 text-right">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {SYMBOLS.map(symbol => {
                const quote = quotes.get(symbol.code);
                if (!quote) return null;

                const isUp = quote.change_value >= 0;
                const updateTime = new Date(quote.timestamp * 1000).toLocaleTimeString();

                return (
                  <tr key={symbol.code} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 font-medium">{symbol.code}</td>
                    <td className="px-4 py-2">{symbol.name}</td>
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
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{updateTime}</td>
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