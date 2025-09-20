import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
} from "@mui/material";
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
  time: string; // ISO or epoch string from backend
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
  const base = (import.meta as any).env?.VITE_API_BASE || "";
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
  // 支持 ISO 字符串或秒/毫秒时间戳
  if (/^\d{10,}$/.test(t)) {
    const ms = t.length > 10 ? Number(t) : Number(t) * 1000;
    return new Date(ms).toLocaleString();
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? t : d.toLocaleString();
}

function CandleShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  payload?: any;
}) {
  const { x = 0, y = 0, width = 6, payload } = props;
  const o = payload.open;
  const c = payload.close;
  const h = payload.high;
  const l = payload.low;
  const up = c >= o;
  const bodyTop = up ? c : o;
  const bodyBottom = up ? o : c;
  const bodyHeight = Math.max(1, Math.abs(c - o));
  const color = up ? "#16a34a" : "#dc2626";
  // y-axis is pixel space; we rely on Recharts Bar to handle scaling; here draw a simple vertical wick and rectangle body using SVG primitives
  return (
    <g transform={`translate(${x},0)`}>
      <line
        x1={width / 2}
        x2={width / 2}
        y1={props.yScale ? props.yScale(h) : 0}
        y2={props.yScale ? props.yScale(l) : 0}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={Math.max(0, (width / 2) - 3)}
        y={props.yScale ? props.yScale(bodyTop) : y}
        width={6}
        height={Math.max(1, (props.yScale ? Math.abs(props.yScale(bodyBottom) - props.yScale(bodyTop)) : bodyHeight))}
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
      const base = (import.meta as any).env?.VITE_API_BASE || "";
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
      // 同步成功后，立即加载预览
      await load();
    } catch (e: any) {
      setError(e?.message || "同步失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初次加载一份示例
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(
    () =>
      (data || []).map((d, idx) => ({
        idx,
        // 后端字段为 ts
        time: toDisplayTime((d as any).ts || ""),
        open: Number(d.open ?? 0),
        high: Number(d.high ?? 0),
        low: Number(d.low ?? 0),
        close: Number(d.close ?? 0),
        volume: Number((d as any).volume ?? 0),
      })),
    [data]
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Grid container spacing={2} alignItems="center">
          <Grid xs={12} sm={4} md={3}>
            <TextField
              label="股票代码"
              size="small"
              fullWidth
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.trim())}
              placeholder="如 700.HK 或 AAPL.US"
            />
          </Grid>
          <Grid xs={6} sm="auto">
            <TextField
              select
              label="周期"
              size="small"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {["day","min1","min5","min15","min30","min60","min240","week","month","year"].map(p => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid xs={6} sm="auto">
            <TextField
              select
              label="复权"
              size="small"
              value={adjust}
              onChange={(e) => setAdjust(e.target.value)}
            >
              {["no_adjust","forward_adjust","backward_adjust"].map(a => (
                <MenuItem key={a} value={a}>{a}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid xs={6} sm="auto">
            <TextField
              label="数量"
              size="small"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value))))}
              inputProps={{ min: 1, max: 1000 }}
            />
          </Grid>
          <Grid xs="auto">
            <Button variant="outlined" onClick={syncBars} sx={{ mr: 1 }}>同步K线</Button>
            <Button variant="contained" onClick={load}>加载</Button>
          </Grid>
          {loading && (
            <Grid xs="auto">
              <CircularProgress size={22} />
            </Grid>
          )}
          {error && (
            <Grid xs={12}>
              <Typography color="error" variant="body2">{error}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }} elevation={1}>
        <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>
          蜡烛图（Recharts） · {symbol} · {period} · {adjust}
        </Typography>
        <Box sx={{ height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" minTickGap={24} />
              <YAxis domain={["dataMin", "dataMax"]} />
              <ReTooltip formatter={(v: any) => (typeof v === "number" ? v.toFixed(4) : v)} />
              {/* 使用细线模拟K线影线与矩形实体：为简化实现，这里用 Line 表示收盘价轨迹辅助 */}
              <Line type="monotone" dataKey="close" stroke="#64748b" dot={false} strokeWidth={1} />
              {/* 注：标准蜡烛需自定义Shape，Recharts内置没有Candlestick；此处采用两层Bar近似，足够预览 */}
              <Bar dataKey="high" fill="transparent" shape={<></>} />
              <Bar dataKey="close" fill="#999" barSize={6} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </Box>
  );
}