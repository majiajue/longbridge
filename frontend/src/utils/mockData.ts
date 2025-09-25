// 生成模拟K线数据用于测试和演示

export interface MockKLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MockTradingSignal {
  time: number;
  price: number;
  type: 'buy' | 'sell';
  strategy: string;
  confidence: number;
  reason?: string;
}

/**
 * 生成模拟K线数据
 */
export function generateMockKLineData(
  count: number = 100,
  basePrice: number = 100,
  startTime?: Date
): MockKLineData[] {
  const data: MockKLineData[] = [];
  const start = startTime || new Date(Date.now() - count * 60 * 1000); // count分钟前

  let currentPrice = basePrice;
  let currentTime = new Date(start);

  for (let i = 0; i < count; i++) {
    // 随机波动 -2% 到 +2%
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * volatility * currentPrice;

    const open = currentPrice;
    const close = Math.max(0.1, open + change + (Math.random() - 0.5) * 5);

    // 确保high >= max(open, close), low <= min(open, close)
    const maxPrice = Math.max(open, close);
    const minPrice = Math.min(open, close);

    const high = maxPrice + Math.random() * (maxPrice * 0.01);
    const low = Math.max(0.1, minPrice - Math.random() * (minPrice * 0.01));

    const volume = Math.floor(Math.random() * 1000000 + 10000); // 1万到100万

    data.push({
      time: currentTime.toISOString(),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume
    });

    currentPrice = close;
    currentTime = new Date(currentTime.getTime() + 60 * 1000); // 每分钟
  }

  return data;
}

/**
 * 生成模拟交易信号
 */
export function generateMockTradingSignals(
  klineData: MockKLineData[],
  signalCount: number = 10
): MockTradingSignal[] {
  if (klineData.length === 0) return [];

  const signals: MockTradingSignal[] = [];
  const strategies = ['ma_crossover', 'rsi_oversold', 'breakout', 'bollinger_bands'];

  // 随机选择一些K线数据点作为信号点
  const indices = Array.from({ length: klineData.length }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, signalCount);

  indices.forEach(index => {
    const kline = klineData[index];
    const isUp = kline.close > kline.open;

    // 根据K线走势倾向生成信号
    const signalType = Math.random() > 0.5 ?
      (isUp ? 'buy' : 'sell') :
      (isUp ? 'sell' : 'buy');

    signals.push({
      time: Math.floor(new Date(kline.time).getTime() / 1000),
      price: signalType === 'buy' ?
        kline.low + (kline.high - kline.low) * 0.2 : // 买入信号在较低位置
        kline.low + (kline.high - kline.low) * 0.8,   // 卖出信号在较高位置
      type: signalType,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      confidence: 0.6 + Math.random() * 0.3, // 60%-90%的置信度
      reason: `${signalType === 'buy' ? '买入' : '卖出'}信号 - 模拟数据`
    });
  });

  return signals.sort((a, b) => a.time - b.time);
}

/**
 * 检查数据是否有效
 */
export function isValidKLineData(data: any[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('K线数据为空或不是数组');
    return false;
  }

  // 检查前几条数据的格式
  for (let i = 0; i < Math.min(3, data.length); i++) {
    const item = data[i];
    if (!item.time && !item.ts) {
      console.warn(`第${i}条数据缺少时间字段:`, item);
      return false;
    }

    const requiredFields = ['open', 'high', 'low', 'close'];
    for (const field of requiredFields) {
      if (typeof item[field] !== 'number' || isNaN(item[field])) {
        console.warn(`第${i}条数据的${field}字段无效:`, item[field]);
        return false;
      }
    }

    // 检查OHLC逻辑
    if (item.high < Math.max(item.open, item.close) ||
        item.low > Math.min(item.open, item.close)) {
      console.warn(`第${i}条数据的OHLC逻辑错误:`, item);
      return false;
    }
  }

  return true;
}

/**
 * 检查是否为静态数据（所有OHLC相同）
 */
export function isStaticData(data: any[]): boolean {
  if (data.length < 2) return true;

  const first = data[0];
  return data.every(item =>
    item.open === first.open &&
    item.high === first.high &&
    item.low === first.low &&
    item.close === first.close
  );
}

/**
 * 为静态数据添加一些变化
 */
export function enhanceStaticData(data: any[]): MockKLineData[] {
  return data.map((item, index) => {
    const basePrice = item.open || item.close || 100;
    const variation = (Math.random() - 0.5) * basePrice * 0.05; // 5%的变化

    const open = basePrice + variation * (Math.random() - 0.5);
    const close = open + variation;
    const high = Math.max(open, close) + Math.abs(variation) * Math.random();
    const low = Math.min(open, close) - Math.abs(variation) * Math.random();

    return {
      time: item.ts || item.time || new Date(Date.now() + index * 60000).toISOString(),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: item.volume || Math.floor(Math.random() * 100000 + 10000)
    };
  });
}