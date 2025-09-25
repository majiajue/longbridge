// 异步工具函数，优化大数据处理和UI响应性

/**
 * 使用 requestIdleCallback 进行异步数据处理
 * 在浏览器空闲时处理数据，避免阻塞UI
 */
export function processDataAsync<T, R>(
  data: T[],
  processor: (item: T, index: number) => R,
  onProgress?: (progress: number) => void
): Promise<R[]> {
  return new Promise((resolve) => {
    const result: R[] = [];
    let index = 0;
    const batchSize = Math.min(50, Math.max(10, Math.floor(data.length / 10))); // 动态批处理大小

    const processBatch = () => {
      const endIndex = Math.min(index + batchSize, data.length);

      // 批处理数据
      for (let i = index; i < endIndex; i++) {
        result.push(processor(data[i], i));
      }

      index = endIndex;
      const progress = (index / data.length) * 100;
      onProgress?.(progress);

      if (index < data.length) {
        // 继续处理剩余数据
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(processBatch, { timeout: 1000 });
        } else {
          setTimeout(processBatch, 0);
        }
      } else {
        // 处理完成
        resolve(result);
      }
    };

    processBatch();
  });
}

/**
 * 分批加载数据，避免一次性加载过多数据导致卡顿
 */
export async function loadDataInBatches<T>(
  loader: (offset: number, limit: number) => Promise<T[]>,
  totalCount: number,
  batchSize: number = 100,
  onProgress?: (loaded: number, total: number) => void
): Promise<T[]> {
  const allData: T[] = [];
  let loaded = 0;

  while (loaded < totalCount) {
    const currentBatchSize = Math.min(batchSize, totalCount - loaded);
    const batch = await loader(loaded, currentBatchSize);

    allData.push(...batch);
    loaded += batch.length;

    onProgress?.(loaded, totalCount);

    // 如果批次返回的数据少于请求的数量，说明没有更多数据了
    if (batch.length < currentBatchSize) {
      break;
    }

    // 给UI一些喘息时间
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return allData;
}

/**
 * 智能缓存管理器
 */
export class SmartCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; accessCount: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) { // 默认5分钟TTL
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 增加访问计数，用于LRU策略
    entry.accessCount++;
    entry.timestamp = now; // 更新访问时间

    return entry.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();

    // 如果缓存已满，移除最少使用的项
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1
    });
  }

  private evictLRU(): void {
    let lruKey = '';
    let lruCount = Infinity;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      // 优先移除最久未访问且访问次数少的项
      if (entry.accessCount < lruCount ||
          (entry.accessCount === lruCount && entry.timestamp < oldestTime)) {
        lruKey = key;
        lruCount = entry.accessCount;
        oldestTime = entry.timestamp;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // 清理过期项
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * 防抖函数，优化API调用
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * 节流函数，限制函数调用频率
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * 渐进式加载：先加载部分数据快速显示，然后逐步加载完整数据
 */
export async function progressiveLoad<T>(
  quickLoader: () => Promise<T[]>,
  fullLoader: () => Promise<T[]>,
  onQuickData: (data: T[]) => void,
  onFullData: (data: T[]) => void
): Promise<void> {
  try {
    // 第一步：快速加载核心数据
    const quickData = await quickLoader();
    onQuickData(quickData);

    // 第二步：在后台加载完整数据
    const fullData = await fullLoader();
    onFullData(fullData);
  } catch (error) {
    console.error('Progressive load error:', error);
    throw error;
  }
}

/**
 * Web Worker 支持检测和回退
 */
export function isWebWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * 时间格式化缓存
 */
const timeFormatCache = new Map<string, string>();

export function formatTimeWithCache(timestamp: number | string, locale = 'zh-CN'): string {
  const key = `${timestamp}_${locale}`;

  if (timeFormatCache.has(key)) {
    return timeFormatCache.get(key)!;
  }

  const date = new Date(timestamp);
  const formatted = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  timeFormatCache.set(key, formatted);

  // 限制缓存大小
  if (timeFormatCache.size > 1000) {
    const firstKey = timeFormatCache.keys().next().value;
    timeFormatCache.delete(firstKey);
  }

  return formatted;
}