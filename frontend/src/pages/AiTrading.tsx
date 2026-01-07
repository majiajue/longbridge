/**
 * AI 自动交易页面 - 现代化重构版
 */
import { useEffect, useState, useRef } from "react";
import {
  SmartToy,
  Refresh,
  PlayArrow,
  Stop,
  Settings,
  FlashOn,
  TrendingUp,
  TrendingDown,
  Close,
} from "@mui/icons-material";
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  Input,
  Select,
  Alert,
  Tabs,
  LoadingSpinner,
  EmptyState,
} from "../components/ui";
import SimpleKLineChart from "../components/SimpleKLineChart";
import AiAnalysisPanel from "../components/AiAnalysisPanel";
import { resolveWsUrl } from "../api/client";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface EngineStatus {
  running: boolean;
  enabled_in_config: boolean;
  symbols_monitoring: number;
  today_trades: number;
  today_pnl: number;
  current_positions: number;
  config: any;
}

interface AiTrade {
  id: number;
  symbol: string;
  action: string;
  order_quantity: number;
  filled_price: number;
  status: string;
  pnl?: number;
  pnl_percent?: number;
  order_time: string;
  ai_confidence: number;
  ai_reasoning: string;
}

interface AiPosition {
  symbol: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  open_time: string;
}

export default function AiTradingPage() {
  const [activeTab, setActiveTab] = useState("trades");
  const [mainKlineSymbol, setMainKlineSymbol] = useState("");
  const [mainKlineData, setMainKlineData] = useState<any[]>([]);
  const [mainKlineLoading, setMainKlineLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [trades, setTrades] = useState<AiTrade[]>([]);
  const [positions, setPositions] = useState<AiPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineLoading, setEngineLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [symbolsInput, setSymbolsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadMainKline = async (symbol: string, autoSync: boolean = true) => {
    if (!symbol) return;
    setMainKlineLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-trading/klines/${symbol}?period=min1&limit=200`);
      if (response.ok) {
        const data = await response.json();
        setMainKlineData(data.klines || []);
        setMainKlineSymbol(symbol);
        setLastUpdateTime(new Date());
      } else if (response.status === 404 && autoSync) {
        setMainKlineData([]);
        setMainKlineSymbol(symbol);
        const syncResponse = await fetch(`${API_BASE}/quotes/history/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: [symbol], period: "min1", count: 300 }),
        });
        if (syncResponse.ok) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await loadMainKline(symbol, false);
        }
      }
    } catch (e) {
      console.error("K线加载失败:", e);
    } finally {
      setMainKlineLoading(false);
    }
  };

  const loadEngineStatus = async (loadDefaultKline: boolean = false) => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/status`);
      if (response.ok) {
        const data = await response.json();
        setEngineStatus(data);
        if (loadDefaultKline && !mainKlineSymbol && data.config?.symbols?.length > 0) {
          await loadMainKline(data.config.symbols[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load engine status:", e);
    }
  };

  const loadTrades = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/trades?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load trades:", e);
    }
  };

  const loadPositions = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/positions`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (e) {
      console.error("Failed to load positions:", e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadEngineStatus(true), loadTrades(), loadPositions()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws/ai-trading";
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "ai_analysis") {
          setLastUpdateTime(new Date());
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    const interval = setInterval(() => {
      loadTrades();
      loadPositions();
    }, 60000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const startEngine = async () => {
    setEngineLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/start`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        await loadEngineStatus(false);
        setSuccess(data.message || "AI 交易引擎启动成功");
      } else {
        const err = await response.json();
        setError(err.detail?.message || err.detail || "启动失败");
      }
    } catch (e) {
      setError(`启动失败: ${e}`);
    } finally {
      setEngineLoading(false);
    }
  };

  const stopEngine = async () => {
    setEngineLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/stop`, { method: "POST" });
      if (response.ok) {
        await loadEngineStatus(false);
        setSuccess("AI 交易引擎已停止");
      }
    } catch (e) {
      setError(`停止失败: ${e}`);
    } finally {
      setEngineLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/trigger`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.result?.message || "分析触发成功");
      } else {
        const err = await response.json();
        setError(err.detail || "触发失败");
      }
    } catch (e) {
      setError(`触发失败: ${e}`);
    }
  };

  const openConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setSymbolsInput(Array.isArray(data.symbols) ? data.symbols.join(", ") : "");
        setShowConfig(true);
      }
    } catch (e) {
      setError("加载配置失败");
    }
  };

  const saveConfig = async () => {
    try {
      const symbols = symbolsInput
        .split(/[,，;\s\n]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      if (symbols.length === 0) {
        setError("请至少添加一只股票");
        return;
      }

      const configToSave = { ...config, symbols };
      const response = await fetch(`${API_BASE}/ai-trading/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToSave),
      });

      if (response.ok) {
        const updatedConfig = await response.json();
        setConfig(updatedConfig);
        setShowConfig(false);

        // 同步K线
        setSuccess("正在同步K线数据...");
        await syncKlinesForSymbols(symbols);
        await loadEngineStatus(false);
        setSuccess("配置已保存并同步K线！");
      } else {
        const err = await response.json();
        setError(err.detail || "保存失败");
      }
    } catch (e) {
      setError(`保存失败: ${e}`);
    }
  };

  const syncKlinesForSymbols = async (symbols: string[]) => {
    try {
      await Promise.all(
        symbols.map(async (symbol) => {
          const requests = [
            { symbols: [symbol], period: "min1", count: 300 },
            { symbols: [symbol], period: "day", count: 60 },
          ];
          await Promise.all(
            requests.map((req) =>
              fetch(`${API_BASE}/quotes/history/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req),
              })
            )
          );
        })
      );
    } catch (e) {
      console.error("K线同步失败:", e);
    }
  };

  const deletePosition = async (symbol: string) => {
    if (!confirm(`确定要删除持仓 ${symbol}？\n\n⚠️ 此操作仅删除数据库记录，不会触发真实卖出。`)) return;
    try {
      const response = await fetch(`${API_BASE}/ai-trading/positions/${symbol}`, { method: "DELETE" });
      if (response.ok) {
        setSuccess(`持仓 ${symbol} 已删除`);
        await loadPositions();
        await loadEngineStatus(false);
      } else {
        const err = await response.json();
        setError(err.detail || "删除失败");
      }
    } catch (e) {
      setError(`删除失败: ${e}`);
    }
  };

  const clearAllPositions = async () => {
    if (!confirm("确定要清空所有持仓？\n\n⚠️ 此操作仅删除数据库记录，不会触发真实卖出。")) return;
    try {
      const response = await fetch(`${API_BASE}/ai-trading/positions`, { method: "DELETE" });
      if (response.ok) {
        const data = await response.json();
        setSuccess(`${data.message}，删除了 ${data.deleted_count} 条记录`);
        await loadPositions();
        await loadEngineStatus(false);
      } else {
        const err = await response.json();
        setError(err.detail || "清空失败");
      }
    } catch (e) {
      setError(`清空失败: ${e}`);
    }
  };

  if (loading && !engineStatus) {
    return <LoadingSpinner size="lg" text="加载 AI 交易..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="AI 自动交易"
        description="DeepSeek 驱动的智能交易系统"
        icon={<SmartToy />}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={engineStatus?.running ? "success" : "default"}>
              {engineStatus?.running ? "● 运行中" : "○ 已停止"}
            </Badge>
            <span className="text-sm text-slate-500">监控: {engineStatus?.config?.symbols?.length || 0}</span>
            <span className="text-sm text-slate-500">今日: {engineStatus?.today_trades || 0} 笔</span>
            <span className={`text-sm font-medium ${(engineStatus?.today_pnl || 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              ${(engineStatus?.today_pnl || 0).toFixed(2)}
            </span>
            <Button variant="ghost" onClick={openConfig} icon={<Settings className="w-4 h-4" />}>
              配置
            </Button>
            <Button variant="ghost" onClick={loadAll} icon={<Refresh className="w-4 h-4" />}>
              刷新
            </Button>
            {engineStatus?.running && (
              <Button variant="warning" onClick={triggerAnalysis} icon={<FlashOn className="w-4 h-4" />}>
                立即分析
              </Button>
            )}
            {engineStatus?.running ? (
              <Button variant="danger" onClick={stopEngine} loading={engineLoading} icon={<Stop className="w-4 h-4" />}>
                停止
              </Button>
            ) : (
              <Button variant="success" onClick={startEngine} loading={engineLoading} icon={<PlayArrow className="w-4 h-4" />}>
                启动
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert type="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {!engineStatus?.running && (
        <Alert type="warning">AI 交易未启用。请点击「配置」设置 DeepSeek API Key 和监控股票池。</Alert>
      )}

      {/* 监控股票选择 */}
      {engineStatus?.config?.symbols && engineStatus.config.symbols.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">📊 监控股票：</span>
            {engineStatus.config.symbols.map((symbol: string) => (
              <button
                key={symbol}
                onClick={() => loadMainKline(symbol)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  mainKlineSymbol === symbol
                    ? "bg-cyan-500 text-white shadow-md"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {symbol}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-auto">点击查看K线图</span>
          </div>
        </Card>
      )}

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* K线图 */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader
              title={`实时K线图 ${mainKlineSymbol ? `(${mainKlineSymbol})` : ""}`}
              action={
                <div className="flex items-center gap-2">
                  {engineStatus?.config?.symbols && (
                    <select
                      value={mainKlineSymbol}
                      onChange={(e) => loadMainKline(e.target.value)}
                      className="text-sm px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    >
                      <option value="">选择股票</option>
                      {engineStatus.config.symbols.map((s: string) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => mainKlineSymbol && loadMainKline(mainKlineSymbol)}>
                    <Refresh className="w-4 h-4" />
                  </Button>
                </div>
              }
            />
            {lastUpdateTime && (
              <p className="text-xs text-slate-500 mb-4">📡 实时推送 • 最后更新: {lastUpdateTime.toLocaleTimeString()}</p>
            )}

            {mainKlineLoading ? (
              <LoadingSpinner text="加载K线数据..." />
            ) : mainKlineData.length > 0 ? (
              <div className="flex justify-center">
                <SimpleKLineChart
                  data={mainKlineData.map((bar) => ({
                    time: bar.ts,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume,
                  }))}
                  width={700}
                  height={450}
                />
              </div>
            ) : (
              <EmptyState
                title="暂无K线数据"
                description={mainKlineSymbol ? "请检查数据源或重新加载" : "请在配置中添加监控股票"}
                icon={<SmartToy />}
              />
            )}
          </Card>
        </div>

        {/* AI 分析面板 */}
        <div className="lg:col-span-5">
          <Card padding="none" className="h-[550px] overflow-hidden">
            <AiAnalysisPanel wsUrl={resolveWsUrl("/ws/ai-trading")} maxMessages={30} />
          </Card>
        </div>
      </div>

      {/* 底部标签页 */}
      <Card>
        <Tabs
          tabs={[
            { id: "trades", label: "📝 交易记录" },
            { id: "positions", label: "💼 持仓管理" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-4">
          {activeTab === "trades" && (
            <div>
              {trades.length === 0 ? (
                <EmptyState title="暂无交易记录" description="AI 交易记录将显示在这里" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left py-3 px-4 font-medium text-slate-500">时间</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-500">股票</th>
                        <th className="text-center py-3 px-4 font-medium text-slate-500">操作</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">数量</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">价格</th>
                        <th className="text-center py-3 px-4 font-medium text-slate-500">状态</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">盈亏</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-500">信心度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700/50">
                          <td className="py-3 px-4 text-slate-500 text-xs">
                            {new Date(trade.order_time).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{trade.symbol}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                trade.action === "BUY"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                            >
                              {trade.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">{trade.order_quantity}</td>
                          <td className="py-3 px-4 text-right">${trade.filled_price?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                trade.status === "FILLED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : trade.status === "FAILED"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {trade.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {trade.pnl != null ? (
                              <span className={trade.pnl >= 0 ? "text-emerald-600" : "text-red-600"}>
                                ${trade.pnl.toFixed(2)} ({trade.pnl_percent?.toFixed(2)}%)
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">{(trade.ai_confidence * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "positions" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">当前 AI 持仓</h3>
                {positions.length > 0 && (
                  <Button size="sm" variant="danger" onClick={clearAllPositions}>
                    清空所有持仓
                  </Button>
                )}
              </div>

              {positions.length === 0 ? (
                <EmptyState title="暂无持仓" description="AI 持仓将显示在这里" />
              ) : (
                <>
                  <Alert type="warning" className="mb-4">
                    <strong>注意：</strong>删除持仓仅清除数据库记录，不会触发真实卖出操作。
                  </Alert>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <th className="text-left py-3 px-4 font-medium text-slate-500">股票</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">数量</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">成本</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">现价</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">市值</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">盈亏</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">开仓时间</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-500">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos) => (
                          <tr key={pos.symbol} className="border-b border-slate-100 dark:border-slate-700/50">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{pos.symbol}</td>
                            <td className="py-3 px-4 text-right">{pos.quantity}</td>
                            <td className="py-3 px-4 text-right">${pos.avg_cost?.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">${pos.current_price?.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">${(pos.current_price * pos.quantity).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={pos.unrealized_pnl >= 0 ? "text-emerald-600" : "text-red-600"}>
                                ${pos.unrealized_pnl?.toFixed(2)} ({pos.unrealized_pnl_percent?.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-xs">
                              {new Date(pos.open_time).toLocaleString("zh-CN", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button size="sm" variant="danger" onClick={() => deletePosition(pos.symbol)}>
                                删除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 配置对话框 */}
      {showConfig && config && (
        <Dialog title="AI 交易配置" onClose={() => setShowConfig(false)} size="lg">
          <div className="space-y-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled || false}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">启用 AI 自动交易</span>
            </label>

            <Alert type="info">
              <strong>DeepSeek API Key 配置：</strong>请前往「⚙️ 基础配置」页面的「AI 配置」区域设置。
            </Alert>

            <div>
              <div className="flex gap-2 mb-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const response = await fetch(`${API_BASE}/portfolio/positions`);
                      if (response.ok) {
                        const data = await response.json();
                        const positionSymbols = (data.positions || []).map((p: any) => p.symbol);
                        if (positionSymbols.length > 0) {
                          const current = symbolsInput.trim();
                          setSymbolsInput(current ? `${current}, ${positionSymbols.join(", ")}` : positionSymbols.join(", "));
                          setSuccess(`已添加 ${positionSymbols.length} 只持仓股票`);
                        } else {
                          setError("当前没有持仓");
                        }
                      }
                    } catch (e) {
                      setError("获取持仓失败");
                    }
                  }}
                >
                  从持仓中添加
                </Button>
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">监控股票池</label>
              <textarea
                value={symbolsInput}
                onChange={(e) => setSymbolsInput(e.target.value)}
                placeholder="例如：DVN.US, AAPL.US, 700.HK"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">用逗号、空格或换行分隔</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="检查间隔（分钟）"
                type="number"
                value={config.check_interval_minutes || 5}
                onChange={(e) => setConfig({ ...config, check_interval_minutes: parseInt(e.target.value) })}
              />
              <Input
                label="最小信心度"
                type="number"
                value={config.min_confidence || 0.75}
                onChange={(e) => setConfig({ ...config, min_confidence: parseFloat(e.target.value) })}
              />
              <Input
                label="每日最大交易次数"
                type="number"
                value={config.max_daily_trades || 20}
                onChange={(e) => setConfig({ ...config, max_daily_trades: parseInt(e.target.value) })}
              />
              <Input
                label="每日最大亏损($)"
                type="number"
                value={config.max_loss_per_day || 5000}
                onChange={(e) => setConfig({ ...config, max_loss_per_day: parseFloat(e.target.value) })}
              />
            </div>

            <Input
              label="每笔固定交易金额($)"
              type="number"
              value={config.fixed_amount_per_trade || 10000}
              onChange={(e) => setConfig({ ...config, fixed_amount_per_trade: parseFloat(e.target.value) })}
            />

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enable_real_trading || false}
                  onChange={(e) => setConfig({ ...config, enable_real_trading: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">启用真实交易（⚠️ 谨慎操作）</span>
              </label>
              <p className="text-xs text-slate-500 mt-1">关闭时为模拟模式，开启后会执行真实下单</p>
            </div>

            {config.enable_real_trading && (
              <Alert type="error">
                <strong>警告：</strong>真实交易模式已开启！系统将执行实际的买卖操作，请确保已充分测试并理解风险。
              </Alert>
            )}

            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={() => setShowConfig(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={saveConfig} className="flex-1">
                保存配置
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// 对话框组件
function Dialog({
  title,
  children,
  onClose,
  size = "md",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
}) {
  const sizeClasses = { md: "max-w-md", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <Close className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
