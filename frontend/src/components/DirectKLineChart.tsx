import React, { useEffect, useRef, useState } from 'react';
import { Chart } from '@antv/g2';

export default function DirectKLineChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('初始化...');
  const [data, setData] = useState<any[]>([]);

  // 获取真实数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setStatus('获取数据...');
        const response = await fetch('http://localhost:8000/quotes/history?symbol=700.HK&limit=1000&period=min1&adjust_type=no_adjust');
        const result = await response.json();

        console.log('API响应:', result);

        if (result.bars && result.bars.length > 0) {
          // 转换数据格式
          const convertedData = result.bars.map((bar: any, index: number) => ({
            time: new Date(bar.ts).getTime(),
            open: Number(bar.open),
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
            volume: Number(bar.volume) || 0
          }));

          console.log('转换后数据:', convertedData.slice(0, 3));
          setData(convertedData);
          setStatus(`数据获取成功: ${convertedData.length} 条记录`);
        } else {
          setStatus('无数据');
        }
      } catch (error) {
        console.error('数据获取失败:', error);
        setStatus('数据获取失败');
      }
    };

    fetchData();
  }, []);

  // 渲染图表
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    try {
      setStatus('创建图表...');

      const chart = new Chart({
        container: containerRef.current,
        width: 700,
        height: 350,
        padding: [20, 40, 50, 60],
      });

      // 绘制收盘价线图 (G2 v5 简化版本)
      chart
        .line()
        .data(data)
        .encode('x', 'time')
        .encode('y', 'close')
        .encode('color', (d: any) => d.close >= d.open ? '#10b981' : '#ef4444')
        .style('strokeWidth', 2)
        .scale('x', {
          type: 'linear',
          tickCount: 8,
          formatter: (val: number) => {
            return new Date(val).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        })
        .tooltip({
          title: (d: any) => new Date(d.time).toLocaleString('zh-CN'),
          items: [
            { field: 'open', name: '开盘', valueFormatter: (d: number) => d?.toFixed(2) },
            { field: 'high', name: '最高', valueFormatter: (d: number) => d?.toFixed(2) },
            { field: 'low', name: '最低', valueFormatter: (d: number) => d?.toFixed(2) },
            { field: 'close', name: '收盘', valueFormatter: (d: number) => d?.toFixed(2) }
          ]
        });

      // 添加开盘价点标记
      chart
        .point()
        .data(data)
        .encode('x', 'time')
        .encode('y', 'open')
        .encode('color', () => '#666')
        .style('fill', '#666')
        .style('r', 2);

      setStatus('渲染图表...');
      chart.render();
      setStatus(`图表渲染完成 - ${data.length} 条K线`);

      return () => {
        chart.destroy();
      };
    } catch (error) {
      console.error('图表创建失败:', error);
      setStatus(`图表创建失败: ${error.message}`);
    }
  }, [data]);

  return (
    <div className="border p-4 rounded bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold mb-2">实际数据K线图测试</h3>
      <div className="mb-2 text-sm text-gray-600">
        状态: <span className="font-mono">{status}</span>
      </div>
      <div className="mb-2 text-xs text-gray-500">
        数据量: {data.length} 条
      </div>
      <div
        ref={containerRef}
        className="border border-gray-300 rounded"
        style={{ width: '700px', height: '350px' }}
      />
    </div>
  );
}