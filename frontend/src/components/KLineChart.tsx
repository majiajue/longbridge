import React, { useEffect, useRef, useState } from 'react';
import { init, dispose } from 'klinecharts';

interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: KLineData[];
  width?: number;
  height?: number;
  onLoading?: (loading: boolean) => void;
}

export default function KLineChart({
  data,
  width = 800,
  height = 500,
  onLoading
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const klineChart = useRef<any>(null);
  const [status, setStatus] = useState('准备中...');

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) {
      setStatus('数据为空或容器未准备好');
      return;
    }

    const initChart = async () => {
      try {
        onLoading?.(true);
        setStatus('初始化K线图...');

        // 清理之前的图表
        if (klineChart.current) {
          dispose(chartRef.current!);
          klineChart.current = null;
        }

        // 初始化KLineCharts
        const chart = init(chartRef.current);
        klineChart.current = chart;

        setStatus('转换数据格式...');

        // 转换数据格式为KLineCharts要求的格式
        const klineData = data.map(item => ({
          timestamp: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume || 0
        }));

        console.log('KLineCharts数据样例:', klineData.slice(0, 3));

        setStatus('设置图表样式...');

        // 设置图表样式
        chart.setStyles({
          grid: {
            show: true,
            horizontal: {
              show: true,
              size: 1,
              color: '#E9EDF3',
              style: 'solid'
            },
            vertical: {
              show: true,
              size: 1,
              color: '#E9EDF3',
              style: 'solid'
            }
          },
          candle: {
            margin: {
              top: 0.2,
              bottom: 0.1
            },
            type: 'candle_solid',
            bar: {
              upColor: '#10b981',
              downColor: '#ef4444',
              noChangeColor: '#999999'
            },
            tooltip: {
              showRule: 'always',
              showType: 'standard',
              custom: [
                { title: '时间', value: '{time}' },
                { title: '开盘', value: '{open}' },
                { title: '收盘', value: '{close}' },
                { title: '最低', value: '{low}' },
                { title: '最高', value: '{high}' },
                { title: '成交量', value: '{volume}' }
              ]
            }
          },
          xAxis: {
            show: true,
            size: 'auto',
            axisLine: {
              show: true,
              color: '#DDDDDD',
              size: 1
            },
            tickLine: {
              show: true,
              size: 1,
              length: 3,
              color: '#DDDDDD'
            },
            tickText: {
              show: true,
              color: '#76808F',
              size: 12,
              marginStart: 4,
              marginEnd: 4
            }
          },
          yAxis: {
            show: true,
            size: 'auto',
            position: 'right',
            type: 'normal',
            inside: false,
            reverse: false,
            axisLine: {
              show: true,
              color: '#DDDDDD',
              size: 1
            },
            tickLine: {
              show: true,
              size: 1,
              length: 3,
              color: '#DDDDDD'
            },
            tickText: {
              show: true,
              color: '#76808F',
              size: 12,
              marginStart: 8,
              marginEnd: 8
            }
          }
        });

        setStatus('添加技术指标...');

        // 创建成交量副图
        chart.createIndicator('VOL', false, { id: 'volume_pane' });

        // 添加主图指标（叠加在蜡烛图上）
        chart.createIndicator('MA', true, { id: 'candle_pane' }); // 移动平均线
        chart.createIndicator('BOLL', true, { id: 'candle_pane' }); // 布林带

        // 添加副图指标
        chart.createIndicator('MACD', false, { id: 'macd_pane' }); // MACD
        chart.createIndicator('RSI', false, { id: 'rsi_pane' }); // RSI
        chart.createIndicator('KDJ', false, { id: 'kdj_pane' }); // KDJ

        setStatus('加载数据...');

        // 加载数据
        chart.applyNewData(klineData);

        setStatus('计算买卖点策略...');

        // 计算买卖点并添加标记
        setTimeout(() => {
          addTradingSignals(chart, data);
        }, 500); // 等待图表渲染完成

        setStatus(`K线图渲染完成 - ${data.length} 根K线`);
        onLoading?.(false);

      } catch (error) {
        console.error('KLine图创建失败:', error);
        setStatus(`创建失败: ${error.message}`);
        onLoading?.(false);
      }
    };

    initChart();

    return () => {
      if (chartRef.current && klineChart.current) {
        dispose(chartRef.current);
        klineChart.current = null;
      }
    };
  }, [data, width, height]);

  return (
    <div className="border p-4 rounded bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold mb-2">KLineCharts K线图</h3>
      <div className="mb-2 text-sm text-gray-600">
        状态: <span className="font-mono">{status}</span>
      </div>
      <div className="mb-2 text-xs text-gray-500">
        数据量: {data?.length || 0} 条
      </div>
      <div
        ref={chartRef}
        className="border border-gray-300 rounded bg-white"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
}

// 计算移动平均线
function calculateMA(data: KLineData[], period: number): number[] {
  const ma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
      ma.push(sum / period);
    }
  }
  return ma;
}

// 计算买卖点策略
function calculateTradingSignals(data: KLineData[]) {
  const signals: Array<{
    index: number,
    type: 'buy' | 'sell',
    price: number,
    timestamp: number,
    reason: string
  }> = [];

  // 策略1: MA均线金叉死叉
  const ma5 = calculateMA(data, 5);
  const ma20 = calculateMA(data, 20);

  for (let i = 1; i < data.length; i++) {
    if (!isNaN(ma5[i]) && !isNaN(ma20[i]) && !isNaN(ma5[i-1]) && !isNaN(ma20[i-1])) {

      // 金叉买入信号 (5日线上穿20日线)
      if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) {
        signals.push({
          index: i,
          type: 'buy',
          price: data[i].close,
          timestamp: data[i].time,
          reason: 'MA5上穿MA20金叉'
        });
      }

      // 死叉卖出信号 (5日线下穿20日线)
      else if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) {
        signals.push({
          index: i,
          type: 'sell',
          price: data[i].close,
          timestamp: data[i].time,
          reason: 'MA5下穿MA20死叉'
        });
      }
    }
  }

  // 策略2: RSI超买超卖
  const rsiSignals = calculateRSISignals(data);
  signals.push(...rsiSignals);

  // 按时间排序
  signals.sort((a, b) => a.timestamp - b.timestamp);

  console.log('计算出买卖点:', signals);
  return signals;
}

// 计算RSI超买超卖信号
function calculateRSISignals(data: KLineData[]) {
  const signals: Array<{
    index: number,
    type: 'buy' | 'sell',
    price: number,
    timestamp: number,
    reason: string
  }> = [];

  // 简化RSI计算
  const rsiPeriod = 14;
  for (let i = rsiPeriod; i < data.length; i++) {
    const gains: number[] = [];
    const losses: number[] = [];

    for (let j = i - rsiPeriod + 1; j <= i; j++) {
      const change = data[j].close - data[j-1].close;
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }

    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / rsiPeriod;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / rsiPeriod;

    if (avgLoss === 0) continue;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // RSI超卖买入信号 (RSI < 30)
    if (rsi < 30) {
      signals.push({
        index: i,
        type: 'buy',
        price: data[i].close,
        timestamp: data[i].time,
        reason: `RSI超卖(${rsi.toFixed(1)})`
      });
    }

    // RSI超买卖出信号 (RSI > 70)
    else if (rsi > 70) {
      signals.push({
        index: i,
        type: 'sell',
        price: data[i].close,
        timestamp: data[i].time,
        reason: `RSI超买(${rsi.toFixed(1)})`
      });
    }
  }

  return signals;
}

// 添加买卖点标记到图表
function addTradingSignals(chart: any, data: KLineData[]) {
  try {
    const signals = calculateTradingSignals(data);
    console.log('准备添加买卖点标记:', signals);

    signals.forEach((signal, index) => {
      const overlayId = `signal_${signal.type}_${signal.index}`;
      console.log('创建标记:', overlayId, signal);

      try {
        chart.createOverlay({
          name: 'simpleText',
          id: overlayId,
          points: [{
            timestamp: signal.timestamp,
            value: signal.price
          }],
          text: signal.type === 'buy' ? '买' : '卖',
          styles: {
            color: signal.type === 'buy' ? '#10b981' : '#ef4444',
            size: 14,
            family: 'Microsoft YaHei, SimHei, Arial',
            weight: 'bold',
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: 3,
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2
          }
        });
        console.log(`成功创建 ${overlayId}`);
      } catch (overlayError) {
        console.error(`创建 ${overlayId} 失败:`, overlayError);

        // 尝试备用方案：使用simpleAnnotation但只显示文字
        try {
          chart.createOverlay({
            name: 'simpleAnnotation',
            id: overlayId + '_fallback',
            points: [{
              timestamp: signal.timestamp,
              value: signal.price
            }],
            styles: {
              symbol: {
                type: 'none'
              },
              text: {
                content: signal.type === 'buy' ? '买' : '卖',
                color: signal.type === 'buy' ? '#10b981' : '#ef4444',
                size: 14,
                family: 'Microsoft YaHei, SimHei, Arial',
                weight: 'bold'
              }
            }
          });
          console.log(`备用方案 ${overlayId}_fallback 成功`);
        } catch (fallbackError) {
          console.error(`备用方案也失败:`, fallbackError);
        }
      }
    });

    console.log(`处理完成 ${signals.length} 个买卖点标记`);

  } catch (error) {
    console.error('添加买卖点标记失败:', error);
  }
}