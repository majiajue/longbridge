import React, { useEffect, useRef, useState } from 'react';
import { Chart } from '@antv/g2';

export default function TestChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('准备中...');

  useEffect(() => {
    if (!containerRef.current) {
      setStatus('容器未准备好');
      return;
    }

    try {
      setStatus('创建图表...');

      // 最简单的数据
      const data = [
        { genre: 'Sports', sold: 275 },
        { genre: 'Strategy', sold: 115 },
        { genre: 'Action', sold: 120 },
        { genre: 'Shooter', sold: 350 },
        { genre: 'Other', sold: 150 },
      ];

      // 创建图表
      const chart = new Chart({
        container: containerRef.current,
        width: 600,
        height: 300,
      });

      chart
        .interval()
        .data(data)
        .encode('x', 'genre')
        .encode('y', 'sold');

      setStatus('渲染图表...');
      chart.render();
      setStatus('渲染完成');

      return () => {
        chart.destroy();
      };
    } catch (error) {
      console.error('TestChart 错误:', error);
      setStatus(`错误: ${error.message}`);
    }
  }, []);

  return (
    <div className="border p-4 rounded bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold mb-4">G2 基础测试</h3>
      <div className="mb-2 text-sm text-gray-600">状态: {status}</div>
      <div
        ref={containerRef}
        className="border border-gray-300 rounded"
        style={{ width: '600px', height: '300px' }}
      />
    </div>
  );
}