import { useEffect, useState, useRef } from "react";
import {
  CandlestickChart,
  Refresh,
  TrendingUp,
  TrendingDown,
} from "@mui/icons-material";
import { init, dispose } from "klinecharts";
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  Select,
  Alert,
  LoadingSpinner,
  EmptyState,
} from "../components/ui";

interface Position {
  symbol: string;
  symbol_name: string;
  qty: number;
  avg_price: number;
  market_value: number;
  pnl: number;
  pnl_percent: number;
}

interface CandlestickBar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const PERIOD_OPTIONS = [
  { value: "day", label: "日线" },
  { value: "week", label: "周线" },
  { value: "month", label: "月线" },
  { value: "min_1", label: "1分钟" },
  { value: "min_5", label: "5分钟" },
  { value: "min_15", label: "15分钟" },
  { value: "min_60", label: "60分钟" },
];

export default function PositionKLinesPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [candlesticks, setCandlesticks] = useState<CandlestickBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("day");

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  const loadPositions = async () => {
    try {
      setLoading(true);
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/portfolio/overview`);

      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
        if (data.positions && data.positions.length > 0 && !selectedSymbol) {
          setSelectedSymbol(data.positions[0].symbol);
        }
        setError(null);
      } else {
        setError("加载持仓失败");
      }
    } catch (e: any) {
      setError(e.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const loadCandlesticks = async (symbol: string) => {
    if (!symbol) return;

    try {
      setChartLoading(true);
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(
        `${base}/quotes/history?symbol=${symbol}&period=${period}&limit=200`
      );

      if (response.ok) {
        const data = await response.json();
        setCandlesticks(data.bars || []);
        setError(null);
      } else {
        setError(`加载 ${symbol} K线失败`);
      }
    } catch (e: any) {
      setError(e.message || "网络错误");
    } finally {
      setChartLoading(false);
    }
  };

  // 初始化图表
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = init(chartRef.current, {
      styles: {
        candle: {
          type: "candle_solid",
          bar: {
            upColor: "#10b981",
            downColor: "#ef4444",
            upBorderColor: "#10b981",
            downBorderColor: "#ef4444",
            upWickColor: "#10b981",
            downWickColor: "#ef4444",
          },
        },
        grid: {
          show: true,
          horizontal: { color: "#e2e8f0" },
          vertical: { color: "#e2e8f0" },
        },
      },
    });

    chartInstance.current = chart;

    return () => {
      if (chartInstance.current) {
        dispose(chartRef.current!);
        chartInstance.current = null;
      }
    };
  }, []);

  // 更新图表数据
  useEffect(() => {
    if (!chartInstance.current || candlesticks.length === 0) return;

    try {
      const klineData = candlesticks.map((bar) => ({
        timestamp: new Date(bar.ts).getTime(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      }));

      klineData.sort((a, b) => a.timestamp - b.timestamp);
      chartInstance.current.applyNewData(klineData);
    } catch (error) {
      console.error("Error updating chart data:", error);
    }
  }, [candlesticks]);

  useEffect(() => {
    loadPositions();
  }, []);

  useEffect(() => {
    if (selectedSymbol) {
      loadCandlesticks(selectedSymbol);
    }
  }, [selectedSymbol, period]);

  const selectedPosition = positions.find((p) => p.symbol === selectedSymbol);

  const handleRefresh = () => {
    loadPositions();
    if (selectedSymbol) {
      loadCandlesticks(selectedSymbol);
    }
  };

  if (loading && !positions.length) {
    return <LoadingSpinner size="lg" text="加载持仓..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="持仓K线图表"
        description="查看持仓股票的历史K线走势"
        icon={<CandlestickChart />}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="info">{positions.length} 只持仓</Badge>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={loading || chartLoading}
              icon={<Refresh className="w-4 h-4" />}
            >
              刷新
            </Button>
          </div>
        }
      />

      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && positions.length === 0 ? (
        <EmptyState
          title="暂无持仓"
          description="请先买入股票或检查 ACCESS_TOKEN 是否有效"
          icon={<CandlestickChart />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧：持仓列表 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader title="持仓列表" />
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {positions.map((pos) => (
                  <div
                    key={pos.symbol}
                    onClick={() => setSelectedSymbol(pos.symbol)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedSymbol === pos.symbol
                        ? "bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-500"
                        : "bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {pos.symbol}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      {pos.symbol_name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                        {pos.qty || 0} 股
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                          (pos.pnl || 0) >= 0
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {(pos.pnl || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {(pos.pnl || 0) >= 0 ? "+" : ""}
                        {(pos.pnl_percent || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 右侧：K线图 */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader
                title={
                  selectedPosition
                    ? `${selectedPosition.symbol} - ${selectedPosition.symbol_name}`
                    : "选择股票"
                }
                action={
                  <Select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    options={PERIOD_OPTIONS}
                  />
                }
              />

              {selectedPosition && (
                <div className="flex items-center gap-6 mb-4 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    持仓: <span className="font-medium text-slate-900 dark:text-white">{selectedPosition.qty} 股</span>
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    成本: <span className="font-medium text-slate-900 dark:text-white">${selectedPosition.avg_price?.toFixed(2)}</span>
                  </span>
                  <span
                    className={`font-medium ${
                      (selectedPosition.pnl || 0) >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {(selectedPosition.pnl || 0) >= 0 ? "+" : ""}$
                    {(selectedPosition.pnl || 0).toFixed(2)} (
                    {(selectedPosition.pnl || 0) >= 0 ? "+" : ""}
                    {(selectedPosition.pnl_percent || 0).toFixed(2)}%)
                  </span>
                </div>
              )}

              {chartLoading ? (
                <LoadingSpinner text="加载K线数据..." />
              ) : candlesticks.length === 0 ? (
                <Alert type="warning">该股票暂无K线数据，请先同步历史数据</Alert>
              ) : null}

              <div
                ref={chartRef}
                className={`w-full h-[500px] ${chartLoading || candlesticks.length === 0 ? "hidden" : "block"}`}
              />

              {candlesticks.length > 0 && (
                <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  共 {candlesticks.length} 根K线 | 最早:{" "}
                  {new Date(candlesticks[candlesticks.length - 1]?.ts).toLocaleDateString()} | 最新:{" "}
                  {new Date(candlesticks[0]?.ts).toLocaleDateString()}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
