import { useEffect, useMemo, useState } from "react";
import {
  Key,
  SmartToy,
  FormatListBulleted,
  Timeline,
  Save,
  Verified,
  Sync,
  Visibility,
} from "@mui/icons-material";
import StatusSnackbar from "../components/StatusSnackbar";
import ErrorDialog from "../components/ErrorDialog";
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Input,
  Select,
  Badge,
  Alert,
  LoadingSpinner,
} from "../components/ui";
import {
  Credentials,
  AICredentials,
  HistoryBar,
  fetchCredentials,
  fetchAICredentials,
  fetchHistory,
  fetchSymbols,
  syncHistory,
  updateCredentials,
  updateAICredentials,
  updateSymbols,
  verifySettings,
  APIError,
} from "../api/client";

const EMPTY_CREDS: Credentials = {
  LONGPORT_APP_KEY: "",
  LONGPORT_APP_SECRET: "",
  LONGPORT_ACCESS_TOKEN: "",
};

const EMPTY_AI_CREDS: AICredentials = {
  DEEPSEEK_API_KEY: "",
  TAVILY_API_KEY: "",
  EODHD_API_KEY: "",
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
  const [aiCredentials, setAICredentials] = useState<AICredentials>(EMPTY_AI_CREDS);
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
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    error: Error | APIError | null;
    title?: string;
  }>({ open: false, error: null });

  useEffect(() => {
    async function bootstrap() {
      try {
        const [creds, aiCreds, symbolsRes] = await Promise.all([
          fetchCredentials(),
          fetchAICredentials(),
          fetchSymbols(),
        ]);
        setCredentials({ ...EMPTY_CREDS, ...creds });
        setAICredentials({ ...EMPTY_AI_CREDS, ...aiCreds });
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

  const handleCredChange =
    (key: keyof Credentials) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleAICredChange =
    (key: keyof AICredentials) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setAICredentials((prev) => ({ ...prev, [key]: event.target.value }));
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

  const handleAICredSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateAICredentials(aiCredentials);
      setSnackbar({ open: true, message: "AI 凭据保存成功", severity: "success" });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : "保存失败",
        severity: "error",
      });
    }
  };

  const handleSymbolSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
      if (error instanceof APIError || error instanceof Error) {
        setErrorDialog({ open: true, error, title: "凭据验证失败" });
      } else {
        setSnackbar({ open: true, message: "验证失败", severity: "error" });
      }
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
      setSnackbar({ open: true, message: "请先配置股票代码", severity: "warning" });
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
    return <LoadingSpinner size="lg" text="加载配置中..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="基础配置"
        description="管理 API 凭据、股票列表和历史数据同步"
        icon={<Key />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Longbridge Credentials */}
        <Card>
          <CardHeader
            title="Longbridge 凭据"
            description="从 Longbridge 开发者平台获取"
            icon={<Key className="w-5 h-5" />}
            action={
              <Badge variant="info" dot>
                本地加密存储
              </Badge>
            }
          />
          <form onSubmit={handleCredSubmit} className="space-y-4">
            <Input
              label="APP KEY"
              type="text"
              value={credentials.LONGPORT_APP_KEY}
              onChange={handleCredChange("LONGPORT_APP_KEY")}
              placeholder="输入你的 APP KEY"
              required
            />
            <Input
              label="APP SECRET"
              type="password"
              value={credentials.LONGPORT_APP_SECRET}
              onChange={handleCredChange("LONGPORT_APP_SECRET")}
              placeholder="输入你的 APP SECRET"
              required
            />
            <Input
              label="ACCESS TOKEN"
              type="password"
              value={credentials.LONGPORT_ACCESS_TOKEN}
              onChange={handleCredChange("LONGPORT_ACCESS_TOKEN")}
              placeholder="输入你的 ACCESS TOKEN"
              required
            />
            <div className="flex gap-3 pt-2">
              <Button type="submit" icon={<Save className="w-4 h-4" />}>
                保存凭据
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleVerify}
                loading={verifying}
                icon={<Verified className="w-4 h-4" />}
              >
                验证凭据
              </Button>
            </div>
          </form>
        </Card>

        {/* AI Credentials */}
        <Card>
          <CardHeader
            title="AI 服务配置"
            description="用于 AI 分析和新闻舆情功能"
            icon={<SmartToy className="w-5 h-5" />}
          />
          <form onSubmit={handleAICredSubmit} className="space-y-4">
            <div>
              <Input
                label="DeepSeek API Key"
                type="password"
                value={aiCredentials.DEEPSEEK_API_KEY}
                onChange={handleAICredChange("DEEPSEEK_API_KEY")}
                placeholder="输入 DeepSeek API Key"
                hint={
                  <a
                    href="https://platform.deepseek.com/api_keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    获取 API Key
                  </a>
                }
              />
            </div>
            <div>
              <Input
                label="Tavily API Key"
                type="password"
                value={aiCredentials.TAVILY_API_KEY || ""}
                onChange={handleAICredChange("TAVILY_API_KEY")}
                placeholder="输入 Tavily API Key（可选）"
                hint="用于新闻舆情分析，免费 1000 次/月"
              />
            </div>
            <div>
              <Input
                label="EODHD API Key"
                type="password"
                value={aiCredentials.EODHD_API_KEY || ""}
                onChange={handleAICredChange("EODHD_API_KEY")}
                placeholder="输入 EODHD API Key（可选）"
                hint="用于板块轮动分析，免费 20 次/天"
              />
            </div>
            <div className="pt-2">
              <Button type="submit" icon={<Save className="w-4 h-4" />}>
                保存 AI 配置
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Stock List */}
      <Card>
        <CardHeader
          title="股票列表"
          description="每行一个股票代码，如 AAPL.US 或 700.HK"
          icon={<FormatListBulleted className="w-5 h-5" />}
          action={
            <Badge variant="default">{parsedSymbols.length} 只股票</Badge>
          }
        />
        <form onSubmit={handleSymbolSubmit}>
          <textarea
            className="w-full h-40 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600
              bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
              placeholder:text-slate-400 resize-none"
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
            placeholder="AAPL.US&#10;TSLA.US&#10;700.HK&#10;NVDA.US"
          />
          <div className="flex justify-end mt-4">
            <Button type="submit" icon={<Save className="w-4 h-4" />}>
              保存列表
            </Button>
          </div>
        </form>
      </Card>

      {/* History Sync */}
      <Card>
        <CardHeader
          title="历史 K 线同步"
          description="从 Longbridge API 同步数据至本地数据库"
          icon={<Timeline className="w-5 h-5" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Select
            label="周期"
            value={historyPeriod}
            onChange={(e) => setHistoryPeriod(e.target.value)}
            options={PERIOD_OPTIONS}
          />
          <Select
            label="复权类型"
            value={historyAdjust}
            onChange={(e) => setHistoryAdjust(e.target.value)}
            options={ADJUST_OPTIONS}
          />
          <Input
            label="数据条数"
            type="number"
            value={historyCount}
            onChange={(e) => setHistoryCount(Number(e.target.value) || 0)}
            min={1}
            max={1000}
          />
          <Select
            label="预览股票"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            options={
              symbolList.length === 0
                ? [{ value: "", label: "请先保存股票列表" }]
                : symbolList.map((sym) => ({ value: sym, label: sym }))
            }
          />
        </div>

        <div className="flex gap-3 mb-6">
          <Button
            onClick={handleHistorySync}
            loading={historyLoading}
            disabled={parsedSymbols.length === 0}
            icon={<Sync className="w-4 h-4" />}
          >
            同步历史数据
          </Button>
          <Button
            variant="secondary"
            onClick={handleHistoryFetch}
            loading={historyLoading}
            disabled={!selectedSymbol}
            icon={<Visibility className="w-4 h-4" />}
          >
            预览最近数据
          </Button>
        </div>

        {/* Data Preview */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 max-h-64 overflow-y-auto">
          {historyBars.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
              暂无数据，点击"同步历史数据"并"预览最近数据"查看结果
            </p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              <div className="grid grid-cols-6 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-700">
                <span>时间</span>
                <span className="text-right">开盘</span>
                <span className="text-right">最高</span>
                <span className="text-right">最低</span>
                <span className="text-right">收盘</span>
                <span className="text-right">成交量</span>
              </div>
              {historyBars.slice(0, 20).map((bar, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-6 gap-2 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  <span className="text-cyan-600 dark:text-cyan-400">
                    {new Date(bar.ts).toLocaleDateString()}
                  </span>
                  <span className="text-right">{bar.open?.toFixed(2)}</span>
                  <span className="text-right text-emerald-600 dark:text-emerald-400">
                    {bar.high?.toFixed(2)}
                  </span>
                  <span className="text-right text-red-600 dark:text-red-400">
                    {bar.low?.toFixed(2)}
                  </span>
                  <span className="text-right font-medium">{bar.close?.toFixed(2)}</span>
                  <span className="text-right text-slate-500">
                    {(bar.volume / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <StatusSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />

      <ErrorDialog
        open={errorDialog.open}
        error={errorDialog.error}
        title={errorDialog.title}
        onClose={() => setErrorDialog({ open: false, error: null })}
      />
    </div>
  );
}
