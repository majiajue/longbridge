import { useEffect, useState } from 'react';

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

export default function RealtimeBasicPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('700.HK');
  const [quotes, setQuotes] = useState<Map<string, RealtimeQuote>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [wsRef] = useState<{ current: WebSocket | null }>({ current: null });

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
  }, [wsRef]);

  // Calculate current quote stats
  const currentQuote = quotes.get(selectedSymbol);
  const priceChange = currentQuote ? currentQuote.change_value : 0;
  const priceChangePercent = currentQuote ? currentQuote.change_rate : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 text-white p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">实时行情监控</h2>
            <p className="text-blue-100">
              WebSocket实时推送 · 毫秒级更新
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

      {/* Symbol Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {SYMBOLS.map(symbol => {
          const quote = quotes.get(symbol.code);
          const isSelected = selectedSymbol === symbol.code;

          return (
            <div
              key={symbol.code}
              onClick={() => setSelectedSymbol(symbol.code)}
              className={`card p-6 cursor-pointer transition-all hover:shadow-lg ${
                isSelected
                  ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10'
                  : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {symbol.code}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {symbol.name}
                  </div>
                </div>
                {isSelected && (
                  <div className="text-primary-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {quote ? (
                <>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {quote.last_done.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      quote.change_value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {quote.change_value >= 0 ? '↑' : '↓'} {Math.abs(quote.change_value).toFixed(2)}
                    </span>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      quote.change_value >= 0
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {quote.change_value >= 0 ? '+' : ''}{quote.change_rate.toFixed(2)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Stock Details */}
      {currentQuote && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedSymbol} - {SYMBOLS.find(s => s.code === selectedSymbol)?.name}
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              更新时间: {new Date(currentQuote.timestamp * 1000).toLocaleTimeString()}
            </div>
          </div>

          {/* Price Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {currentQuote.last_done.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">当前价格</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isUp ? '+' : ''}{priceChange.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">涨跌额</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isUp ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">涨跌幅</div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">开盘</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {currentQuote.open.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">昨收</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {currentQuote.prev_close.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最高</div>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {currentQuote.high.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">最低</div>
              <div className="font-semibold text-red-600 dark:text-red-400">
                {currentQuote.low.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">成交量</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {(currentQuote.volume / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">成交额</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {(currentQuote.turnover / 1000000).toFixed(2)}M
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Quotes Table */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          实时行情一览
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">代码</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-right">最新价</th>
                <th className="px-4 py-3 text-right">涨跌</th>
                <th className="px-4 py-3 text-right">涨跌幅</th>
                <th className="px-4 py-3 text-right">最高</th>
                <th className="px-4 py-3 text-right">最低</th>
                <th className="px-4 py-3 text-right">成交量</th>
                <th className="px-4 py-3 text-right">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {SYMBOLS.map(symbol => {
                const quote = quotes.get(symbol.code);
                if (!quote) {
                  return (
                    <tr key={symbol.code}>
                      <td className="px-4 py-3" colSpan={9}>
                        <div className="animate-pulse flex items-center gap-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const isUp = quote.change_value >= 0;
                const updateTime = new Date(quote.timestamp * 1000).toLocaleTimeString();

                return (
                  <tr key={symbol.code} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 font-medium">{symbol.code}</td>
                    <td className="px-4 py-3">{symbol.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{quote.last_done.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isUp ? '+' : ''}{quote.change_value.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isUp ? '+' : ''}{quote.change_rate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{quote.high.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{quote.low.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{(quote.volume / 1000000).toFixed(2)}M</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{updateTime}</td>
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