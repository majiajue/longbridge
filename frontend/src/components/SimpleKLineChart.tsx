import React, { useRef, useEffect, useState } from 'react';

interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingSignal {
  time: number;
  price: number;
  type: 'buy' | 'sell';
  strategy: string;
  confidence: number;
}

interface SimpleKLineChartProps {
  data: KLineData[];
  signals?: TradingSignal[];
  width?: number;
  height?: number;
}

export default function SimpleKLineChart({
  data,
  signals = [],
  width = 800,
  height = 400
}: SimpleKLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Chart margins
    const margin = { top: 20, right: 80, bottom: 60, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Find price range
    const prices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;

    // Scale functions
    const xScale = (index: number) => margin.left + (index * chartWidth) / (data.length - 1);
    const yScale = (price: number) => margin.top + ((maxPrice + padding - price) * chartHeight) / (priceRange + padding * 2);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (i * priceRange) / 5;
      const y = yScale(price);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();

      // Price labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), margin.left + chartWidth + 5, y + 4);
    }

    // Vertical grid lines
    const timeStep = Math.max(1, Math.floor(data.length / 8));
    for (let i = 0; i < data.length; i += timeStep) {
      const x = xScale(i);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();

      // Time labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      const timeStr = new Date(data[i].time).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      ctx.fillText(timeStr, x, height - 20);
    }

    // Draw candlesticks
    const candleWidth = Math.max(2, chartWidth / data.length * 0.8);

    data.forEach((bar, index) => {
      const x = xScale(index);
      const openY = yScale(bar.open);
      const highY = yScale(bar.high);
      const lowY = yScale(bar.low);
      const closeY = yScale(bar.close);

      const isUp = bar.close >= bar.open;
      const color = isUp ? '#10b981' : '#ef4444';

      // Draw wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY);

      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, Math.max(1, bodyHeight));

      // Highlight hovered candle
      if (index === hoveredIndex) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - candleWidth/2 - 1, bodyTop - 1, candleWidth + 2, bodyHeight + 2);
      }
    });

    // Draw trading signals
    signals.forEach(signal => {
      // Find closest data point by time
      const signalTime = new Date(signal.time * 1000);
      let closestIndex = 0;
      let minTimeDiff = Infinity;

      data.forEach((bar, index) => {
        const barTime = new Date(bar.time);
        const timeDiff = Math.abs(signalTime.getTime() - barTime.getTime());
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestIndex = index;
        }
      });

      if (closestIndex < data.length) {
        const x = xScale(closestIndex);
        const y = yScale(signal.price);

        // Draw signal marker
        const isSignalBuy = signal.type === 'buy';
        const signalColor = isSignalBuy ? '#10b981' : '#ef4444';

        ctx.fillStyle = signalColor;
        ctx.beginPath();

        if (isSignalBuy) {
          // Draw up arrow
          ctx.moveTo(x, y + 15);
          ctx.lineTo(x - 8, y + 25);
          ctx.lineTo(x + 8, y + 25);
          ctx.closePath();
        } else {
          // Draw down arrow
          ctx.moveTo(x, y - 15);
          ctx.lineTo(x - 8, y - 25);
          ctx.lineTo(x + 8, y - 25);
          ctx.closePath();
        }

        ctx.fill();

        // Draw confidence text
        ctx.fillStyle = '#374151';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        const confidenceText = `${(signal.confidence * 100).toFixed(0)}%`;
        const textY = isSignalBuy ? y + 40 : y - 35;
        ctx.fillText(confidenceText, x, textY);
      }
    });

  }, [data, signals, width, height, hoveredIndex]);

  // Handle mouse move for hover effects
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const margin = { top: 20, right: 80, bottom: 60, left: 60 };
    const chartWidth = width - margin.left - margin.right;

    // Calculate which candle is being hovered
    const relativeX = x - margin.left;
    const index = Math.round((relativeX * (data.length - 1)) / chartWidth);

    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
    } else {
      setHoveredIndex(-1);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(-1);
  };

  // Show tooltip for hovered candle
  const hoveredData = hoveredIndex >= 0 && hoveredIndex < data.length ? data[hoveredIndex] : null;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="border rounded cursor-crosshair"
        style={{ width: `${width}px`, height: `${height}px` }}
      />

      {/* Tooltip */}
      {hoveredData && (
        <div className="absolute top-2 left-2 bg-white dark:bg-gray-800 border rounded-lg p-3 shadow-lg text-sm">
          <div className="font-semibold mb-2">
            {new Date(hoveredData.time).toLocaleString('zh-CN')}
          </div>
          <div className="space-y-1 text-xs">
            <div>开盘: <span className="font-mono">{hoveredData.open.toFixed(2)}</span></div>
            <div>最高: <span className="font-mono text-green-600">{hoveredData.high.toFixed(2)}</span></div>
            <div>最低: <span className="font-mono text-red-600">{hoveredData.low.toFixed(2)}</span></div>
            <div>收盘: <span className="font-mono">{hoveredData.close.toFixed(2)}</span></div>
            <div>成交量: <span className="font-mono">{(hoveredData.volume / 1000000).toFixed(2)}M</span></div>
            <div className={`font-semibold ${hoveredData.close >= hoveredData.open ? 'text-green-600' : 'text-red-600'}`}>
              {hoveredData.close >= hoveredData.open ? '▲' : '▼'}
              {((hoveredData.close - hoveredData.open) / hoveredData.open * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}