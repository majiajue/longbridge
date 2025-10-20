import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { init, dispose } from 'klinecharts';

interface Position {
  symbol: string;
  symbol_name: string;
  qty: number;
  avg_price: number;
  market_value: number;
  pnl: number;
  pnl_percent: number;
}

interface CandlestickBar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function PositionKLinesPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [candlesticks, setCandlesticks] = useState<CandlestickBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('day');
  
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  // 加载持仓列表
  const loadPositions = async () => {
    try {
      setLoading(true);
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/portfolio/overview`);
      
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
        
        // 默认选择第一只股票
        if (data.positions && data.positions.length > 0 && !selectedSymbol) {
          setSelectedSymbol(data.positions[0].symbol);
        }
        
        setError(null);
      } else {
        setError('Failed to load positions');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 加载K线数据
  const loadCandlesticks = async (symbol: string) => {
    if (!symbol) return;
    
    try {
      setChartLoading(true);
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(
        `${base}/quotes/history?symbol=${symbol}&period=${period}&limit=200`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCandlesticks(data.bars || []);
        setError(null);
      } else {
        setError(`Failed to load candlesticks for ${symbol}`);
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      console.error(e);
    } finally {
      setChartLoading(false);
    }
  };

  // 初始化图表
  useEffect(() => {
    if (!chartRef.current) return;

    // 创建图表实例
    const chart = init(chartRef.current, {
      styles: {
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#26A69A',
            downColor: '#EF5350',
            upBorderColor: '#26A69A',
            downBorderColor: '#EF5350',
            upWickColor: '#26A69A',
            downWickColor: '#EF5350',
          },
        },
        grid: {
          show: true,
          horizontal: {
            color: '#f0f0f0',
          },
          vertical: {
            color: '#f0f0f0',
          },
        },
      },
    });

    chartInstance.current = chart;

    return () => {
      if (chartInstance.current) {
        dispose(chartRef.current!);
        chartInstance.current = null;
      }
    };
  }, []);

  // 更新图表数据
  useEffect(() => {
    if (!chartInstance.current || candlesticks.length === 0) return;

    try {
      // 转换数据格式
      const klineData = candlesticks.map((bar) => ({
        timestamp: new Date(bar.ts).getTime(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      }));

      // 按时间排序（从旧到新）
      klineData.sort((a, b) => a.timestamp - b.timestamp);

      // 应用数据到图表
      chartInstance.current.applyNewData(klineData);
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [candlesticks]);

  // 初始加载
  useEffect(() => {
    loadPositions();
  }, []);

  // 加载K线
  useEffect(() => {
    if (selectedSymbol) {
      loadCandlesticks(selectedSymbol);
    }
  }, [selectedSymbol, period]);

  // 获取选中股票的详情
  const selectedPosition = positions.find(p => p.symbol === selectedSymbol);

  // 刷新
  const handleRefresh = () => {
    loadPositions();
    if (selectedSymbol) {
      loadCandlesticks(selectedSymbol);
    }
  };

  return (
    <Box className="animate-fade-in">
      {/* 头部 */}
      <Card className="bg-gradient-to-br from-blue-600 to-purple-700 text-white mb-6">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                持仓K线图表
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                查看持仓股票的历史K线走势
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={`${positions.length} 只持仓`}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
              />
              <Button
                variant="contained"
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={loading || chartLoading}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
              >
                刷新
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {loading && !positions.length && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && positions.length === 0 && (
        <Alert severity="info">
          暂无持仓股票，请先买入股票或检查 ACCESS_TOKEN 是否有效
        </Alert>
      )}

      {positions.length > 0 && (
        <Grid container spacing={3}>
          {/* 左侧：持仓列表 */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  持仓列表
                </Typography>
                <Stack spacing={1}>
                  {positions.map((pos) => (
                    <Card
                      key={pos.symbol}
                      onClick={() => setSelectedSymbol(pos.symbol)}
                      sx={{
                        cursor: 'pointer',
                        border: selectedSymbol === pos.symbol ? '2px solid #1976d2' : '1px solid #e0e0e0',
                        bgcolor: selectedSymbol === pos.symbol ? '#e3f2fd' : 'white',
                        '&:hover': {
                          bgcolor: '#f5f5f5',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {pos.symbol}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {pos.symbol_name}
                        </Typography>
                        <Stack direction="row" spacing={1} mt={1}>
                          <Chip
                            size="small"
                            label={`${pos.qty || 0} 股`}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            icon={(pos.pnl || 0) >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                            label={`${(pos.pnl || 0) >= 0 ? '+' : ''}${((pos.pnl_percent || 0)).toFixed(2)}%`}
                            color={(pos.pnl || 0) >= 0 ? 'success' : 'error'}
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* 右侧：K线图 */}
          <Grid item xs={12} md={9}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {selectedPosition?.symbol} - {selectedPosition?.symbol_name}
                    </Typography>
                    {selectedPosition && (
                      <Stack direction="row" spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                          持仓: {selectedPosition.qty || 0} 股
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          成本: ${(selectedPosition.avg_price || 0).toFixed(2)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color={(selectedPosition.pnl || 0) >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {(selectedPosition.pnl || 0) >= 0 ? '+' : ''}
                          ${(selectedPosition.pnl || 0).toFixed(2)} (
                          {(selectedPosition.pnl || 0) >= 0 ? '+' : ''}
                          {((selectedPosition.pnl_percent || 0)).toFixed(2)}%)
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>周期</InputLabel>
                    <Select
                      value={period}
                      label="周期"
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <MenuItem value="day">日线</MenuItem>
                      <MenuItem value="week">周线</MenuItem>
                      <MenuItem value="month">月线</MenuItem>
                      <MenuItem value="min_1">1分钟</MenuItem>
                      <MenuItem value="min_5">5分钟</MenuItem>
                      <MenuItem value="min_15">15分钟</MenuItem>
                      <MenuItem value="min_60">60分钟</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                {chartLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                )}

                {!chartLoading && candlesticks.length === 0 && (
                  <Alert severity="warning">
                    该股票暂无K线数据，请先同步历史数据
                  </Alert>
                )}

                <Box
                  ref={chartRef}
                  sx={{
                    width: '100%',
                    height: 500,
                    display: chartLoading || candlesticks.length === 0 ? 'none' : 'block',
                  }}
                />

                {candlesticks.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary">
                      共 {candlesticks.length} 根K线 | 
                      最早: {new Date(candlesticks[candlesticks.length - 1]?.ts).toLocaleDateString()} | 
                      最新: {new Date(candlesticks[0]?.ts).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
