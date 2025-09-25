import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Chart } from '@antv/g2';
import { ChartLoadingSpinner, SkeletonLoader } from './LoadingSpinner';

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
  reason?: string;
}

interface G2KLineChartProps {
  data: KLineData[];
  signals?: TradingSignal[];
  width?: number;
  height?: number;
}

export default function G2KLineChart({
  data,
  signals = [],
  width = 800,
  height = 400
}: G2KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [loadingStage, setLoadingStage] = useState<'loading' | 'data' | 'signals' | 'rendering' | 'complete'>('loading');
  const [isInitialized, setIsInitialized] = useState(false);

  // 异步初始化图表
  const initializeChart = useCallback(async () => {
    if (!containerRef.current) return;

    setLoadingStage('loading');

    // 模拟初始化延迟，让加载动画显示
    await new Promise(resolve => setTimeout(resolve, 200));

    // 清理之前的图表
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // 创建图表实例
    const chart = new Chart({
      container: containerRef.current,
      width,
      height,
      padding: [20, 80, 60, 60],
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    });

    chartRef.current = chart;
    setIsInitialized(true);
  }, [width, height]);

  // 异步加载数据和渲染
  const renderChart = useCallback(async () => {
    if (!chartRef.current || !data.length || !isInitialized) return;

    const chart = chartRef.current;

    try {
      setLoadingStage('data');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 准备K线数据（异步处理）
      const formattedData = await new Promise<any[]>(resolve => {
        // 使用 requestIdleCallback 在空闲时处理数据
        const processData = () => {
          const result = data.map((item, index) => {
            // 确保时间格式正确
            const timeValue = item.time || item.ts || new Date().toISOString();
            const timeObj = new Date(timeValue);

            // 验证时间是否有效
            if (isNaN(timeObj.getTime())) {
              console.warn('无效时间数据:', timeValue, '使用当前时间');
            }

            return {
              time: timeObj.getTime(),
              timeStr: timeObj.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              open: Number(item.open) || 0,
              high: Number(item.high) || 0,
              low: Number(item.low) || 0,
              close: Number(item.close) || 0,
              volume: Number(item.volume) || 0,
              index: index,
              type: (Number(item.close) || 0) >= (Number(item.open) || 0) ? 'up' : 'down'
            };
          });
          console.log('G2图表数据处理完成:', result.length, '条记录');
          resolve(result);
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(processData);
        } else {
          setTimeout(processData, 0);
        }
      });

      setLoadingStage('signals');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 准备交易信号数据（异步处理）
      const signalData = await new Promise<any[]>(resolve => {
        const processSignals = () => {
          const result = signals.map(signal => {
            const signalTime = new Date(signal.time * 1000).getTime();
            let closestIndex = 0;
            let minTimeDiff = Infinity;

            formattedData.forEach((item, index) => {
              const timeDiff = Math.abs(signalTime - item.time);
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestIndex = index;
              }
            });

            return {
              time: signalTime,
              price: signal.price,
              type: signal.type,
              strategy: signal.strategy,
              confidence: signal.confidence,
              reason: signal.reason,
              index: closestIndex,
              timeStr: new Date(signal.time * 1000).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })
            };
          });
          resolve(result);
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(processSignals);
        } else {
          setTimeout(processSignals, 0);
        }
      });

      setLoadingStage('rendering');
      await new Promise(resolve => setTimeout(resolve, 100));


    // 设置数据
    chart.data(formattedData);

    // 配置比例尺
    chart.scale({
      time: {
        type: 'linear',
        tickCount: 8,
        formatter: (val: number) => {
          return new Date(val).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      },
      open: { sync: true },
      high: { sync: true },
      low: { sync: true },
      close: { sync: true },
      volume: {
        min: 0
      }
    });

    // 配置坐标轴
    chart.axis('time', {
      title: null,
      label: {
        style: {
          fill: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151'
        }
      },
      line: {
        style: {
          stroke: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
        }
      }
    });

    chart.axis('high', {
      title: null,
      position: 'right',
      label: {
        formatter: (val: string) => parseFloat(val).toFixed(2),
        style: {
          fill: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151'
        }
      },
      line: {
        style: {
          stroke: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
        }
      },
      grid: {
        line: {
          style: {
            stroke: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
            lineDash: [2, 2]
          }
        }
      }
    });

    // 绘制K线图 - 使用 schema 几何标记
    chart
      .schema()
      .position('time*high*low*open*close')
      .color('type', (type: string) => {
        return type === 'up' ? '#10b981' : '#ef4444';
      })
      .shape('candle')
      .tooltip('timeStr*open*high*low*close*volume', (timeStr, open, high, low, close, volume) => {
        const changeRate = ((close - open) / open * 100).toFixed(2);
        const changeValue = (close - open).toFixed(2);
        return {
          title: timeStr,
          value: `开盘: ${open.toFixed(2)}<br/>` +
                 `最高: ${high.toFixed(2)}<br/>` +
                 `最低: ${low.toFixed(2)}<br/>` +
                 `收盘: ${close.toFixed(2)}<br/>` +
                 `成交量: ${(volume / 1000000).toFixed(2)}M<br/>` +
                 `涨跌: ${changeValue >= 0 ? '+' : ''}${changeValue}<br/>` +
                 `涨跌幅: ${changeRate >= 0 ? '+' : ''}${changeRate}%`
        };
      });

    // 如果有交易信号，添加信号标记
    if (signalData.length > 0) {
      chart.annotation().dataMarker({
        data: signalData,
        position: (datum: any) => [datum.time, datum.price],
        point: {
          style: {
            fill: (datum: any) => datum.type === 'buy' ? '#10b981' : '#ef4444',
            stroke: '#fff',
            lineWidth: 2,
            r: 6
          }
        },
        line: {
          style: {
            stroke: (datum: any) => datum.type === 'buy' ? '#10b981' : '#ef4444',
            lineWidth: 1
          },
          length: 20
        },
        text: {
          content: (datum: any) => `${datum.type === 'buy' ? '买入' : '卖出'}\n${(datum.confidence * 100).toFixed(0)}%`,
          style: {
            fontSize: 10,
            fill: (datum: any) => datum.type === 'buy' ? '#10b981' : '#ef4444',
            fontWeight: 'bold',
            textAlign: 'center'
          },
          offset: (datum: any) => datum.type === 'buy' ? [0, -30] : [0, 30]
        }
      });
    }

      // 异步渲染图表
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          chart.render();
          resolve();
        });
      });

      setLoadingStage('complete');
    } catch (error) {
      console.error('Chart rendering error:', error);
      setLoadingStage('complete');
    }
  }, [data, signals, isInitialized]);

  // 初始化图表
  useEffect(() => {
    initializeChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      setIsInitialized(false);
    };
  }, [initializeChart]);

  // 渲染图表数据
  useEffect(() => {
    if (isInitialized && data.length > 0) {
      renderChart();
    }
  }, [renderChart, data, signals]);

  // 监听主题变化
  useEffect(() => {
    const handleThemeChange = () => {
      if (chartRef.current) {
        const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        chartRef.current.theme(newTheme);
      }
    };

    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
    };
  }, [isInitialized]);

  // 显示加载状态
  const showLoading = loadingStage !== 'complete' || !isInitialized;
  const showNoData = data.length === 0 && loadingStage === 'complete';

  return (
    <div className="relative">
      {/* 图表容器 */}
      <div
        ref={containerRef}
        className={`w-full rounded-lg overflow-hidden border transition-opacity duration-300 ${
          showLoading ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ width: `${width}px`, height: `${height}px` }}
      />

      {/* 加载状态 */}
      {showLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <ChartLoadingSpinner stage={loadingStage} />
        </div>
      )}

      {/* 无数据状态 */}
      {showNoData && (
        <div
          className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div className="text-lg font-semibold mb-2">暂无K线数据</div>
            <div className="text-sm">请检查网络连接或稍后重试</div>
          </div>
        </div>
      )}

      {/* 交易信号面板 */}
      {signals.length > 0 && loadingStage === 'complete' && (
        <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 border rounded-lg p-2 shadow-lg text-xs animate-fade-in">
          <div className="font-semibold mb-1 text-gray-700 dark:text-gray-300">交易信号</div>
          <div className="space-y-1">
            {signals.slice(-3).map((signal, index) => (
              <div key={index} className={`flex items-center gap-2 ${
                signal.type === 'buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                  signal.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span>
                  {signal.type === 'buy' ? '买入' : '卖出'} {signal.price.toFixed(2)} ({(signal.confidence * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}