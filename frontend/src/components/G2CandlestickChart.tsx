import React, { useEffect, useRef, useState } from 'react';
import { Chart } from '@antv/g2';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: CandlestickData[];
  width?: number;
  height?: number;
  onLoading?: (loading: boolean) => void;
}

export default function G2CandlestickChart({
  data,
  width = 700,
  height = 450,
  onLoading
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const volumeChartRef = useRef<Chart | null>(null);
  const [status, setStatus] = useState('准备中...');

  useEffect(() => {
    if (!containerRef.current || !volumeContainerRef.current || !data || data.length === 0) {
      setStatus('数据为空或容器未准备好');
      return;
    }

    const cleanup = () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      if (volumeChartRef.current) {
        volumeChartRef.current.destroy();
        volumeChartRef.current = null;
      }
    };

    const createChart = async () => {
      try {
        onLoading?.(true);
        setStatus('创建K线图...');

        // 清理之前的图表
        cleanup();

        // 转换数据格式，使用官方G2 K线图API格式
        const candleData = data.map((item, index) => {
          return {
            time: new Date(item.time).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }),
            start: item.open,    // 开盘价
            max: item.high,      // 最高价
            min: item.low,       // 最低价
            end: item.close,     // 收盘价
            volume: item.volume || 0
          };
        });

        console.log('K线数据样例:', candleData.slice(0, 2));

        // 创建K线图 - 使用官方API
        const kChart = new Chart({
          container: containerRef.current,
          autoFit: true,
          height: height - 150, // 为成交量图留空间
        });

        kChart.options({
          type: 'view',
          data: candleData,
          encode: {
            x: 'time',
            color: (d: any) => {
              const trend = Math.sign(d.start - d.end);
              return trend > 0 ? '下跌' : trend === 0 ? '不变' : '上涨';
            },
          },
          scale: {
            color: {
              domain: ['下跌', '不变', '上涨'],
              range: ['#ef4444', '#999999', '#10b981'],
            },
          },
          children: [
            {
              type: 'link',        // 影线
              encode: { y: ['min', 'max'] },
              style: { stroke: '#666', strokeWidth: 1 }
            },
            {
              type: 'interval',    // 实体
              encode: { y: ['start', 'end'] },
              style: { fillOpacity: 1 },
            },
          ],
          axis: {
            y: { title: '价格' },
            x: { title: '时间', labelAutoRotate: true }
          },
          tooltip: {
            title: (d: any) => `时间: ${d.time}`,
            items: [
              { field: 'start', name: '开盘', valueFormatter: (d: number) => d?.toFixed(2) },
              { field: 'max', name: '最高', valueFormatter: (d: number) => d?.toFixed(2) },
              { field: 'min', name: '最低', valueFormatter: (d: number) => d?.toFixed(2) },
              { field: 'end', name: '收盘', valueFormatter: (d: number) => d?.toFixed(2) },
              { field: 'volume', name: '成交量', valueFormatter: (d: number) => d?.toLocaleString() || '0' }
            ]
          }
        });

        setStatus('创建成交量图...');

        // 成交量图
        const volumeChart = new Chart({
          container: volumeContainerRef.current,
          autoFit: true,
          height: 120,
        });

        volumeChart.options({
          type: 'interval',
          data: candleData,
          encode: {
            x: 'time',
            y: 'volume',
            color: (d: any) => {
              const trend = Math.sign(d.start - d.end);
              return trend > 0 ? '下跌' : trend === 0 ? '不变' : '上涨';
            },
          },
          scale: {
            color: {
              domain: ['下跌', '不变', '上涨'],
              range: ['#ef4444', '#999999', '#10b981'],
            },
          },
          axis: {
            y: { title: '成交量' },
            x: { title: null, labelAutoRotate: true }
          },
        });

        setStatus('渲染图表...');
        chartRef.current = kChart;
        volumeChartRef.current = volumeChart;

        await Promise.all([
          kChart.render(),
          volumeChart.render()
        ]);

        setStatus(`K线图渲染完成 - ${data.length} 根K线`);
        onLoading?.(false);

      } catch (error) {
        console.error('K线图创建失败:', error);
        setStatus(`创建失败: ${error.message}`);
        onLoading?.(false);
      }
    };

    createChart();

    return cleanup;
  }, [data, width, height]);

  return (
    <div className="border p-4 rounded bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold mb-2">G2 K线蜡烛图</h3>
      <div className="mb-2 text-sm text-gray-600">
        状态: <span className="font-mono">{status}</span>
      </div>
      <div className="mb-2 text-xs text-gray-500">
        数据量: {data?.length || 0} 条
      </div>
      <div className="space-y-2">
        <div
          ref={containerRef}
          className="border border-gray-300 rounded"
          style={{ width: `${width}px`, height: `${height - 150}px` }}
        />
        <div
          ref={volumeContainerRef}
          className="border border-gray-300 rounded"
          style={{ width: `${width}px`, height: '120px' }}
        />
      </div>
    </div>
  );
}