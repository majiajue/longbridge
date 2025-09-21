import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatusSnackbar from "../components/StatusSnackbar";
import {
  TickItem,
  PortfolioOverviewResponse,
  PortfolioPosition,
  fetchStreamStatus,
  fetchTicks,
  fetchPortfolioOverview,
  resolveWsUrl,
} from "../api/client";

type QuoteEvent = {
  type: string;
  symbol: string;
  sequence: number | null;
  last_done: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  timestamp: string | null;
  volume: number | null;
  turnover: number | null;
  current_volume: number | null;
  current_turnover: number | null;
  trade_status: number | null;
  trade_session: number | null;
  tag: number | null;
};

type PortfolioUpdateEvent = {
  type: string;
  timestamp: string;
  positions: PortfolioPosition[];
  totals: Totals;
  account_balance: { [key: string]: any };
};

type Totals = PortfolioOverviewResponse["totals"] & {
  day_pnl?: number;
  day_pnl_percent?: number;
};

function formatNumber(value: number | null | undefined, fraction = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}

function formatCurrency(value: number | null | undefined) {
  return formatNumber(value, 2);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function computeTotals(positions: PortfolioPosition[]): Totals {
  const totals = positions.reduce(
    (acc, pos) => {
      acc.cost += pos.cost_value;
      acc.market_value += pos.market_value;
      acc.pnl += pos.pnl;
      acc.day_pnl += (pos as any).day_pnl || 0;
      return acc;
    },
    { cost: 0, market_value: 0, pnl: 0, pnl_percent: 0, day_pnl: 0, day_pnl_percent: 0 }
  );
  totals.pnl_percent = totals.cost ? (totals.pnl / totals.cost) * 100 : 0;
  totals.day_pnl_percent = totals.cost ? (totals.day_pnl / totals.cost) * 100 : 0;
  return totals;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
  isRefreshing = false,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "gray";
  isRefreshing?: boolean;
}) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600 text-blue-600 bg-blue-50 border-blue-200",
    green: "from-green-500 to-green-600 text-green-600 bg-green-50 border-green-200",
    red: "from-red-500 to-red-600 text-red-600 bg-red-50 border-red-200",
    yellow: "from-yellow-500 to-yellow-600 text-yellow-600 bg-yellow-50 border-yellow-200",
    purple: "from-purple-500 to-purple-600 text-purple-600 bg-purple-50 border-purple-200",
    gray: "from-gray-500 to-gray-600 text-gray-600 bg-gray-50 border-gray-200",
  };

  return (
    <div
      className={`
        card p-4 h-full flex items-center gap-4 relative overflow-hidden
        transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl
        ${isRefreshing ? "scale-[0.98] opacity-80" : "scale-100 opacity-100"}
      `}
    >
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600 animate-pulse" />
      )}
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClasses[color].split(" ")[0]} ${colorClasses[color].split(" ")[1]} flex items-center justify-center text-white text-2xl shadow-lg ${isRefreshing ? "animate-spin" : ""}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
          {title}
        </p>
        <p className={`text-2xl font-bold text-gray-900 dark:text-white mt-1 transition-opacity duration-300 ${isRefreshing ? "opacity-50" : "opacity-100"}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default function RealtimePage() {
  const [socketStatus, setSocketStatus] = useState("DISCONNECTED");
  const [eventLog, setEventLog] = useState<QuoteEvent[]>([]);
  const [logLimit] = useState(50);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [tickData, setTickData] = useState<TickItem[]>([]);
  const [tickLoading, setTickLoading] = useState(false);
  const [statusSubscribed, setStatusSubscribed] = useState<string[]>([]);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [portfolioTotals, setPortfolioTotals] = useState<Totals>({
    cost: 0,
    market_value: 0,
    pnl: 0,
    pnl_percent: 0,
    day_pnl: 0,
    day_pnl_percent: 0,
  });
  const [accountBalance, setAccountBalance] = useState<{ [key: string]: any }>({});
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "info" | "warning" | "error";
  }>({ open: false, message: "", severity: "info" });
  const wsRef = useRef<WebSocket | null>(null);

  const socketUrl = useMemo(() => resolveWsUrl("/ws/quotes"), []);

  const refreshPortfolio = useCallback(async () => {
    setIsRefreshing(true);
    setPortfolioLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const res = await fetchPortfolioOverview();
      setPortfolioPositions(res.positions);
      const totals = res.totals as Totals;
      setPortfolioTotals({
        ...totals,
        day_pnl: totals.day_pnl || 0,
        day_pnl_percent: totals.day_pnl_percent || 0,
      });
      if ((res as any).account_balance) {
        setAccountBalance((res as any).account_balance);
      }
      if (!symbolQuery && res.positions.length) {
        setSymbolQuery(res.positions[0].symbol);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "加载持仓失败",
        severity: "error",
      });
    } finally {
      setTimeout(() => {
        setPortfolioLoading(false);
        setIsRefreshing(false);
      }, 500);
    }
  }, [symbolQuery]);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        const status = await fetchStreamStatus();
        if (!mounted) return;
        setStatusSubscribed(status.subscribed);
      } catch (error) {
        setSnackbar({
          open: true,
          message: error instanceof Error ? error.message : "读取状态失败",
          severity: "error",
        });
      }
      await refreshPortfolio();
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [refreshPortfolio]);

  useEffect(() => {
    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;
    setSocketStatus("CONNECTING");

    ws.onopen = () => {
      setSocketStatus("CONNECTED");
    };

    ws.onclose = () => {
      setSocketStatus("DISCONNECTED");
    };

    ws.onerror = () => {
      setSocketStatus("ERROR");
      setSnackbar({
        open: true,
        message: "WebSocket 连接异常",
        severity: "error",
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "portfolio_update") {
          const update = data as PortfolioUpdateEvent;
          setPortfolioPositions(update.positions);
          setPortfolioTotals({
            ...update.totals,
            day_pnl: update.totals.day_pnl || 0,
            day_pnl_percent: update.totals.day_pnl_percent || 0,
          });
          setAccountBalance(update.account_balance || {});
          return;
        }
        if (data.type === "status") {
          if (Array.isArray(data.subscribed)) {
            setStatusSubscribed(data.subscribed);
          }
          return;
        }
        setEventLog((prev) => [data, ...prev].slice(0, logLimit));
        setPortfolioPositions((prev) => {
          if (!prev.length) return prev;
          const idx = prev.findIndex((item) => item.symbol === data.symbol);
          if (idx === -1) return prev;
          const lastPrice = data.last_done ?? prev[idx].last_price ?? null;
          if (lastPrice === null) return prev;
          const updated = [...prev];
          const current = { ...updated[idx] };
          current.last_price = lastPrice;
          current.last_price_time = data.timestamp ?? current.last_price_time;
          const qty = current.qty ?? 0;
          const entry = current.avg_price ?? 0;
          const direction = current.direction === "short" ? -1 : 1;
          current.market_value = lastPrice * qty;
          current.pnl = (lastPrice - entry) * qty * direction;
          current.pnl_percent = entry
            ? ((lastPrice - entry) / entry) * 100 * direction
            : 0;
          updated[idx] = current;
          setPortfolioTotals((prevTotals) => {
            const t = computeTotals(updated);
            return {
              ...t,
              day_pnl: prevTotals.day_pnl ?? 0,
              day_pnl_percent: prevTotals.day_pnl_percent ?? 0,
            };
          });
          return updated;
        });
      } catch (error) {
        console.error("Unable to parse quote payload", error);
      }
    };

    return () => {
      ws.close();
    };
  }, [logLimit, socketUrl]);

  const handleFetchTicks = async () => {
    if (!symbolQuery.trim()) {
      setSnackbar({ open: true, message: "请输入股票代码", severity: "warning" });
      return;
    }
    setTickLoading(true);
    try {
      const res = await fetchTicks(symbolQuery.trim(), 200);
      setTickData(res.ticks);
      setSnackbar({
        open: true,
        message: `拉取 ${res.ticks.length} 条 tick 数据`,
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "获取 tick 失败",
        severity: "error",
      });
    } finally {
      setTickLoading(false);
    }
  };

  const usdBalance =
    accountBalance['USD'] ??
    (Object.entries(accountBalance).find(
      ([k, v]: [string, any]) => k?.toUpperCase?.() === 'USD' || (v && v.currency === 'USD')
    )?.[1] as any) ??
    null;

  const totalCash: number = (usdBalance?.available_cash ?? 0) as number;
  const totalFinanceUsed: number = (usdBalance?.finance_used ?? usdBalance?.debit ?? 0) as number;
  const frozenCash: number = (usdBalance?.frozen_cash ?? 0) as number;
  const displayTotalAssets: number = (totalCash + portfolioTotals.market_value) as number;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <div className="card bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-700 dark:to-primary-900 text-white p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">投资组合概览</h2>
            <p className="text-primary-100">
              实时监控 · 自动更新 · {statusSubscribed.length} 只股票订阅
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${socketStatus === "CONNECTED" ? "bg-green-500" : socketStatus === "ERROR" ? "bg-red-500" : "bg-gray-500"}
              text-white shadow-lg
            `}>
              {socketStatus}
            </span>
            <button
              onClick={refreshPortfolio}
              disabled={portfolioLoading}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
            >
              {portfolioLoading ? "刷新中..." : "🔄 刷新"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="总资产"
          value={`$${formatCurrency(displayTotalAssets)}`}
          subtitle="现金+持仓"
          icon="💼"
          color="blue"
          isRefreshing={isRefreshing}
        />
        <KpiCard
          title="现金"
          value={`$${formatCurrency(totalCash)}`}
          subtitle="可用资金"
          icon="💵"
          color="purple"
          isRefreshing={isRefreshing}
        />
        <KpiCard
          title="持仓市值"
          value={`$${formatCurrency(portfolioTotals.market_value)}`}
          subtitle={`成本: $${formatCurrency(portfolioTotals.cost)}`}
          icon="📈"
          color="green"
          isRefreshing={isRefreshing}
        />
        <KpiCard
          title="总盈亏"
          value={`$${formatCurrency(portfolioTotals.pnl)}`}
          subtitle={formatPercent(portfolioTotals.pnl_percent)}
          icon="💰"
          color={portfolioTotals.pnl >= 0 ? "green" : "red"}
          isRefreshing={isRefreshing}
        />
        <KpiCard
          title="当日盈亏"
          value={`$${formatCurrency(portfolioTotals.day_pnl || 0)}`}
          subtitle={formatPercent(portfolioTotals.day_pnl_percent || 0)}
          icon="📊"
          color={(portfolioTotals.day_pnl || 0) >= 0 ? "green" : "red"}
          isRefreshing={isRefreshing}
        />
        <KpiCard
          title="融资欠款"
          value={`$${formatCurrency(totalFinanceUsed)}`}
          subtitle="已用额度"
          icon="💳"
          color="yellow"
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Account Balance Details */}
      {usdBalance && Object.keys(usdBalance).length > 0 && (
        <div className="card p-6 animate-slide-up">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            账户资金明细 (USD)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">可用现金</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                ${formatCurrency(totalCash)}
              </p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">融资欠款</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                ${formatCurrency(totalFinanceUsed || usdBalance?.debit || 0)}
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">持仓市值</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                ${formatCurrency(portfolioTotals.market_value)}
              </p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">冻结资金</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                ${formatCurrency(frozenCash)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Positions */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">持仓明细</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            数据每5秒自动刷新
          </p>
        </div>

        <div className={`relative min-h-[400px] transition-all duration-500 ${isRefreshing ? "scale-[0.99] opacity-60" : "scale-100 opacity-100"}`}>
          {portfolioPositions.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">当前账户暂无股票持仓</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">代码</th>
                    <th className="px-4 py-3 text-left">名称</th>
                    <th className="px-4 py-3 text-center">方向</th>
                    <th className="px-4 py-3 text-right">持仓</th>
                    <th className="px-4 py-3 text-right">成本价</th>
                    <th className="px-4 py-3 text-right">现价</th>
                    <th className="px-4 py-3 text-right">市值</th>
                    <th className="px-4 py-3 text-right">盈亏</th>
                    <th className="px-4 py-3 text-right">盈亏%</th>
                    <th className="px-4 py-3 text-right">当日盈亏</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {portfolioPositions.map((position, index) => {
                    const pnlPositive = position.pnl >= 0;
                    const dayPnl = (position as any).day_pnl || 0;
                    const dayPnlPercent = (position as any).day_pnl_percent || 0;
                    const dayPnlPositive = dayPnl >= 0;

                    return (
                      <tr
                        key={position.symbol}
                        className={`
                          hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300
                          ${isRefreshing ? `animate-pulse delay-${index * 50}` : ""}
                        `}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {position.symbol}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {position.symbol_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`
                            px-2 py-1 text-xs font-medium rounded-full
                            ${position.direction === "short"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"}
                          `}>
                            {position.direction === "short" ? "空" : "多"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                          {formatNumber(position.qty, 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                          ${formatCurrency(position.avg_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          ${formatCurrency(position.last_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          ${formatCurrency(position.market_value)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${pnlPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          ${formatCurrency(position.pnl)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${pnlPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatPercent(position.pnl_percent)}
                        </td>
                        <td className={`px-4 py-3 text-right ${dayPnlPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          <div className="font-medium">${formatCurrency(dayPnl)}</div>
                          <div className="text-xs">{formatPercent(dayPnlPercent)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {portfolioLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          )}
        </div>
      </div>

      {/* WebSocket Event Log */}
      <div className="card p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          实时数据流（最近 {logLimit} 条）
        </h3>
        <div className="bg-gray-900 dark:bg-black text-gray-300 rounded-lg p-4 max-h-80 overflow-y-auto font-mono text-xs">
          {eventLog.length === 0 ? (
            <p className="text-gray-500">等待实时数据推送...</p>
          ) : (
            eventLog.map((evt, idx) => (
              <div key={`${evt.symbol}-${evt.sequence ?? idx}`} className="mb-1 hover:bg-gray-800 p-1 rounded">
                <span className="text-blue-400">[{new Date().toLocaleTimeString()}]</span> {JSON.stringify(evt)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tick Data Query */}
      <div className="card p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          历史 Tick 数据查询
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="如：700.HK 或 AAPL.US"
            value={symbolQuery}
            onChange={(e) => setSymbolQuery(e.target.value.toUpperCase())}
          />
          <button
            className="btn-primary"
            onClick={handleFetchTicks}
            disabled={tickLoading}
          >
            {tickLoading ? "查询中..." : "🔍 查询"}
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
          {tickLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : tickData.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              暂无数据，请输入股票代码并查询
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left">时间</th>
                    <th className="px-4 py-2 text-right">价格</th>
                    <th className="px-4 py-2 text-right">成交量</th>
                    <th className="px-4 py-2 text-right">序号</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {tickData.map((tick, idx) => (
                    <tr key={`${tick.ts}-${idx}`} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                      <td className="px-4 py-2">{new Date(tick.ts).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${tick.price ?? "-"}</td>
                      <td className="px-4 py-2 text-right">{tick.volume ?? "-"}</td>
                      <td className="px-4 py-2 text-right">{tick.sequence ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <StatusSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}