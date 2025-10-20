import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Stack,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import RefreshIcon from '@mui/icons-material/Refresh';
import RealTimeKLineChart from '../components/RealTimeKLineChart';

interface StrategySignal {
  symbol: string;
  current_price: number;
  is_position: boolean;  // 是否持仓
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
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [positionCount, setPositionCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);

  // 加载监控列表信号
  const loadWatchlistSignals = async () => {
    try {
      setLoading(true);
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/advanced/watchlist/signals`);
      
      if (response.ok) {
        const data = await response.json();
        setWatchlistSignals(data.signals || []);
        setPositionCount(data.position_count || 0);
        setManualCount(data.manual_count || 0);
        setLastUpdate(new Date());
        
        // 如果有持仓但没有信号，给出提示
        if ((data.position_count > 0 || data.manual_count > 0) && data.signals.length === 0) {
          setError('检测到股票但没有K线数据，请先同步历史数据（在「关于行情」页面点击「同步历史数据」）');
        } else {
          setError(null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail?.message || errorData.message || 'Failed to load signals');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlistSignals();
    
    // 每30秒自动刷新
    const interval = setInterval(loadWatchlistSignals, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // 获取推荐颜色
  const getActionColor = (action: string): 'success' | 'error' | 'default' => {
    if (action === 'BUY') return 'success';
    if (action === 'SELL') return 'error';
    return 'default';
  };

  // 获取置信度颜色
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return '#4caf50';
    if (confidence >= 0.5) return '#ff9800';
    return '#f44336';
  };

  return (
    <Box className="animate-fade-in">
      {/* 头部 */}
      <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white mb-6">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                策略盯盘
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                实时监控买低卖高和 EMA 策略信号
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                icon={<ShowChartIcon />}
                label={`持仓 ${positionCount} | 监控 ${manualCount}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
              />
              <Chip
                label={`共 ${watchlistSignals.length} 只`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }}
              />
              <Chip
                label={lastUpdate ? lastUpdate.toLocaleTimeString() : '未更新'}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }}
              />
              <Button
                variant="contained"
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={loadWatchlistSignals}
                disabled={loading}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
              >
                刷新
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {loading && !watchlistSignals.length && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 标签页 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="信号概览" icon={<ShowChartIcon />} iconPosition="start" />
          <Tab label="实时 K 线" icon={<TimelineIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* 信号概览 */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>股票</TableCell>
                <TableCell>当前价</TableCell>
                <TableCell>买低卖高</TableCell>
                <TableCell>EMA 交叉</TableCell>
                <TableCell>综合建议</TableCell>
                <TableCell>置信度</TableCell>
                <TableCell>一致性</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {watchlistSignals.map((item) => (
                <TableRow key={item.symbol} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight="bold">{item.symbol}</Typography>
                      {item.is_position && (
                        <Chip 
                          label="持仓" 
                          size="small" 
                          color="success" 
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="bold">
                      ${item.current_price.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.signals.buy_low_sell_high ? (
                      <Chip
                        label={item.signals.buy_low_sell_high.action}
                        color={getActionColor(item.signals.buy_low_sell_high.action)}
                        size="small"
                      />
                    ) : (
                      <Chip label="无信号" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.signals.ema_crossover ? (
                      <Chip
                        label={item.signals.ema_crossover.action}
                        color={getActionColor(item.signals.ema_crossover.action)}
                        size="small"
                      />
                    ) : (
                      <Chip label="无信号" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={
                        item.consensus.action === 'BUY' ? <TrendingUpIcon /> :
                        item.consensus.action === 'SELL' ? <TrendingDownIcon /> : undefined
                      }
                      label={item.consensus.action || 'HOLD'}
                      color={getActionColor(item.consensus.action)}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 60 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.consensus.confidence * 100}
                          sx={{
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: getConfidenceColor(item.consensus.confidence)
                            }
                          }}
                        />
                      </Box>
                      <Typography variant="caption">
                        {(item.consensus.confidence * 100).toFixed(0)}%
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {item.consensus.buy_count + item.consensus.sell_count} 策略
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setTabValue(1);
                      }}
                    >
                      查看 K 线
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {watchlistSignals.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      当前没有信号，请配置监控股票
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 实时 K 线 */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          {watchlistSignals.length === 0 && !loading ? (
            <Grid item xs={12}>
              <Alert severity="info">
                请先在「基础配置」中添加监控股票，或切换到「信号概览」查看已有信号
              </Alert>
            </Grid>
          ) : (
            watchlistSignals.map((item) => (
              <Grid item xs={12} md={6} key={item.symbol}>
                <Accordion
                  defaultExpanded={item.symbol === selectedSymbol}
                  sx={{ border: '1px solid #e0e0e0' }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%">
                      <Typography fontWeight="bold">{item.symbol}</Typography>
                      {item.consensus.action && item.consensus.action !== 'HOLD' && (
                        <Chip
                          label={item.consensus.action}
                          color={getActionColor(item.consensus.action)}
                          size="small"
                          sx={{ mr: 2 }}
                        />
                      )}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <RealTimeKLineChart
                      symbol={item.symbol}
                      height={250}
                      showVolume={true}
                      maxDataPoints={50}
                    />
                    
                    {/* 信号详情 */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        当前信号：
                      </Typography>
                      <Stack spacing={1}>
                        {item.signals.buy_low_sell_high && (
                          <Alert severity="info" icon={<ShowChartIcon />}>
                            <Typography variant="body2">
                              <strong>买低卖高：</strong>
                              {item.signals.buy_low_sell_high.reason}
                            </Typography>
                          </Alert>
                        )}
                        {item.signals.ema_crossover && (
                          <Alert severity="info" icon={<TimelineIcon />}>
                            <Typography variant="body2">
                              <strong>EMA 交叉：</strong>
                              {item.signals.ema_crossover.reason}
                            </Typography>
                          </Alert>
                        )}
                      </Stack>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            ))
          )}
        </Grid>
      )}
    </Box>
  );
}

