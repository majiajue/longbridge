/**
 * 智能仓位管理页面 - 现代化重构版
 */
import { useState, useEffect } from "react";
import {
  Calculate,
  AutoMode,
  Refresh,
  Add,
  AccountBalanceWallet,
  Close,
  PlayArrow,
  Stop,
  Settings,
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
  EmptyState,
  LoadingSpinner,
  Tabs,
} from "../components/ui";

interface PositionCalculation {
  symbol: string;
  action: string;
  quantity: number;
  estimated_price: number;
  estimated_cost: number;
  reason: string;
  risk_level: string;
  max_loss: number;
  suggested_stop_loss: number;
  suggested_take_profit: number;
  portfolio_status?: any;
}

interface BatchCalculation {
  symbol: string;
  current_position: any;
  recommendation: PositionCalculation;
  create_strategy: boolean;
}

interface AutoConfig {
  enabled: boolean;
  check_interval_minutes: number;
  use_ai_analysis: boolean;
  min_ai_confidence: number;
  auto_stop_loss_percent: number;
  auto_take_profit_percent: number;
  auto_rebalance_percent: number;
  max_position_value: number;
  position_allocation: number;
  sell_ratio: number;
  enable_real_trading: boolean;
}

export default function SmartPositionPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<any>(null);
  const [calculation, setCalculation] = useState<PositionCalculation | null>(null);
  const [batchResults, setBatchResults] = useState<BatchCalculation[]>([]);
  const [tabValue, setTabValue] = useState("single");

  // 自动管理状态
  const [autoStatus, setAutoStatus] = useState<any>(null);
  const [autoTrades, setAutoTrades] = useState<any[]>([]);
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [autoConfig, setAutoConfig] = useState<AutoConfig>({
    enabled: false,
    check_interval_minutes: 30,
    use_ai_analysis: true,
    min_ai_confidence: 0.7,
    auto_stop_loss_percent: -5.0,
    auto_take_profit_percent: 15.0,
    auto_rebalance_percent: -10.0,
    max_position_value: 50000,
    position_allocation: 0.05,
    sell_ratio: 1.0,
    enable_real_trading: false,
  });

  // K线图相关
  const [showKlineDialog, setShowKlineDialog] = useState(false);
  const [selectedKlineSymbol, setSelectedKlineSymbol] = useState("");
  const [klineData, setKlineData] = useState<any[]>([]);
  const [klineLoading, setKlineLoading] = useState(false);

  // 运行日志
  const [runningLogs, setRunningLogs] = useState<string[]>([]);

  // 单个计算表单
  const [singleForm, setSingleForm] = useState({
    symbol: "",
    action: "buy",
    method: "percentage",
    target_allocation: 0.1,
    max_risk: 0.02,
    stop_loss_pct: 0.05,
  });

  // 批量处理表单
  const [batchForm, setBatchForm] = useState({
    symbols: "",
    strategy_type: "ma_crossover",
    allocation_per_symbol: 0.1,
    auto_execute: false,
  });

  const [showBatchDialog, setShowBatchDialog] = useState(false);

  const loadPortfolioStatus = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/portfolio-status`);
      if (response.ok) {
        const data = await response.json();
        setPortfolioStatus(data);
      }
    } catch (e) {
      console.error("Error loading portfolio status:", e);
    }
  };

  const loadAutoStatus = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/auto/status`);
      if (response.ok) {
        const data = await response.json();
        setAutoStatus(data);
        if (data.config) {
          setAutoConfig(data.config);
        }
        if (data.recent_logs && data.recent_logs.length > 0) {
          setRunningLogs(data.recent_logs.slice(-20));
        }
      }
    } catch (e) {
      console.error("Error loading auto status:", e);
    }
  };

  const loadAutoTrades = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/auto/trades?limit=20`);
      if (response.ok) {
        const data = await response.json();
        const trades = data.trades || [];
        setAutoTrades(trades);
        if (trades.length > 0 && runningLogs.length === 0) {
          const logs = trades.slice(0, 5).map((trade: any) => {
            const time = new Date(trade.timestamp).toLocaleTimeString("zh-CN");
            const emoji = trade.status === "FILLED" ? "✅" : trade.status === "FAILED" ? "❌" : "📝";
            return `[${time}] ${emoji} ${trade.action} ${trade.symbol} x${trade.quantity} @ $${trade.price.toFixed(2)}`;
          });
          setRunningLogs(logs);
        }
      }
    } catch (e) {
      console.error("Error loading auto trades:", e);
    }
  };

  const startAutoManager = async () => {
    if (!autoConfig.enabled) {
      setError("请先在配置中启用自动仓位管理");
      setShowAutoConfig(true);
      return;
    }
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/auto/start`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || "启动成功");
        loadAutoStatus();
      } else {
        const err = await response.json();
        setError(err.detail || "启动失败");
      }
    } catch (e) {
      setError(`启动失败: ${e}`);
    }
  };

  const stopAutoManager = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/auto/stop`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || "停止成功");
        loadAutoStatus();
      } else {
        const err = await response.json();
        setError(err.detail || "停止失败");
      }
    } catch (e) {
      setError(`停止失败: ${e}`);
    }
  };

  const saveAutoConfig = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/auto/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(autoConfig),
      });
      if (response.ok) {
        await loadAutoStatus();
        setShowAutoConfig(false);
        setSuccess("配置已保存");
      } else {
        const err = await response.json();
        setError(err.detail || "保存失败");
      }
    } catch (e) {
      setError(`保存失败: ${e}`);
    }
  };

  const loadKlineData = async (symbol: string) => {
    setKlineLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/klines/${symbol}?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setKlineData(data.klines || []);
      } else {
        setKlineData([]);
      }
    } catch (e) {
      setKlineData([]);
    } finally {
      setKlineLoading(false);
    }
  };

  const openKlineChart = (symbol: string) => {
    setSelectedKlineSymbol(symbol);
    setShowKlineDialog(true);
    loadKlineData(symbol);
  };

  const calculatePosition = async () => {
    if (!singleForm.symbol) {
      setError("请输入股票代码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const response = await fetch(`${base}/position-manager/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleForm),
      });
      if (response.ok) {
        const data = await response.json();
        setCalculation(data);
        if (data.portfolio_status) {
          setPortfolioStatus(data.portfolio_status);
        }
      } else {
        const err = await response.json();
        setError(err.detail || "计算失败");
      }
    } catch (e) {
      setError("计算失败");
    } finally {
      setLoading(false);
    }
  };

  const generateBatchStrategies = async () => {
    if (!batchForm.symbols) {
      setError("请输入股票代码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const symbols = batchForm.symbols
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      const response = await fetch(`${base}/position-manager/auto-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols,
          strategy_type: batchForm.strategy_type,
          allocation_per_symbol: batchForm.allocation_per_symbol,
          auto_execute: batchForm.auto_execute,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setBatchResults(data);
        setShowBatchDialog(false);
        setSuccess(`已生成 ${data.length} 个策略`);
      } else {
        const err = await response.json();
        setError(err.detail || "生成失败");
      }
    } catch (e) {
      setError("生成失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolioStatus();
    loadAutoStatus();
    loadAutoTrades();
    const interval = setInterval(() => {
      loadAutoStatus();
      loadAutoTrades();
    }, 10000);
    return () => clearInterval(interval);
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

  const getRiskStyle = (level: string) => {
    switch (level) {
      case "low":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "medium":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case "low":
        return "低风险";
      case "medium":
        return "中风险";
      case "high":
        return "高风险";
      default:
        return level;
    }
  };

  const handleRefresh = () => {
    loadPortfolioStatus();
    loadAutoStatus();
    loadAutoTrades();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="智能仓位管理"
        description="根据账户资金和风险偏好自动计算买卖数量"
        icon={<Calculate />}
        actions={
          <Button variant="secondary" onClick={handleRefresh} icon={<Refresh className="w-4 h-4" />}>
            刷新
          </Button>
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

      {/* 账户概览 */}
      {portfolioStatus && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="总资产"
            value={`$${portfolioStatus.total_capital?.toFixed(2) || "0.00"}`}
            icon={<AccountBalanceWallet className="w-5 h-5" />}
          />
          <StatCard
            label="可用资金"
            value={`$${portfolioStatus.available_cash?.toFixed(2) || "0.00"}`}
            color="emerald"
          />
          <StatCard
            label="持仓市值"
            value={`$${portfolioStatus.market_value?.toFixed(2) || "0.00"}`}
            color="cyan"
          />
          <StatCard
            label="现金比例"
            value={`${((portfolioStatus.cash_ratio || 0) * 100).toFixed(1)}%`}
          />
        </div>
      )}

      {/* 自动仓位管理 */}
      <Card>
        <CardHeader
          title="自动仓位管理"
          icon={<AutoMode className="w-5 h-5 text-cyan-500" />}
          action={
            <div className="flex items-center gap-2">
              {autoStatus && (
                <>
                  <Badge variant={autoStatus.running ? "success" : "default"}>
                    {autoStatus.running ? "● 运行中" : "○ 已停止"}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    检查间隔: {autoStatus.check_interval_minutes || 30}分钟
                  </span>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShowAutoConfig(true)} icon={<Settings className="w-4 h-4" />}>
                配置
              </Button>
              {autoStatus?.running ? (
                <Button size="sm" variant="danger" onClick={stopAutoManager} icon={<Stop className="w-4 h-4" />}>
                  停止
                </Button>
              ) : (
                <Button size="sm" variant="success" onClick={startAutoManager} icon={<PlayArrow className="w-4 h-4" />}>
                  启动
                </Button>
              )}
            </div>
          }
        />

        <div className="mb-4">
          <Alert type="info">
            <strong>功能说明：</strong>自动监控持仓，触发止损/止盈时自动卖出。当前为
            {autoConfig.enable_real_trading ? "真实交易" : "模拟"}模式。
          </Alert>
        </div>

        {/* 运行日志 */}
        {autoStatus?.running && runningLogs.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">📋 运行日志</p>
            <div className="bg-slate-900 rounded-lg p-4 max-h-40 overflow-y-auto font-mono text-sm">
              {runningLogs.map((log, i) => (
                <div key={i} className="text-emerald-400 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 交易记录 */}
        {autoTrades.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">交易记录</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">时间</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">操作</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">股票</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">数量</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">价格</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">状态</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {autoTrades.slice(0, 10).map((trade: any) => (
                    <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-3 text-slate-500 text-xs">
                        {new Date(trade.timestamp).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            trade.action === "BUY"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {trade.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{trade.symbol}</td>
                      <td className="py-2 px-3 text-right">{trade.quantity}</td>
                      <td className="py-2 px-3 text-right">${trade.price?.toFixed(2)}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            trade.status === "FILLED"
                              ? "bg-emerald-100 text-emerald-700"
                              : trade.status === "FAILED"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {trade.status || "SIMULATION"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button size="sm" variant="ghost" onClick={() => openKlineChart(trade.symbol)}>
                          K线
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {autoTrades.length === 0 && (
          <EmptyState
            title="暂无交易记录"
            description="启动自动管理后，交易记录将显示在这里"
            icon={<AutoMode />}
          />
        )}
      </Card>

      {/* 仓位计算 */}
      <Tabs
        tabs={[
          { id: "single", label: "单个计算", icon: <Calculate className="w-4 h-4" /> },
          { id: "batch", label: "批量策略", icon: <AutoMode className="w-4 h-4" /> },
        ]}
        activeTab={tabValue}
        onChange={setTabValue}
      />

      {tabValue === "single" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 计算表单 */}
          <Card>
            <CardHeader title="仓位计算" icon={<Calculate className="w-5 h-5" />} />
            <div className="space-y-4">
              <Input
                label="股票代码"
                value={singleForm.symbol}
                onChange={(e) => setSingleForm({ ...singleForm, symbol: e.target.value.toUpperCase() })}
                placeholder="例如：AAPL.US, 700.HK"
              />
              <Select
                label="操作类型"
                value={singleForm.action}
                onChange={(e) => setSingleForm({ ...singleForm, action: e.target.value })}
                options={[
                  { value: "buy", label: "买入" },
                  { value: "sell", label: "卖出" },
                ]}
              />
              <Select
                label="计算方法"
                value={singleForm.method}
                onChange={(e) => setSingleForm({ ...singleForm, method: e.target.value })}
                options={[
                  { value: "percentage", label: "资金百分比" },
                  { value: "risk_based", label: "基于风险" },
                  { value: "fixed_amount", label: "固定金额" },
                  { value: "equal_weight", label: "等权重" },
                ]}
              />
              <Input
                label="目标仓位比例"
                type="number"
                value={singleForm.target_allocation}
                onChange={(e) => setSingleForm({ ...singleForm, target_allocation: parseFloat(e.target.value) })}
                placeholder="0.1"
              />
              <Input
                label="止损比例"
                type="number"
                value={singleForm.stop_loss_pct}
                onChange={(e) => setSingleForm({ ...singleForm, stop_loss_pct: parseFloat(e.target.value) })}
                placeholder="0.05"
              />
              <Button onClick={calculatePosition} loading={loading} disabled={!singleForm.symbol} className="w-full">
                计算仓位
              </Button>
            </div>
          </Card>

          {/* 计算结果 */}
          <Card>
            <CardHeader title="计算结果" />
            {calculation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ResultItem label="操作" value={calculation.action === "buy" ? "买入" : "卖出"} />
                  <ResultItem label="数量" value={`${calculation.quantity} 股`} highlight />
                  <ResultItem label="预估价格" value={`$${calculation.estimated_price.toFixed(2)}`} />
                  <ResultItem label="预估成本" value={`$${Math.abs(calculation.estimated_cost).toFixed(2)}`} />
                  <ResultItem label="建议止损" value={`$${calculation.suggested_stop_loss.toFixed(2)}`} danger />
                  <ResultItem label="建议止盈" value={`$${calculation.suggested_take_profit.toFixed(2)}`} success />
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500 mb-2">风险等级</p>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${getRiskStyle(calculation.risk_level)}`}>
                    {getRiskLabel(calculation.risk_level)}
                  </span>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500 mb-2">说明</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{calculation.reason}</p>
                </div>
              </div>
            ) : (
              <EmptyState
                title="暂无计算结果"
                description="输入股票代码并点击计算"
                icon={<Calculate />}
              />
            )}
          </Card>
        </div>
      )}

      {tabValue === "batch" && (
        <Card>
          <CardHeader
            title="批量策略生成"
            icon={<AutoMode className="w-5 h-5" />}
            action={
              <Button size="sm" onClick={() => setShowBatchDialog(true)} icon={<Add className="w-4 h-4" />}>
                新建批量任务
              </Button>
            }
          />
          {batchResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-500">股票</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">建议数量</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">预估成本</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">风险</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((result) => (
                    <tr key={result.symbol} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{result.symbol}</td>
                      <td className="py-3 px-4 text-right">{result.recommendation.quantity}</td>
                      <td className="py-3 px-4 text-right">${result.recommendation.estimated_cost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${getRiskStyle(result.recommendation.risk_level)}`}>
                          {getRiskLabel(result.recommendation.risk_level)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={result.create_strategy ? "info" : "default"}>
                          {result.create_strategy ? "需创建策略" : "已有持仓"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="暂无批量结果"
              description="点击「新建批量任务」开始"
              icon={<AutoMode />}
            />
          )}
        </Card>
      )}

      {/* 批量任务对话框 */}
      {showBatchDialog && (
        <Dialog title="批量策略生成" onClose={() => setShowBatchDialog(false)}>
          <div className="space-y-4">
            {portfolioStatus?.positions?.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const allSymbols = portfolioStatus.positions.map((p: any) => p.symbol).join(", ");
                  setBatchForm({ ...batchForm, symbols: allSymbols });
                }}
              >
                选择全部持仓
              </Button>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                股票代码列表
              </label>
              <textarea
                value={batchForm.symbols}
                onChange={(e) => setBatchForm({ ...batchForm, symbols: e.target.value })}
                placeholder="多个代码用逗号分隔，例如：AAPL.US, MSFT.US"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
            </div>
            <Select
              label="策略类型"
              value={batchForm.strategy_type}
              onChange={(e) => setBatchForm({ ...batchForm, strategy_type: e.target.value })}
              options={[
                { value: "ma_crossover", label: "均线交叉策略" },
                { value: "rsi_oversold", label: "RSI 超卖反弹策略" },
              ]}
            />
            <Input
              label="每个股票的配置比例"
              type="number"
              value={batchForm.allocation_per_symbol}
              onChange={(e) => setBatchForm({ ...batchForm, allocation_per_symbol: parseFloat(e.target.value) })}
            />
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowBatchDialog(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={generateBatchStrategies} loading={loading} disabled={!batchForm.symbols} className="flex-1">
                生成策略
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 自动配置对话框 */}
      {showAutoConfig && (
        <Dialog title="自动仓位管理配置" onClose={() => setShowAutoConfig(false)} size="lg">
          <div className="space-y-6">
            {autoConfig.enable_real_trading && (
              <Alert type="error">
                <strong>警告：</strong>已启用真实交易，系统将执行真实的买卖操作！
              </Alert>
            )}

            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">基础设置</h4>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="启用自动管理"
                  value={autoConfig.enabled ? "yes" : "no"}
                  onChange={(e) => setAutoConfig({ ...autoConfig, enabled: e.target.value === "yes" })}
                  options={[
                    { value: "no", label: "否（已禁用）" },
                    { value: "yes", label: "是（已启用）" },
                  ]}
                />
                <Input
                  label="检查间隔（分钟）"
                  type="number"
                  value={autoConfig.check_interval_minutes}
                  onChange={(e) => setAutoConfig({ ...autoConfig, check_interval_minutes: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">风险管理</h4>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="自动止损 (%)"
                  type="number"
                  value={autoConfig.auto_stop_loss_percent}
                  onChange={(e) => setAutoConfig({ ...autoConfig, auto_stop_loss_percent: parseFloat(e.target.value) })}
                />
                <Input
                  label="自动止盈 (%)"
                  type="number"
                  value={autoConfig.auto_take_profit_percent}
                  onChange={(e) => setAutoConfig({ ...autoConfig, auto_take_profit_percent: parseFloat(e.target.value) })}
                />
                <Input
                  label="补仓触发 (%)"
                  type="number"
                  value={autoConfig.auto_rebalance_percent}
                  onChange={(e) => setAutoConfig({ ...autoConfig, auto_rebalance_percent: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">AI 分析</h4>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="启用 AI 分析"
                  value={autoConfig.use_ai_analysis ? "yes" : "no"}
                  onChange={(e) => setAutoConfig({ ...autoConfig, use_ai_analysis: e.target.value === "yes" })}
                  options={[
                    { value: "no", label: "否（仅规则引擎）" },
                    { value: "yes", label: "是" },
                  ]}
                />
                <Input
                  label="AI 最小信心度"
                  type="number"
                  value={autoConfig.min_ai_confidence}
                  onChange={(e) => setAutoConfig({ ...autoConfig, min_ai_confidence: parseFloat(e.target.value) })}
                  disabled={!autoConfig.use_ai_analysis}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">高级设置</h4>
              <Select
                label="启用真实交易"
                value={autoConfig.enable_real_trading ? "yes" : "no"}
                onChange={(e) => setAutoConfig({ ...autoConfig, enable_real_trading: e.target.value === "yes" })}
                options={[
                  { value: "no", label: "否（模拟模式）" },
                  { value: "yes", label: "是（真实交易）⚠️" },
                ]}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" onClick={() => setShowAutoConfig(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={saveAutoConfig} className="flex-1">
                保存配置
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* K线图对话框 */}
      {showKlineDialog && (
        <Dialog title={`${selectedKlineSymbol} K线数据`} onClose={() => setShowKlineDialog(false)} size="lg">
          {klineLoading ? (
            <LoadingSpinner text="加载K线数据..." />
          ) : klineData.length === 0 ? (
            <Alert type="info">暂无K线数据，请先同步该股票的历史数据</Alert>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">日期</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">开盘</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">最高</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">最低</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">收盘</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">成交量</th>
                  </tr>
                </thead>
                <tbody>
                  {klineData.map((kline: any, index: number) => (
                    <tr key={index} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{kline.ts}</td>
                      <td className="py-2 px-3 text-right">${kline.open?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">${kline.high?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-red-600">${kline.low?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-medium">${kline.close?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{kline.volume?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

// 统计卡片
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: "emerald" | "cyan" | "red";
}) {
  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-xl font-bold ${color ? colorClasses[color] : "text-slate-900 dark:text-white"}`}>
            {value}
          </p>
        </div>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
    </div>
  );
}

// 结果项
function ResultItem({
  label,
  value,
  highlight,
  success,
  danger,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  let valueClass = "text-slate-900 dark:text-white";
  if (highlight) valueClass = "text-cyan-600 dark:text-cyan-400 font-bold";
  if (success) valueClass = "text-emerald-600 dark:text-emerald-400";
  if (danger) valueClass = "text-red-600 dark:text-red-400";

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-medium ${valueClass}`}>{value}</p>
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
  const sizeClasses = {
    md: "max-w-md",
    lg: "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Close className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
