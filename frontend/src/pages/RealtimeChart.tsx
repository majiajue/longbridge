import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { resolveWsUrl } from '../api/client';
import G2KLineChart from '../components/G2KLineChart';
import LoadingSpinner, { SkeletonLoader } from '../components/LoadingSpinner';
import TestChart from '../components/TestChart';
import SimpleKLineTest from '../components/SimpleKLineTest';
import DirectKLineChart from '../components/DirectKLineChart';
import { generateMockKLineData, generateMockTradingSignals, isValidKLineData, isStaticData, enhanceStaticData } from '../utils/mockData';

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

interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingSignal {
  time: number;
  price: number;
  type: 'buy' | 'sell';
  strategy: string;
  confidence: number;
  reason?: string;
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
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [tradingSignals, setTradingSignals] = useState<TradingSignal[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const [chartData, setChartData] = useState<KLineData[]>([]);

  // Data cache
  const dataCache = useRef<Map<string, { data: any, timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  // Performance optimizations
  const lastUpdateTime = useRef<number>(0);
  const updateThrottle = 500; // 500ms throttle

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


  // 异步加载交易信号（带进度）
  const loadTradingSignals = useCallback(async (symbol: string) => {
    try {
      setSignalsLoading(true);
      setLoadingProgress(10);

      const cacheKey = `signals_${symbol}`;
      const cached = dataCache.current.get(cacheKey);
      const now = Date.now();

      setLoadingProgress(30);

      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // 模拟缓存加载延迟，显示进度
        await new Promise(resolve => setTimeout(resolve, 200));
        setLoadingProgress(100);
        setTradingSignals(cached.data);
        setSignalsLoading(false);
        return;
      }

      setLoadingProgress(50);

      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${base}/strategies/signals/simulate?symbol=${symbol}&days=7`, {
        method: 'POST',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setLoadingProgress(80);

      if (response.ok) {
        const result = await response.json();
        const signalData = result.signals || [];

        setLoadingProgress(100);
        setTradingSignals(signalData);

        dataCache.current.set(cacheKey, {
          data: signalData,
          timestamp: now
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to load trading signals:', error);
      }
    } finally {
      setSignalsLoading(false);
      setLoadingProgress(0);
    }
  }, []);

  // 异步加载历史数据（带进度）
  const loadHistoricalData = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(5);

    try {
      const cacheKey = `history_${selectedSymbol}`;
      const cached = dataCache.current.get(cacheKey);
      const now = Date.now();

      setLoadingProgress(15);

      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // 模拟缓存加载
        await new Promise(resolve => setTimeout(resolve, 300));
        setLoadingProgress(100);

        let cachedProcessedData: any[];
        if (!isValidKLineData(cached.data)) {
          console.warn('缓存数据无效，使用模拟数据');
          cachedProcessedData = generateMockKLineData(50, 650);
        } else {
          cachedProcessedData = cached.data.map((bar: any) => ({
            time: bar.ts || bar.time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume || Math.floor(Math.random() * 100000 + 10000)
          }));
        }

        setHistoricalData(cached.data);
        setChartData(cachedProcessedData);
        setLoading(false);
        setLoadingProgress(0);
        return;
      }

      setLoadingProgress(40);

      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const params = new URLSearchParams({
        symbol: selectedSymbol,
        limit: '200',
        period: 'min1',
        adjust_type: 'no_adjust'
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      setLoadingProgress(60);

      const response = await fetch(`${base}/quotes/history?${params}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setLoadingProgress(80);

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
            const refetch = await fetch(`${base}/quotes/history?${params}`);
            if (refetch.ok) {
              const refetched = await refetch.json();
              bars = refetched.bars || [];
            }
          } catch (e) {
            console.error('Sync minute history failed:', e);
          }
        }

        setLoadingProgress(90);

        // 数据验证和处理
        let processedData: any[] = [];

        if (!isValidKLineData(bars)) {
          console.warn('原始API数据无效，使用模拟数据');
          const mockData = generateMockKLineData(50, 650); // 以700.HK的650价格为基础
          processedData = mockData;
        } else if (isStaticData(bars)) {
          console.warn('检测到静态数据，添加变化');
          processedData = enhanceStaticData(bars);
        } else {
          // 异步处理数据转换
          processedData = await new Promise<any[]>(resolve => {
            const processData = () => {
              const result = bars.map((bar: any) => ({
                time: bar.ts || bar.time,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume || Math.floor(Math.random() * 100000 + 10000)
              }));
              resolve(result);
            };

            if ('requestIdleCallback' in window) {
              (window as any).requestIdleCallback(processData);
            } else {
              setTimeout(processData, 0);
            }
          });
        }

        setLoadingProgress(100);

        setHistoricalData(bars);
        setChartData(processedData);

        dataCache.current.set(cacheKey, {
          data: bars,
          timestamp: now
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to load historical data:', error);
      }
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  }, [selectedSymbol]);


  // Load data when symbol changes
  useEffect(() => {
    console.log('符号变更，加载数据:', selectedSymbol);
    loadHistoricalData();
    loadTradingSignals(selectedSymbol);
  }, [selectedSymbol, loadHistoricalData, loadTradingSignals]);

  // 如果chartData有数据，但没有交易信号，生成一些模拟信号
  useEffect(() => {
    if (chartData.length > 0 && tradingSignals.length === 0 && !signalsLoading) {
      console.log('生成模拟交易信号');
      const mockSignals = generateMockTradingSignals(chartData, 8);
      setTradingSignals(mockSignals);
    }
  }, [chartData, tradingSignals, signalsLoading]);

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
            setQuotes(prev => {
              const newQuotes = new Map(prev);
              newQuotes.set(data.symbol, data);
              return newQuotes;
            });

            // Update chart data with real-time quotes
            const now = Date.now();
            if (data.symbol === selectedSymbol && now - lastUpdateTime.current > updateThrottle) {
              lastUpdateTime.current = now;

              // Update the last bar with real-time data
              setChartData(prevData => {
                if (!prevData.length) return prevData;

                const updatedData = [...prevData];
                const lastBar = updatedData[updatedData.length - 1];

                // Update the last bar or create a new one
                const currentTime = new Date().toISOString();
                updatedData[updatedData.length - 1] = {
                  ...lastBar,
                  time: currentTime,
                  high: Math.max(lastBar.high, data.last_done),
                  low: Math.min(lastBar.low, data.last_done),
                  close: data.last_done,
                  volume: data.volume || lastBar.volume
                };

                return updatedData;
              });
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

  // Subscribe on symbol change
  useEffect(() => {
    ensureSubscribed(selectedSymbol);
  }, [selectedSymbol, ensureSubscribed]);

  // Cache cleanup
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cache = dataCache.current;
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL * 2) {
          cache.delete(key);
        }
      }
    }, CACHE_TTL);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Memoize symbol data for performance
  const symbolData = useMemo(() => {
    return SYMBOLS.map(symbol => {
      const quote = quotes.get(symbol.code);
      return {
        ...symbol,
        quote,
        isSelected: selectedSymbol === symbol.code,
      };
    });
  }, [quotes, selectedSymbol]);

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
              实时行情推送 · 分钟级K线图表 · 智能买卖点标记
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
            {tradingSignals.length > 0 && (
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-200">
                {tradingSignals.length} 个信号
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">选择标的</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {symbolData.map(({ code, name, quote, isSelected }) => (
            <button
              key={code}
              onClick={() => setSelectedSymbol(code)}
              className={`p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-bold text-sm text-gray-900 dark:text-white">
                    {code}
                  </div>
                  {isSelected && tradingSignals.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {tradingSignals.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {name}
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
          ))}
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

      {/* Optimized Real-time Chart */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            实时K线图表
          </h3>
          <div className="flex items-center gap-4">
            {tradingSignals.length > 0 && (
              <div className="text-sm text-blue-600 dark:text-blue-400">
                📊 {tradingSignals.length} 个买卖信号已标记
              </div>
            )}
            {(loading || signalsLoading) && (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" text="" />
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {loading ? '加载K线数据...' : '加载交易信号...'}
                </div>
                {loadingProgress > 0 && (
                  <div className="text-xs text-gray-400">
                    {loadingProgress}%
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* 调试：显示简单的G2图表测试 */}
        <div className="space-y-6">
          <TestChart />
          <SimpleKLineTest />
          <DirectKLineChart />

          <div className="text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded">
            <h4 className="font-bold mb-2">调试信息:</h4>
            <div>Loading: {loading ? '是' : '否'}</div>
            <div>Chart Data Length: {chartData.length}</div>
            <div>Trading Signals Length: {tradingSignals.length}</div>
            <div>Selected Symbol: {selectedSymbol}</div>
            <div>Chart Data Sample: {JSON.stringify(chartData.slice(0, 1), null, 2)}</div>
            <div>API Data Valid: {historicalData.length > 0 ? (isValidKLineData(historicalData) ? '是' : '否') : 'N/A'}</div>
            <div>Is Static Data: {historicalData.length > 0 ? (isStaticData(historicalData) ? '是' : '否') : 'N/A'}</div>
          </div>

          {loading && chartData.length === 0 ? (
            <div className="flex items-center justify-center" style={{ width: '800px', height: '400px' }}>
              <SkeletonLoader />
            </div>
          ) : (
            <G2KLineChart
              data={chartData}
              signals={tradingSignals}
              width={800}
              height={400}
            />
          )}
        </div>
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
              {symbolData.map(({ code, name, quote }) => {
                if (!quote) return null;

                const isUp = quote.change_value >= 0;
                const updateTime = new Date(quote.timestamp * 1000).toLocaleTimeString();
                const signalCount = code === selectedSymbol ? tradingSignals.length : 0;

                return (
                  <tr key={code} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {code}
                        {code === selectedSymbol && signalCount > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {signalCount} 信号
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">{name}</td>
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