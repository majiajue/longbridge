import React, { useEffect, useRef, useState } from 'react';
import { Chart } from '@antv/g2';

export default function SimpleKLineTest() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('准备中...');

  useEffect(() => {
    if (!containerRef.current) {
      setStatus('容器未准备好');
      return;
    }

    try {
      setStatus('创建K线图...');

      // 简单的K线数据
      const data = [
        { time: 1, open: 100, high: 110, low: 95, close: 105 },
        { time: 2, open: 105, high: 115, low: 100, close: 110 },
        { time: 3, open: 110, high: 120, low: 105, close: 115 },
        { time: 4, open: 115, high: 125, low: 110, close: 120 },
        { time: 5, open: 120, high: 130, low: 115, close: 125 },
      ];

      // 创建图表
      const chart = new Chart({
        container: containerRef.current,
        width: 600,
        height: 300,
      });

      chart
        .line()
        .data(data)
        .encode('x', 'time')
        .encode('y', 'close')
        .encode('color', () => '#10b981')
        .style('stroke', '#10b981')
        .style('strokeWidth', 2);

      // G2 v5 不直接支持 candlestick，我们用简化的线图代替
      chart
        .point()
        .data(data)
        .encode('x', 'time')
        .encode('y', 'high')
        .encode('color', () => '#ef4444')
        .style('fill', '#ef4444');

      setStatus('渲染K线图...');
      chart.render();
      setStatus('K线图渲染完成');

      return () => {
        chart.destroy();
      };
    } catch (error) {
      console.error('SimpleKLineTest 错误:', error);
      setStatus(`错误: ${error.message}`);
    }
  }, []);

  return (
    <div className="border p-4 rounded bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold mb-4">K线图基础测试</h3>
      <div className="mb-2 text-sm text-gray-600">状态: {status}</div>
      <div
        ref={containerRef}
        className="border border-gray-300 rounded"
        style={{ width: '600px', height: '300px' }}
      />
    </div>
  );
}