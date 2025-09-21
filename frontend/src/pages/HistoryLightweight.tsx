import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { getCandlesticks, syncCandlesticks } from '../api/quotes';

interface CandlestickData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const PERIOD_OPTIONS = [
  { value: "day", label: "日K" },
  { value: "week", label: "周K" },
  { value: "month", label: "月K" },
  { value: "year", label: "年K" },
  { value: "min1", label: "1分钟" },
  { value: "min5", label: "5分钟" },
  { value: "min15", label: "15分钟" },
  { value: "min30", label: "30分钟" },
  { value: "min60", label: "60分钟" },
];

const ADJUST_OPTIONS = [
  { value: "no_adjust", label: "不复权" },
  { value: "forward_adjust", label: "前复权" },
  { value: "backward_adjust", label: "后复权" },
];

export default function HistoryLightweightPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [symbol, setSymbol] = useState('700.HK');
  const [period, setPeriod] = useState('day');
  const [adjustType, setAdjustType] = useState('forward_adjust');
  const [count, setCount] = useState(365);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' }>({ text: '', type: 'info' });
  const [rawData, setRawData] = useState<CandlestickData[]>([]);
  const [priceStats, setPriceStats] = useState({ lastPrice: 0, change: 0, changePercent: 0, high: 0, low: 0 });

  // Predefined symbols for quick selection
  const symbolOptions = [
    '700.HK', '0005.HK', '9988.HK', '3690.HK', '2318.HK',
    'AAPL.US', 'GOOGL.US', 'MSFT.US', 'TSLA.US', 'NVDA.US',
    'BABA.US', 'JD.US', 'BIDU.US', 'PDD.US', 'NIO.US'
  ];

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
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

    // Handle window resize
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
          background: { color: isDark ? '#1f2937' : '#ffffff' },
          textColor: isDark ? '#d1d5db' : '#374151',
        },
        grid: {
          vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
          horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
        },
        rightPriceScale: {
          borderColor: isDark ? '#374151' : '#e5e7eb',
        },
        timeScale: {
          borderColor: isDark ? '#374151' : '#e5e7eb',
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

  // Load candlestick data
  const loadData = useCallback(async () => {
    if (!symbol) {
      setMessage({ text: '请输入股票代码', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      const data = await getCandlesticks(symbol, 500, period, adjustType);

      if (data.bars && data.bars.length > 0) {
        setRawData(data.bars);

        // Convert data format for lightweight-charts
        const candlestickData = data.bars.map((bar: CandlestickData) => ({
          time: bar.time.split('T')[0] as Time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));

        const volumeData = data.bars.map((bar: CandlestickData) => ({
          time: bar.time.split('T')[0] as Time,
          value: bar.volume,
          color: bar.close >= bar.open ? '#10b981' : '#ef4444',
        }));

        // Sort data by time
        candlestickData.sort((a, b) => (a.time as string).localeCompare(b.time as string));
        volumeData.sort((a, b) => (a.time as string).localeCompare(b.time as string));

        // Calculate price statistics
        const lastBar = data.bars[data.bars.length - 1];
        const firstBar = data.bars[0];
        const change = lastBar.close - firstBar.open;
        const changePercent = (change / firstBar.open) * 100;
        const allHighs = data.bars.map((b: CandlestickData) => b.high);
        const allLows = data.bars.map((b: CandlestickData) => b.low);

        setPriceStats({
          lastPrice: lastBar.close,
          change: change,
          changePercent: changePercent,
          high: Math.max(...allHighs),
          low: Math.min(...allLows),
        });

        if (candlestickSeriesRef.current) {
          candlestickSeriesRef.current.setData(candlestickData);
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(volumeData);
        }

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        setMessage({ text: `✅ 加载了 ${data.bars.length} 条K线数据`, type: 'success' });
      } else {
        setMessage({ text: '没有找到数据，请先同步历史数据', type: 'info' });
      }
    } catch (error) {
      console.error('Failed to load candlestick data:', error);
      setMessage({ text: `加载失败: ${error}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [symbol, period, adjustType]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []); // Only run once on mount

  // Sync historical data
  const handleSync = async () => {
    setSyncLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      const symbols = symbol ? [symbol] : undefined;
      const result = await syncCandlesticks(symbols, period, adjustType, count);

      const totalRecords = Object.values(result.processed).reduce(
        (sum, val) => sum + (val as number),
        0
      );

      setMessage({ text: `✅ 同步完成: ${totalRecords} 条记录`, type: 'success' });

      // Reload data after sync
      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
      setMessage({ text: `同步失败: ${error}`, type: 'error' });
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Stats */}
      <div className="card bg-gradient-to-br from-blue-600 to-purple-700 dark:from-blue-700 dark:to-purple-800 text-white p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">专业K线图表</h2>
            <p className="text-blue-100">
              使用 TradingView 引擎的专业金融图表
            </p>
          </div>
          {priceStats.lastPrice > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <p className="text-sm text-blue-100 mb-1">最新价格</p>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold">
                  {priceStats.lastPrice.toFixed(2)}
                </span>
                <span className={`text-lg font-medium ${priceStats.change >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {priceStats.change >= 0 ? "+" : ""}{priceStats.change.toFixed(2)}
                  ({priceStats.changePercent >= 0 ? "+" : ""}{priceStats.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">图表控制</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Symbol Input with Datalist */}
          <div>
            <label className="label">股票代码</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              list="symbol-options"
              className="input-field"
              placeholder="例: 700.HK"
            />
            <datalist id="symbol-options">
              {symbolOptions.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          {/* Period Select */}
          <div>
            <label className="label">周期</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input-field"
            >
              {PERIOD_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Adjust Type Select */}
          <div>
            <label className="label">复权</label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value)}
              className="input-field"
            >
              {ADJUST_OPTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Count Input */}
          <div>
            <label className="label">数量</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
              min="1"
              max="1000"
              className="input-field"
            />
          </div>

          {/* Load Button */}
          <div className="flex items-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? '加载中...' : '📊 加载数据'}
            </button>
          </div>

          {/* Sync Button */}
          <div className="flex items-end">
            <button
              onClick={handleSync}
              disabled={syncLoading}
              className="btn-secondary w-full"
            >
              {syncLoading ? '同步中...' : '🔄 同步历史'}
            </button>
          </div>
        </div>

        {/* Message Display */}
        {message.text && (
          <div className={`mt-4 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            图表视图
          </h3>
          {priceStats.high > 0 && (
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">最高:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {priceStats.high.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">最低:</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {priceStats.low.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" style={{ height: '500px' }} />
      </div>

      {/* Data Table - Show last 10 records */}
      {rawData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            最近数据（最新10条）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">日期</th>
                  <th className="px-4 py-2 text-right">开盘</th>
                  <th className="px-4 py-2 text-right">最高</th>
                  <th className="px-4 py-2 text-right">最低</th>
                  <th className="px-4 py-2 text-right">收盘</th>
                  <th className="px-4 py-2 text-right">成交量</th>
                  <th className="px-4 py-2 text-right">涨跌幅</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rawData.slice(-10).reverse().map((bar, idx) => {
                  const change = bar.close - bar.open;
                  const changePercent = (change / bar.open) * 100;
                  const isUp = change >= 0;

                  return (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2">{bar.time.split('T')[0]}</td>
                      <td className="px-4 py-2 text-right">{bar.open.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">
                        {bar.high.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">
                        {bar.low.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{bar.close.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{bar.volume?.toLocaleString() || "-"}</td>
                      <td className={`px-4 py-2 text-right font-medium ${
                        isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}>
                        {isUp ? "+" : ""}{changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}