import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, Time } from 'lightweight-charts';

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

const SYMBOLS = [
  { code: '700.HK', name: '腾讯控股' },
  { code: '0005.HK', name: '汇丰控股' },
  { code: 'AAPL.US', name: '苹果公司' },
  { code: 'TSLA.US', name: '特斯拉' },
  { code: 'NVDA.US', name: '英伟达' },
];

export default function RealtimeSimplePage() {
  const [selectedSymbol, setSelectedSymbol] = useState('700.HK');
  const [quotes, setQuotes] = useState<Map<string, RealtimeQuote>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [priceHistory, setPriceHistory] = useState<Map<string, Array<{time: Time, value: number}>>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<any>(null);

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
        secondsVisible: true,
      },
    });

    const lineSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    lineSeriesRef.current = lineSeries;

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

  // Update chart when symbol changes or new data arrives
  useEffect(() => {
    if (lineSeriesRef.current) {
      const data = priceHistory.get(selectedSymbol) || [];
      lineSeriesRef.current.setData(data);
      if (chartRef.current && data.length > 0) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [selectedSymbol, priceHistory]);

  // WebSocket connection for real-time data
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:8000/ws/quotes`;

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

            // Add to price history
            setPriceHistory(prev => {
              const newHistory = new Map(prev);
              const symbolHistory = newHistory.get(data.symbol) || [];

              const newPoint = {
                time: Math.floor(Date.now() / 1000) as Time,
                value: data.last_done
              };

              // Keep only last 100 points
              const updatedHistory = [...symbolHistory, newPoint].slice(-100);
              newHistory.set(data.symbol, updatedHistory);
              return newHistory;
            });
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
  }, []);

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
            <h2 className="text-3xl font-bold mb-2">实时行情盯盘</h2>
            <p className="text-indigo-100">
              实时价格推送 · 动态趋势图表
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
            实时价格走势
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            最近100个数据点
          </div>
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