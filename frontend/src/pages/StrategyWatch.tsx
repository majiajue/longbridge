import { useEffect, useState } from "react";
import {
  Visibility,
  Refresh,
  TrendingUp,
  TrendingDown,
  Timeline,
  ShowChart,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  Tabs,
  Alert,
  ProgressBar,
  LoadingSpinner,
  EmptyState,
} from "../components/ui";
import RealTimeKLineChart from "../components/RealTimeKLineChart";

interface StrategySignal {
  symbol: string;
  current_price: number;
  is_position: boolean;
  signals: {
    buy_low_sell_high: any;
    ema_crossover: any;
  };
  consensus: {
    action: string;
    confidence: number;
    agreement: number;
    buy_count: number;
    sell_count: number;
  };
}

export default function StrategyWatchPage() {
  const [watchlistSignals, setWatchlistSignals] = useState<StrategySignal[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [positionCount, setPositionCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  const loadWatchlistSignals = async () => {
    try {
      setLoading(true);
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/strategies/advanced/watchlist/signals`);

      if (response.ok) {
        const data = await response.json();
        setWatchlistSignals(data.signals || []);
        setPositionCount(data.position_count || 0);
        setManualCount(data.manual_count || 0);
        setLastUpdate(new Date());

        if ((data.position_count > 0 || data.manual_count > 0) && data.signals.length === 0) {
          setError("检测到股票但没有K线数据，请先在「基础配置」中同步历史数据");
        } else {
          setError(null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail?.message || errorData.message || "加载信号失败");
      }
    } catch (e: any) {
      setError(e.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlistSignals();
    const interval = setInterval(loadWatchlistSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActionStyle = (action: string) => {
    if (action === "BUY") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (action === "SELL") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
  };

  const toggleExpanded = (symbol: string) => {
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  if (loading && !watchlistSignals.length) {
    return <LoadingSpinner size="lg" text="加载策略信号..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="策略盯盘"
        description="实时监控买低卖高和 EMA 策略信号"
        icon={<Visibility />}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="info">
              持仓 {positionCount} | 监控 {manualCount}
            </Badge>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : "未更新"}
            </span>
            <Button
              variant="secondary"
              onClick={loadWatchlistSignals}
              loading={loading}
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

      <Tabs
        tabs={[
          { id: "overview", label: "信号概览", icon: <ShowChart className="w-4 h-4" /> },
          { id: "kline", label: "实时K线", icon: <Timeline className="w-4 h-4" /> },
        ]}
        activeTab={tabValue}
        onChange={setTabValue}
      />

      {/* 信号概览 */}
      {tabValue === "overview" && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">股票</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">当前价</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-400">买低卖高</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-400">EMA 交叉</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-400">综合建议</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-400">置信度</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {watchlistSignals.map((item) => (
                  <tr
                    key={item.symbol}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{item.symbol}</span>
                        {item.is_position && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            持仓
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-white">
                      ${item.current_price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.signals.buy_low_sell_high ? (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${getActionStyle(item.signals.buy_low_sell_high.action)}`}>
                          {item.signals.buy_low_sell_high.action}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.signals.ema_crossover ? (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${getActionStyle(item.signals.ema_crossover.action)}`}>
                          {item.signals.ema_crossover.action}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium ${getActionStyle(item.consensus.action)}`}>
                        {item.consensus.action === "BUY" && <TrendingUp className="w-3 h-3" />}
                        {item.consensus.action === "SELL" && <TrendingDown className="w-3 h-3" />}
                        {item.consensus.action || "HOLD"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16">
                          <ProgressBar
                            value={item.consensus.confidence * 100}
                            variant={
                              item.consensus.confidence >= 0.7 ? "success" : item.consensus.confidence >= 0.5 ? "warning" : "danger"
                            }
                          />
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400 w-10">
                          {(item.consensus.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSymbol(item.symbol);
                          setTabValue("kline");
                          setExpandedSymbols(new Set([item.symbol]));
                        }}
                      >
                        查看K线
                      </Button>
                    </td>
                  </tr>
                ))}
                {watchlistSignals.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      当前没有信号，请在「基础配置」中配置监控股票
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 实时 K 线 */}
      {tabValue === "kline" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {watchlistSignals.length === 0 && !loading ? (
            <div className="lg:col-span-2">
              <EmptyState
                title="暂无监控股票"
                description="请先在「基础配置」中添加监控股票"
                icon={<Timeline />}
              />
            </div>
          ) : (
            watchlistSignals.map((item) => {
              const isExpanded = expandedSymbols.has(item.symbol) || selectedSymbol === item.symbol;
              return (
                <Card key={item.symbol} padding="none" className="overflow-hidden">
                  <button
                    onClick={() => toggleExpanded(item.symbol)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-900 dark:text-white">{item.symbol}</span>
                      <span className="text-slate-500">${item.current_price.toFixed(2)}</span>
                      {item.consensus.action && item.consensus.action !== "HOLD" && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getActionStyle(item.consensus.action)}`}>
                          {item.consensus.action}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ExpandLess className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ExpandMore className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-700">
                      <div className="p-4">
                        <RealTimeKLineChart symbol={item.symbol} height={250} showVolume={true} maxDataPoints={50} />
                      </div>

                      {/* 信号详情 */}
                      <div className="px-4 pb-4 space-y-2">
                        {item.signals.buy_low_sell_high && (
                          <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                            <div className="flex items-center gap-2 text-sm">
                              <ShowChart className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                              <span className="font-medium text-cyan-800 dark:text-cyan-200">买低卖高：</span>
                              <span className="text-cyan-700 dark:text-cyan-300">{item.signals.buy_low_sell_high.reason}</span>
                            </div>
                          </div>
                        )}
                        {item.signals.ema_crossover && (
                          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 text-sm">
                              <Timeline className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="font-medium text-purple-800 dark:text-purple-200">EMA 交叉：</span>
                              <span className="text-purple-700 dark:text-purple-300">{item.signals.ema_crossover.reason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
