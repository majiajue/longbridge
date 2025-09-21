import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
  Line,
} from "recharts";

type BarItem = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type HistoryResponse = {
  symbol: string;
  period: string;
  adjust_type: string;
  bars: BarItem[];
};

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
  { value: "min240", label: "240分钟" },
];

const ADJUST_OPTIONS = [
  { value: "no_adjust", label: "不复权" },
  { value: "forward_adjust", label: "前复权" },
  { value: "backward_adjust", label: "后复权" },
];

async function fetchHistory(params: {
  symbol: string;
  limit: number;
  period: string;
  adjust_type: string;
}): Promise<HistoryResponse> {
  const qs = new URLSearchParams({
    symbol: params.symbol,
    limit: String(params.limit),
    period: params.period,
    adjust_type: params.adjust_type,
  });
  const base = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";
  const resp = await fetch(`${base}/quotes/history?${qs.toString()}`);
  if (!resp.ok) {
    const t = await resp.text();
    console.error("get history error", t);
    throw new Error(t || "fetch history failed");
  }
  return resp.json();
}

function toDisplayTime(t: string) {
  if (!t) return "";
  if (/^\d{10,}$/.test(t)) {
    const ms = t.length > 10 ? Number(t) : Number(t) * 1000;
    return new Date(ms).toLocaleDateString();
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? t : d.toLocaleDateString();
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">开盘:</span>
            <span className="font-medium">{data.open?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">最高:</span>
            <span className="font-medium text-green-600 dark:text-green-400">{data.high?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">最低:</span>
            <span className="font-medium text-red-600 dark:text-red-400">{data.low?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">收盘:</span>
            <span className="font-medium">{data.close?.toFixed(2)}</span>
          </div>
          {data.volume && (
            <div className="flex justify-between gap-4 pt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">成交量:</span>
              <span className="font-medium">{data.volume.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function CandleShape(props: any) {
  const { x = 0, width = 6, payload, yAxis } = props;
  if (!payload || !yAxis) return null;

  const o = payload.open;
  const c = payload.close;
  const h = payload.high;
  const l = payload.low;
  const up = c >= o;

  const yScale = yAxis.scale;
  const color = up ? "#16a34a" : "#dc2626";

  const highY = yScale(h);
  const lowY = yScale(l);
  const openY = yScale(o);
  const closeY = yScale(c);

  return (
    <g>
      <line
        x1={x + width / 2}
        x2={x + width / 2}
        y1={highY}
        y2={lowY}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={x + 1}
        y={Math.min(openY, closeY)}
        width={width - 2}
        height={Math.max(1, Math.abs(closeY - openY))}
        fill={up ? "transparent" : color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
}

export default function HistoryPage() {
  const [symbol, setSymbol] = useState("AAPL.US");
  const [period, setPeriod] = useState("day");
  const [adjust, setAdjust] = useState("no_adjust");
  const [limit, setLimit] = useState(120);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BarItem[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetchHistory({ symbol, limit, period, adjust_type: adjust });
      setData(resp.bars || []);
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const syncBars = async () => {
    setLoading(true);
    setError("");
    try {
      const base = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";
      const body = {
        symbols: [symbol],
        period,
        adjust_type: adjust,
        count: limit,
      };
      const res = await fetch(`${base}/quotes/history/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("sync history error", t);
        throw new Error(t || "同步失败");
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "同步失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const chartData = useMemo(
    () =>
      (data || []).map((d, idx) => ({
        idx,
        time: toDisplayTime((d as any).ts || ""),
        open: Number(d.open ?? 0),
        high: Number(d.high ?? 0),
        low: Number(d.low ?? 0),
        close: Number(d.close ?? 0),
        volume: Number((d as any).volume ?? 0),
      })),
    [data]
  );

  const priceChange = useMemo(() => {
    if (chartData.length < 2) return { value: 0, percent: 0, positive: true };
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    const change = last.close - first.close;
    const percent = (change / first.close) * 100;
    return { value: change, percent, positive: change >= 0 };
  }, [chartData]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Stats */}
      <div className="card bg-gradient-to-br from-blue-600 to-purple-700 dark:from-blue-700 dark:to-purple-800 text-white p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">历史K线数据</h2>
            <p className="text-blue-100">
              {symbol} · {PERIOD_OPTIONS.find(p => p.value === period)?.label} · {ADJUST_OPTIONS.find(a => a.value === adjust)?.label}
            </p>
          </div>
          {chartData.length > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <p className="text-sm text-blue-100 mb-1">期间涨跌</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-2xl font-bold ${priceChange.positive ? "text-green-300" : "text-red-300"}`}>
                  {priceChange.positive ? "+" : ""}{priceChange.value.toFixed(2)}
                </span>
                <span className={`text-lg font-medium ${priceChange.positive ? "text-green-300" : "text-red-300"}`}>
                  ({priceChange.positive ? "+" : ""}{priceChange.percent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">查询参数</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">股票代码</label>
            <input
              type="text"
              className="input-field"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.trim())}
              placeholder="如 700.HK 或 AAPL.US"
            />
          </div>
          <div>
            <label className="label">周期</label>
            <select
              className="input-field"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIOD_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">复权</label>
            <select
              className="input-field"
              value={adjust}
              onChange={(e) => setAdjust(e.target.value)}
            >
              {ADJUST_OPTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">数量</label>
            <input
              type="number"
              className="input-field"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value))))}
              min={1}
              max={1000}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={syncBars}
              disabled={loading}
            >
              🔄 同步K线
            </button>
            <button
              className="btn-primary flex-1"
              onClick={load}
              disabled={loading}
            >
              {loading ? "加载中..." : "📊 加载"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            K线图表
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">上涨</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">下跌</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-96 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">暂无数据，请点击加载按钮</p>
          </div>
        ) : (
          <div className="h-96 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="time"
                  minTickGap={24}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <ReTooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="close"
                  shape={CandleShape}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#6366f1"
                  dot={false}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data Summary */}
        {chartData.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">最新价</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {chartData[chartData.length - 1]?.close.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">最高价</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {Math.max(...chartData.map(d => d.high)).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">最低价</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {Math.min(...chartData.map(d => d.low)).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">数据条数</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {chartData.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Raw Data Table */}
      {chartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            原始数据（最近20条）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">时间</th>
                  <th className="px-4 py-2 text-right">开盘</th>
                  <th className="px-4 py-2 text-right">最高</th>
                  <th className="px-4 py-2 text-right">最低</th>
                  <th className="px-4 py-2 text-right">收盘</th>
                  <th className="px-4 py-2 text-right">成交量</th>
                  <th className="px-4 py-2 text-right">涨跌</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {chartData.slice(-20).reverse().map((bar, idx) => {
                  const prevClose = idx < chartData.length - 1 ? chartData.slice(-20).reverse()[idx + 1]?.close : bar.open;
                  const change = bar.close - prevClose;
                  const changePercent = (change / prevClose) * 100;
                  const isUp = change >= 0;

                  return (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2">{bar.time}</td>
                      <td className="px-4 py-2 text-right">{bar.open.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">{bar.high.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{bar.low.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">{bar.close.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{bar.volume?.toLocaleString() || "-"}</td>
                      <td className={`px-4 py-2 text-right font-medium ${isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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