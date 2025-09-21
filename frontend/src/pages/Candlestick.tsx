import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Container,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  Paper,
  Grid,
  SelectChangeEvent,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { StatusSnackbar } from '../components/StatusSnackbar';
import { getCandlesticks, syncCandlesticks } from '../api/quotes';

interface CandlestickData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const Candlestick: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [symbol, setSymbol] = useState('700.HK');
  const [period, setPeriod] = useState('day');
  const [adjustType, setAdjustType] = useState('forward_adjust');
  const [count, setCount] = useState(120);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Predefined symbols for autocomplete
  const symbolOptions = [
    '700.HK', '0005.HK', '9988.HK', '3690.HK', '2318.HK',
    'AAPL.US', 'GOOGL.US', 'MSFT.US', 'TSLA.US', 'NVDA.US',
    'BABA.US', 'JD.US', 'BIDU.US', 'PDD.US', 'NIO.US'
  ];

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Load candlestick data
  const loadData = useCallback(async () => {
    if (!symbol) {
      setSnackbar({
        open: true,
        message: '请输入股票代码',
        severity: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const data = await getCandlesticks(symbol, 500, period, adjustType);

      if (data.bars && data.bars.length > 0) {
        // Convert data format for lightweight-charts
        const candlestickData = data.bars.map((bar: CandlestickData) => ({
          time: bar.time.split('T')[0] as Time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));

        const volumeData = data.bars.map((bar: CandlestickData) => ({
          time: bar.time.split('T')[0] as Time,
          value: bar.volume,
          color: bar.close >= bar.open ? '#26a69a' : '#ef5350',
        }));

        // Sort data by time
        candlestickData.sort((a, b) => (a.time as string).localeCompare(b.time as string));
        volumeData.sort((a, b) => (a.time as string).localeCompare(b.time as string));

        if (candlestickSeriesRef.current) {
          candlestickSeriesRef.current.setData(candlestickData);
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(volumeData);
        }

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        setSnackbar({
          open: true,
          message: `加载了 ${data.bars.length} 条K线数据`,
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: '没有找到数据，请先同步历史数据',
          severity: 'info',
        });
      }
    } catch (error) {
      console.error('Failed to load candlestick data:', error);
      setSnackbar({
        open: true,
        message: `加载失败: ${error}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [symbol, period, adjustType]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []); // Only run once on mount

  // Sync historical data
  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const symbols = symbol ? [symbol] : undefined;
      const result = await syncCandlesticks(symbols, period, adjustType, count);

      const totalRecords = Object.values(result.processed).reduce(
        (sum, val) => sum + (val as number),
        0
      );

      setSnackbar({
        open: true,
        message: `同步完成: ${totalRecords} 条记录`,
        severity: 'success',
      });

      // Reload data after sync
      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
      setSnackbar({
        open: true,
        message: `同步失败: ${error}`,
        severity: 'error',
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePeriodChange = (event: SelectChangeEvent) => {
    setPeriod(event.target.value);
  };

  const handleAdjustTypeChange = (event: SelectChangeEvent) => {
    setAdjustType(event.target.value);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        K线图表
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <Autocomplete
              freeSolo
              options={symbolOptions}
              value={symbol}
              onChange={(_, newValue) => setSymbol(newValue || '')}
              onInputChange={(_, newValue) => setSymbol(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="股票代码"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>周期</InputLabel>
              <Select value={period} onChange={handlePeriodChange} label="周期">
                <MenuItem value="min1">1分钟</MenuItem>
                <MenuItem value="min5">5分钟</MenuItem>
                <MenuItem value="min15">15分钟</MenuItem>
                <MenuItem value="min30">30分钟</MenuItem>
                <MenuItem value="min60">60分钟</MenuItem>
                <MenuItem value="day">日线</MenuItem>
                <MenuItem value="week">周线</MenuItem>
                <MenuItem value="month">月线</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>复权类型</InputLabel>
              <Select
                value={adjustType}
                onChange={handleAdjustTypeChange}
                label="复权类型"
              >
                <MenuItem value="no_adjust">不复权</MenuItem>
                <MenuItem value="forward_adjust">前复权</MenuItem>
                <MenuItem value="backward_adjust">后复权</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="数量"
              type="number"
              size="small"
              fullWidth
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              inputProps={{ min: 1, max: 1000 }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="contained"
              onClick={loadData}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={20} /> : '加载数据'}
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="outlined"
              onClick={handleSync}
              disabled={syncLoading}
              fullWidth
            >
              {syncLoading ? <CircularProgress size={20} /> : '同步历史'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, height: 550, position: 'relative' }}>
        <Box ref={chartContainerRef} sx={{ height: '100%' }} />
      </Paper>

      <StatusSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </Container>
  );
};