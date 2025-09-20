import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Paper elevation={1} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Longbridge 凭据配置
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            请填写从 Longbridge 开发者平台注册获得的凭据，仅存储在本地 DuckDB。
          </Typography>
          <Box component="form" onSubmit={handleCredSubmit} sx={{ mt: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="LONGPORT_APP_KEY"
                value={credentials.LONGPORT_APP_KEY}
                onChange={handleCredChange("LONGPORT_APP_KEY")}
                required
                fullWidth
              />
              <TextField
                label="LONGPORT_APP_SECRET"
                value={credentials.LONGPORT_APP_SECRET}
                onChange={handleCredChange("LONGPORT_APP_SECRET")}
                required
                fullWidth
              />
              <TextField
                label="LONGPORT_ACCESS_TOKEN"
                value={credentials.LONGPORT_ACCESS_TOKEN}
                onChange={handleCredChange("LONGPORT_ACCESS_TOKEN")}
                required
                fullWidth
              />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Button type="submit" variant="contained">
                  保存凭据
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? "验证中..." : "验证凭据与行情"}
                </Button>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Paper elevation={1} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            股票列表配置
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            每行填写一只股票代码，如：`AAPL.US` 或 `700.HK`。
          </Typography>
          <Box component="form" onSubmit={handleSymbolSubmit} sx={{ mt: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="股票代码"
                value={symbols}
                onChange={handleSymbolsChange}
                minRows={6}
                multiline
                placeholder={"AAPL.US\nTSLA.US\n700.HK"}
                fullWidth
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button type="submit" variant="contained">
                  保存列表
                </Button>
              </Box>
            </Stack>
          </Box>
        </Paper>

        <Paper elevation={1} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            历史 K 线同步与预览
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            调用 Longbridge `history_candlesticks_by_offset` 接口同步数据至本地 DuckDB，并可查看拉取结果样例。
          </Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="周期"
                value={historyPeriod}
                onChange={(e) => setHistoryPeriod(e.target.value)}
                fullWidth
              >
                {PERIOD_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="复权"
                value={historyAdjust}
                onChange={(e) => setHistoryAdjust(e.target.value)}
                fullWidth
              >
                {ADJUST_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="数量"
                type="number"
                value={historyCount}
                onChange={(e) => setHistoryCount(Number(e.target.value) || 0)}
                fullWidth
                inputProps={{ min: 1, max: 1000 }}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="预览股票"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                fullWidth
              >
                {symbolList.length === 0 ? (
                  <MenuItem value="" disabled>
                    请先保存股票列表
                  </MenuItem>
                ) : (
                  symbolList.map((sym) => (
                    <MenuItem key={sym} value={sym}>
                      {sym}
                    </MenuItem>
                  ))
                )}
              </TextField>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 2,
                  width: "100%",
                }}
              >
                <Button
                  variant="contained"
                  onClick={handleHistorySync}
                  disabled={historyLoading || parsedSymbols.length === 0}
                >
                  {historyLoading ? "执行中..." : "同步历史数据"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleHistoryFetch}
                  disabled={historyLoading || !selectedSymbol}
                >
                  预览最近数据
                </Button>
              </Box>
            </Stack>
            <Box
              sx={{
                bgcolor: "#fafafa",
                borderRadius: 2,
                p: 2,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {historyBars.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  暂无数据，点击“同步历史数据”并“预览最近数据”查看结果。
                </Typography>
              ) : (
                historyBars.slice(0, 20).map((bar) => (
                  <Box key={`${bar.ts}`} sx={{ mb: 1 }}>
                    <strong>{new Date(bar.ts).toLocaleString()}</strong>
                    {" — O:"}
                    {bar.open ?? "-"} H:{bar.high ?? "-"} L:{bar.low ?? "-"} C:{bar.close ?? "-"} V:{
                      bar.volume ?? "-"
                    }
                  </Box>
                ))
              )}
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <StatusSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </Container>
  );
}
