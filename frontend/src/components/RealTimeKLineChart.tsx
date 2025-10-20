import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Chip, Stack, CircularProgress } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { resolveWsUrl } from '../api/client';

interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RealTimeKLineChartProps {
  symbol: string;
  height?: number;
  showVolume?: boolean;
  maxDataPoints?: number;
}

export default function RealTimeKLineChart({
  symbol,
  height = 300,
  showVolume = true,
  maxDataPoints = 100
}: RealTimeKLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // 连接 WebSocket 接收实时数据
  useEffect(() => {
    const wsUrl = resolveWsUrl('/ws/quotes');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`WebSocket connected for ${symbol}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 处理实时行情数据
        if (data.type === 'quote' && data.symbol === symbol) {
          const newPrice = data.last_done || data.close;
          if (newPrice) {
            setCurrentPrice(newPrice);
            
            // 更新 K 线数据（简化版：每次更新都作为一个新数据点）
            setKlineData((prev) => {
              const newData: KLineData = {
                timestamp: Date.now(),
                open: prev.length > 0 ? prev[prev.length - 1].close : newPrice,
                high: newPrice,
                low: newPrice,
                close: newPrice,
                volume: data.volume || 0
              };
              
              const updated = [...prev, newData];
              // 限制数据点数量
              if (updated.length > maxDataPoints) {
                return updated.slice(updated.length - maxDataPoints);
              }
              return updated;
            });
            
            // 计算涨跌
            if (klineData.length > 0) {
              const change = ((newPrice - klineData[0].close) / klineData[0].close) * 100;
              setPriceChange(change);
            }
            
            setLoading(false);
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setLoading(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    wsRef.current = ws;

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol, maxDataPoints]);

  // 绘制 K 线图
  useEffect(() => {
    if (!canvasRef.current || klineData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 40;
    const chartHeight = showVolume ? height * 0.7 : height - padding * 2;
    const volumeHeight = showVolume ? height * 0.2 : 0;
    const chartWidth = canvas.width - padding * 2;

    // 计算价格范围
    const prices = klineData.flatMap(d => [d.high, d.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;

    const maxVolume = Math.max(...klineData.map(d => d.volume));

    // 绘制网格线
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();

      // 价格标签
      const price = maxPrice - (priceRange / 5) * i;
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), padding - 5, y + 3);
    }

    // 绘制 K 线
    const candleWidth = Math.max(2, chartWidth / klineData.length - 2);
    
    klineData.forEach((data, index) => {
      const x = padding + (index / klineData.length) * chartWidth;
      
      // 计算 Y 坐标
      const openY = padding + ((maxPrice - data.open) / priceRange) * chartHeight;
      const closeY = padding + ((maxPrice - data.close) / priceRange) * chartHeight;
      const highY = padding + ((maxPrice - data.high) / priceRange) * chartHeight;
      const lowY = padding + ((maxPrice - data.low) / priceRange) * chartHeight;

      // 颜色：涨红跌绿
      const isRising = data.close >= data.open;
      ctx.fillStyle = isRising ? '#f44336' : '#4caf50';
      ctx.strokeStyle = isRising ? '#f44336' : '#4caf50';

      // 绘制上下影线
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, highY);
      ctx.lineTo(x + candleWidth / 2, lowY);
      ctx.stroke();

      // 绘制实体
      const bodyHeight = Math.abs(closeY - openY);
      const bodyY = Math.min(openY, closeY);
      if (bodyHeight < 1) {
        // 十字星
        ctx.fillRect(x, bodyY, candleWidth, 1);
      } else {
        ctx.fillRect(x, bodyY, candleWidth, bodyHeight);
      }

      // 绘制成交量
      if (showVolume && data.volume > 0) {
        const volumeY = padding + chartHeight + 20;
        const volumeBarHeight = (data.volume / maxVolume) * volumeHeight;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, volumeY + volumeHeight - volumeBarHeight, candleWidth, volumeBarHeight);
        ctx.globalAlpha = 1.0;
      }
    });

    // 绘制当前价格线
    if (currentPrice > 0) {
      const currentY = padding + ((maxPrice - currentPrice) / priceRange) * chartHeight;
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, currentY);
      ctx.lineTo(canvas.width - padding, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 价格标签
      ctx.fillStyle = '#2196f3';
      ctx.fillRect(canvas.width - padding + 2, currentY - 8, 45, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(currentPrice.toFixed(2), canvas.width - padding + 5, currentY + 3);
    }

  }, [klineData, currentPrice, height, showVolume]);

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, bgcolor: '#fafafa' }}>
      {/* 头部信息 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight="bold">
          {symbol}
        </Typography>
        {loading ? (
          <CircularProgress size={20} />
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" fontWeight="bold" color={priceChange >= 0 ? 'error.main' : 'success.main'}>
              {currentPrice.toFixed(2)}
            </Typography>
            <Chip
              icon={priceChange >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`}
              color={priceChange >= 0 ? 'error' : 'success'}
              size="small"
            />
          </Stack>
        )}
      </Stack>

      {/* K 线图画布 */}
      <canvas
        ref={canvasRef}
        width={600}
        height={height}
        style={{ width: '100%', height: `${height}px` }}
      />

      {/* 数据点数量提示 */}
      {klineData.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          实时数据点: {klineData.length} / {maxDataPoints}
        </Typography>
      )}
    </Box>
  );
}

