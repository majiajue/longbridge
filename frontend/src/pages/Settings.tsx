import { useEffect, useMemo, useState } from "react";
import StatusSnackbar from "../components/StatusSnackbar";
import {
  Credentials,
  HistoryBar,
  fetchCredentials,
  fetchHistory,
  fetchSymbols,
  syncHistory,
  updateCredentials,
  updateSymbols,
  verifySettings,
} from "../api/client";

const EMPTY_CREDS: Credentials = {
  LONGPORT_APP_KEY: "",
  LONGPORT_APP_SECRET: "",
  LONGPORT_ACCESS_TOKEN: "",
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

export default function SettingsPage() {
  const [credentials, setCredentials] = useState<Credentials>(EMPTY_CREDS);
  const [symbols, setSymbols] = useState<string>("");
  const [symbolList, setSymbolList] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState("day");
  const [historyAdjust, setHistoryAdjust] = useState("no_adjust");
  const [historyCount, setHistoryCount] = useState(120);
  const [historyBars, setHistoryBars] = useState<HistoryBar[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "info" | "warning" | "error";
  }>({ open: false, message: "", severity: "info" });

  useEffect(() => {
    async function bootstrap() {
      try {
        const [creds, symbolsRes] = await Promise.all([
          fetchCredentials(),
          fetchSymbols(),
        ]);
        setCredentials({ ...EMPTY_CREDS, ...creds });
        setSymbols(symbolsRes.symbols.join("\n"));
        setSymbolList(symbolsRes.symbols);
        setSelectedSymbol((prev) => prev || symbolsRes.symbols[0] || "");
      } catch (error) {
        console.error(error);
        setSnackbar({
          open: true,
          message: error instanceof Error ? error.message : "读取配置失败",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  const parsedSymbols = useMemo(
    () =>
      symbols
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [symbols]
  );

  const handleCredChange = (key: keyof Credentials) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSymbolsChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setSymbols(event.target.value);
  };

  const handleCredSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateCredentials(credentials);
      setSnackbar({ open: true, message: "凭据保存成功", severity: "success" });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "保存失败",
        severity: "error",
      });
    }
  };

  const handleSymbolSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    try {
      const list = parsedSymbols;
      await updateSymbols(list);
      setSymbolList(list);
      if (!list.includes(selectedSymbol)) {
        setSelectedSymbol(list[0] ?? "");
      }
      setSnackbar({
        open: true,
        message: "股票列表更新完成",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "保存失败",
        severity: "error",
      });
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await verifySettings(parsedSymbols);
      setSnackbar({
        open: true,
        message: `验证成功：${res.tested_symbols}`,
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "验证失败",
        severity: "error",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleHistorySync = async () => {
    setHistoryLoading(true);
    try {
      const payload = {
        symbols: parsedSymbols,
        period: historyPeriod,
        adjust_type: historyAdjust,
        count: historyCount,
      };
      const res = await syncHistory(payload);
      const summary = Object.entries(res.processed)
        .map(([sym, cnt]) => `${sym}:${cnt}`)
        .join(", ");
      setSnackbar({
        open: true,
        message: summary ? `同步完成 ${summary}` : "同步完成",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "同步失败",
        severity: "error",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryFetch = async () => {
    if (!selectedSymbol) {
      setSnackbar({
        open: true,
        message: "请先配置股票代码",
        severity: "warning",
      });
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetchHistory(
        selectedSymbol,
        Math.min(historyCount, 500),
        historyPeriod,
        historyAdjust
      );
      setHistoryBars(res.bars);
      setSnackbar({
        open: true,
        message: `${selectedSymbol} 拉取 ${res.bars.length} 条 K 线`,
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "读取失败",
        severity: "error",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Credentials Configuration */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Longbridge 凭据配置
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          请填写从 Longbridge 开发者平台注册获得的凭据，仅存储在本地 DuckDB。
        </p>
        <form onSubmit={handleCredSubmit} className="space-y-4">
          <div>
            <label className="label">LONGPORT_APP_KEY</label>
            <input
              type="text"
              className="input-field"
              value={credentials.LONGPORT_APP_KEY}
              onChange={handleCredChange("LONGPORT_APP_KEY")}
              required
              placeholder="输入你的 APP KEY"
            />
          </div>
          <div>
            <label className="label">LONGPORT_APP_SECRET</label>
            <input
              type="password"
              className="input-field"
              value={credentials.LONGPORT_APP_SECRET}
              onChange={handleCredChange("LONGPORT_APP_SECRET")}
              required
              placeholder="输入你的 APP SECRET"
            />
          </div>
          <div>
            <label className="label">LONGPORT_ACCESS_TOKEN</label>
            <input
              type="password"
              className="input-field"
              value={credentials.LONGPORT_ACCESS_TOKEN}
              onChange={handleCredChange("LONGPORT_ACCESS_TOKEN")}
              required
              placeholder="输入你的 ACCESS TOKEN"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary">
              💾 保存凭据
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? "验证中..." : "🔍 验证凭据与行情"}
            </button>
          </div>
        </form>
      </div>

      {/* Stock List Configuration */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          股票列表配置
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          每行填写一只股票代码，如：`AAPL.US` 或 `700.HK`。
        </p>
        <form onSubmit={handleSymbolSubmit} className="space-y-4">
          <div>
            <label className="label">股票代码</label>
            <textarea
              className="input-field min-h-[150px] font-mono"
              value={symbols}
              onChange={handleSymbolsChange}
              placeholder="AAPL.US\nTSLA.US\n700.HK"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              📝 保存列表
            </button>
          </div>
        </form>
      </div>

      {/* History K-Line Sync and Preview */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          历史 K 线同步与预览
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          调用 Longbridge `history_candlesticks_by_offset` 接口同步数据至本地 DuckDB，并可查看拉取结果样例。
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">周期</label>
              <select
                className="input-field"
                value={historyPeriod}
                onChange={(e) => setHistoryPeriod(e.target.value)}
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">复权</label>
              <select
                className="input-field"
                value={historyAdjust}
                onChange={(e) => setHistoryAdjust(e.target.value)}
              >
                {ADJUST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">数量</label>
              <input
                type="number"
                className="input-field"
                value={historyCount}
                onChange={(e) => setHistoryCount(Number(e.target.value) || 0)}
                min={1}
                max={1000}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">预览股票</label>
              <select
                className="input-field"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
              >
                {symbolList.length === 0 ? (
                  <option value="" disabled>
                    请先保存股票列表
                  </option>
                ) : (
                  symbolList.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                className="btn-primary flex-1"
                onClick={handleHistorySync}
                disabled={historyLoading || parsedSymbols.length === 0}
              >
                {historyLoading ? "执行中..." : "🔄 同步历史数据"}
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={handleHistoryFetch}
                disabled={historyLoading || !selectedSymbol}
              >
                👁️ 预览最近数据
              </button>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700">
            {historyBars.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                暂无数据，点击"同步历史数据"并"预览最近数据"查看结果。
              </p>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {historyBars.slice(0, 20).map((bar) => (
                  <div
                    key={`${bar.ts}`}
                    className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded transition-colors"
                  >
                    <span className="font-semibold text-primary-600 dark:text-primary-400">
                      {new Date(bar.ts).toLocaleString()}
                    </span>
                    <span className="ml-2">
                      O:{bar.open ?? "-"} H:{bar.high ?? "-"} L:{bar.low ?? "-"} C:{bar.close ?? "-"} V:{bar.volume ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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