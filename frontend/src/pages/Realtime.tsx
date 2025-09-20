import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Fade,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as WalletIcon,
  Paid as PaidIcon,
  ShowChart as ChartIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as BankIcon,
  CreditCard as CreditIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

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
  color = "primary",
  isRefreshing = false,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "primary" | "success" | "error" | "warning" | "info";
  isRefreshing?: boolean;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: (theme) => `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        background: (theme) => alpha(theme.palette[color].main, 0.06),
        p: 2.5,
        height: '100%',
        display: "flex",
        alignItems: "center",
        gap: 2,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        transform: isRefreshing ? 'scale(0.98)' : 'scale(1)',
        opacity: isRefreshing ? 0.8 : 1,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette[color].main, 0.2)}`,
        }
      }}
    >
      {isRefreshing && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '100%',
              bgcolor: 'white',
              opacity: 0.3,
              animation: 'flash 0.6s ease',
              '@keyframes flash': {
                '0%': { opacity: 0 },
                '50%': { opacity: 0.3 },
                '100%': { opacity: 0 },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              bgcolor: color + '.main',
              animation: 'loading 1s infinite linear',
              '@keyframes loading': {
                '0%': { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(100%)' },
              },
            }}
          />
        </>
      )}
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: (theme) => alpha(theme.palette[color].main, 0.12),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: (theme) => theme.palette[color].main,
          animation: isRefreshing ? 'rotate 1s linear infinite' : 'none',
          '@keyframes rotate': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            transition: 'opacity 0.3s ease',
            opacity: isRefreshing ? 0.5 : 1,
          }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
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

    // Add a small delay for animation effect
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const res = await fetchPortfolioOverview();
      setPortfolioPositions(res.positions);

      // Handle totals with day P&L
      const totals = res.totals as Totals;
      setPortfolioTotals({
        ...totals,
        day_pnl: totals.day_pnl || 0,
        day_pnl_percent: totals.day_pnl_percent || 0,
      });

      // Handle account balance
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

        // Handle portfolio updates
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

        // Handle status updates
        if (data.type === "status") {
          if (Array.isArray(data.subscribed)) {
            setStatusSubscribed(data.subscribed);
          }
          return;
        }

        // Handle quote updates
        setEventLog((prev) => [data, ...prev].slice(0, logLimit));
        setPortfolioPositions((prev) => {
          if (!prev.length) {
            return prev;
          }
          const idx = prev.findIndex((item) => item.symbol === data.symbol);
          if (idx === -1) {
            return prev;
          }
          const lastPrice = data.last_done ?? prev[idx].last_price ?? null;
          if (lastPrice === null) {
            return prev;
          }
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
          // 保留后端 day_pnl/day_pnl_percent，不在增量行情时覆盖；总盈亏与市值本地重算
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

  // Calculate aggregated values - USD only, strict mapping
  const usdBalance =
    accountBalance['USD'] ??
    (Object.entries(accountBalance).find(
      ([k, v]: [string, any]) => k?.toUpperCase?.() === 'USD' || (v && v.currency === 'USD')
    )?.[1] as any) ??
    null;

  // 可用现金（优先 available_cash，其次 cash_balance/total_cash）
  const totalCash: number =
    (usdBalance?.available_cash ?? 0) as number;

  // 融资欠款（优先 finance_used，其次 debit）
  const totalFinanceUsed: number =
    (usdBalance?.finance_used ?? usdBalance?.debit ?? 0) as number;

  // 冻结资金
  const frozenCash: number = (usdBalance?.frozen_cash ?? 0) as number;

  // 总资产（现金 + 持仓市值），按你的口径要求
  const displayTotalAssets: number =
    (totalCash + portfolioTotals.market_value) as number;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header Card */}
        <Paper elevation={2} sx={{
          p: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              transform: 'translate(100px, -100px)',
            }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                投资组合概览
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', mt: 1 }}>
                实时监控 · 自动更新 · {statusSubscribed.length} 只股票订阅
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={socketStatus}
                sx={{
                  bgcolor: socketStatus === "CONNECTED" ? '#4caf50' : socketStatus === "ERROR" ? '#f44336' : '#9e9e9e',
                  color: 'white',
                  fontWeight: 600,
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={refreshPortfolio}
                disabled={portfolioLoading}
                startIcon={<RefreshIcon sx={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  }
                }} />}
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                }}
              >
                {portfolioLoading ? "刷新中..." : "刷新"}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* KPI Cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <KpiCard
              title="总资产"
              value={`$${formatCurrency(displayTotalAssets)}`}
              subtitle="口径：现金+持仓市值（USD）"
              icon={<BankIcon sx={{ fontSize: 28 }} />}
              color="primary"
              isRefreshing={isRefreshing}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <KpiCard
              title="现金"
              value={`$${formatCurrency(totalCash)}`}
              subtitle="可用资金"
              icon={<MoneyIcon sx={{ fontSize: 28 }} />}
              color="info"
              isRefreshing={isRefreshing}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <KpiCard
              title="持仓市值"
              value={`$${formatCurrency(portfolioTotals.market_value)}`}
              subtitle={`成本: $${formatCurrency(portfolioTotals.cost)}`}
              icon={<TrendingUpIcon sx={{ fontSize: 28 }} />}
              color="success"
              isRefreshing={isRefreshing}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <KpiCard
              title="总盈亏"
              value={`$${formatCurrency(portfolioTotals.pnl)}`}
              subtitle={formatPercent(portfolioTotals.pnl_percent)}
              icon={<PaidIcon sx={{ fontSize: 28 }} />}
              color={portfolioTotals.pnl >= 0 ? "success" : "error"}
              isRefreshing={isRefreshing}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <KpiCard
              title="当日盈亏"
              value={`$${formatCurrency(portfolioTotals.day_pnl || 0)}`}
              subtitle={formatPercent(portfolioTotals.day_pnl_percent || 0)}
              icon={<ChartIcon sx={{ fontSize: 28 }} />}
              color={(portfolioTotals.day_pnl || 0) >= 0 ? "success" : "error"}
              isRefreshing={isRefreshing}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <KpiCard
              title="融资欠款"
              value={`$${formatCurrency(totalFinanceUsed)}`}
              subtitle="已用融资额度"
              icon={<CreditIcon sx={{ fontSize: 28 }} />}
              color="warning"
              isRefreshing={isRefreshing}
            />
          </Grid>
        </Grid>

        {/* Account Balance Details - Only show USD */}
        {usdBalance && Object.keys(usdBalance).length > 0 && (
          <Fade in={true} timeout={600}>
            <Card elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                账户资金明细 (USD)
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'blue.50',
                    border: '1px solid',
                    borderColor: 'blue.200',
                  }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      可用现金
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'blue.700' }}>
                      ${formatCurrency(totalCash)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'orange.50',
                    border: '1px solid',
                    borderColor: 'orange.200',
                  }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      融资欠款
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'orange.700' }}>
                      ${formatCurrency(totalFinanceUsed || usdBalance?.debit || 0)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'green.50',
                    border: '1px solid',
                    borderColor: 'green.200',
                  }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      持仓市值
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'green.700' }}>
                      ${formatCurrency(portfolioTotals.market_value)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'purple.50',
                    border: '1px solid',
                    borderColor: 'purple.200',
                  }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      总资产（现金+持仓）
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'purple.700' }}>
                      ${formatCurrency(displayTotalAssets)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'red.50',
                    border: '1px solid',
                    borderColor: 'red.200',
                  }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      冻结资金
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'red.700' }}>
                      ${formatCurrency(frozenCash)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Card>
          </Fade>
        )}

        {/* Portfolio Positions with animation */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              持仓明细
            </Typography>
            <Typography variant="body2" color="text.secondary">
              数据每5秒自动刷新，盈亏基于成本价和最新价计算
            </Typography>
          </Stack>

          <Box sx={{ position: 'relative', minHeight: 400 }}>
            <Box
              sx={{
                transition: 'all 0.5s ease',
                transform: isRefreshing ? 'scale(0.99)' : 'scale(1)',
                opacity: isRefreshing ? 0.6 : 1,
              }}
            >
              {portfolioPositions.length === 0 ? (
                <Box sx={{
                  textAlign: 'center',
                  py: 8,
                  bgcolor: 'grey.50',
                  borderRadius: 2
                }}>
                  <Typography variant="body1" color="text.secondary">
                    当前账户暂无股票持仓
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {isRefreshing && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        bgcolor: 'primary.main',
                        zIndex: 1000,
                        animation: 'slideProgress 0.8s ease',
                        '@keyframes slideProgress': {
                          '0%': { transform: 'translateX(-100%)' },
                          '100%': { transform: 'translateX(100%)' },
                        },
                      }}
                    />
                  )}
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 600 }}>代码</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>名称</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>方向</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>持仓</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>可用</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>成本价</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>现价</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>成本</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>市值</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>盈亏</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>盈亏%</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>当日盈亏</TableCell>
                      </TableRow>
                    </TableHead>
                      <TableBody>
                        {portfolioPositions.map((position, index) => {
                          const pnlPositive = position.pnl >= 0;
                          const dayPnl = (position as any).day_pnl || 0;
                          const dayPnlPercent = (position as any).day_pnl_percent || 0;
                          const dayPnlPositive = dayPnl >= 0;

                          return (
                            <TableRow
                              key={position.symbol}
                              hover
                              sx={{
                                transition: 'all 0.3s ease',
                                animation: isRefreshing ? `rowRefresh 0.6s ease ${index * 0.05}s` : 'none',
                                '@keyframes rowRefresh': {
                                  '0%': {
                                    transform: 'translateX(0)',
                                    backgroundColor: 'transparent'
                                  },
                                  '50%': {
                                    transform: 'translateX(5px)',
                                    backgroundColor: 'rgba(66, 165, 245, 0.1)'
                                  },
                                  '100%': {
                                    transform: 'translateX(0)',
                                    backgroundColor: 'transparent'
                                  },
                                },
                              }}
                            >
                                <TableCell>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    {position.symbol}
                                  </Typography>
                                </TableCell>
                                <TableCell>{position.symbol_name ?? "-"}</TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={position.direction === "short" ? "空" : "多"}
                                    color={position.direction === "short" ? "warning" : "success"}
                                    sx={{ fontWeight: 600 }}
                                  />
                                </TableCell>
                                <TableCell align="right">{formatNumber(position.qty, 0)}</TableCell>
                                <TableCell align="right">
                                  {position.available_quantity != null ? formatNumber(position.available_quantity, 0) : "-"}
                                </TableCell>
                                <TableCell align="right">${formatCurrency(position.avg_price)}</TableCell>
                                <TableCell align="right">
                                  {position.last_price != null ? (
                                    <Typography sx={{ fontWeight: 600 }}>
                                      ${formatCurrency(position.last_price)}
                                    </Typography>
                                  ) : "-"}
                                </TableCell>
                                <TableCell align="right">${formatCurrency(position.cost_value)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  ${formatCurrency(position.market_value)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    color: pnlPositive ? "success.main" : "error.main",
                                    fontWeight: 600
                                  }}
                                >
                                  ${formatCurrency(position.pnl)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    color: pnlPositive ? "success.main" : "error.main",
                                    fontWeight: 600
                                  }}
                                >
                                  {formatPercent(position.pnl_percent)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    color: dayPnlPositive ? "success.main" : "error.main",
                                    fontWeight: 600
                                  }}
                                >
                                  ${formatCurrency(dayPnl)}
                                  <Typography variant="caption" display="block">
                                    {formatPercent(dayPnlPercent)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

            {/* Loading overlay */}
            <Fade in={portfolioLoading} timeout={300}>
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.8)',
                borderRadius: 2,
              }}>
                <CircularProgress />
              </Box>
            </Fade>
          </Box>
        </Paper>

        {/* WebSocket Event Log */}
        <Paper elevation={1} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            实时数据流（最近 {logLimit} 条）
          </Typography>
          <Box
            sx={{
              bgcolor: "#0d1117",
              color: "#d1d5db",
              borderRadius: 2,
              p: 2,
              maxHeight: 320,
              overflowY: "auto",
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {eventLog.length === 0 ? (
              <Typography variant="body2" color="inherit">
                等待实时数据推送...
              </Typography>
            ) : (
              eventLog.map((evt, idx) => (
                <Box key={`${evt.symbol}-${evt.sequence ?? idx}`} sx={{ mb: 0.5 }}>
                  <span style={{ color: '#58a6ff' }}>[{new Date().toLocaleTimeString()}]</span> {JSON.stringify(evt)}
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Tick Data Query */}
        <Paper elevation={1} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            历史 Tick 数据查询
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              label="股票代码"
              value={symbolQuery}
              onChange={(e) => setSymbolQuery(e.target.value.toUpperCase())}
              placeholder="如：700.HK 或 AAPL.US"
              size="small"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleFetchTicks}
              disabled={tickLoading}
              sx={{ minWidth: 120 }}
            >
              {tickLoading ? "查询中..." : "查询"}
            </Button>
          </Stack>
          <Box
            sx={{
              mt: 2,
              bgcolor: "grey.50",
              borderRadius: 2,
              p: 2,
              maxHeight: 260,
              overflowY: "auto",
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: 12,
            }}
          >
            {tickLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : tickData.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">
                暂无数据，请输入股票代码并查询
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell align="right">价格</TableCell>
                    <TableCell align="right">成交量</TableCell>
                    <TableCell align="right">序号</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickData.map((tick, idx) => (
                    <TableRow key={`${tick.ts}-${idx}`}>
                      <TableCell>{new Date(tick.ts).toLocaleString()}</TableCell>
                      <TableCell align="right">${tick.price ?? "-"}</TableCell>
                      <TableCell align="right">{tick.volume ?? "-"}</TableCell>
                      <TableCell align="right">{tick.sequence ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
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