import React, { useEffect, useRef, useState } from 'react';
import { Chart } from '@antv/g2';

interface SimpleChartProps {
  width?: number;
  height?: number;
}

// 最简单的G2图表测试
export default function SimpleG2Chart({ width = 800, height = 400 }: SimpleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>('初始化...');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('SimpleG2Chart: useEffect 开始');

    if (!containerRef.current) {
      setError('容器引用为空');
      console.error('容器引用为空');
      return;
    }

    try {
      setStatus('创建图表实例...');
      console.log('创建图表实例...');

      // 创建最简单的G2图表
      const chart = new Chart({
        container: containerRef.current,
        width,
        height,
      });

      console.log('图表实例创建成功:', chart);
      setStatus('准备测试数据...');

      // 简单的测试数据
      const data = [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 15 },
        { name: 'D', value: 25 }
      ];

      chart.data(data);
      console.log('数据设置完成:', data);
      setStatus('配置图表...');

      // 简单的柱状图
      chart.interval().position('name*value').color('name');

      setStatus('渲染图表...');
      console.log('开始渲染图表...');

      chart.render();
      console.log('图表渲染完成');
      setStatus('渲染完成！');

      return () => {
        console.log('清理图表');
        chart.destroy();
      };
    } catch (err) {
      console.error('G2图表创建失败:', err);
      setError(`创建失败: ${err.message}`);
      setStatus('创建失败');
    }
  }, [width, height]);

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold mb-4">G2图表调试测试</h3>

      <div className="mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          状态: <span className="font-mono">{status}</span>
        </div>
        {error && (
          <div className="text-sm text-red-600 mt-2">
            错误: <span className="font-mono">{error}</span>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded"
        style={{ width: `${width}px`, height: `${height}px`, minHeight: '200px' }}
      />

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <div>容器尺寸: {width} x {height}</div>
        <div>DOM节点: {containerRef.current ? '已创建' : '未创建'}</div>
      </div>
    </div>
  );
}