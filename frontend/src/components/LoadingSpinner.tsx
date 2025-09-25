import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  showProgress?: boolean;
  progress?: number;
}

export default function LoadingSpinner({
  size = 'md',
  text = '加载中...',
  className = '',
  showProgress = false,
  progress = 0
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {/* 主要的旋转动画 */}
      <div className="relative">
        {/* 外圈 */}
        <div className={`${sizeClasses[size]} border-4 border-gray-200 dark:border-gray-700 rounded-full animate-pulse`}></div>

        {/* 内圈旋转 */}
        <div className={`absolute inset-0 ${sizeClasses[size]} border-4 border-transparent border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin`}></div>

        {/* 中心点 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-ping"></div>
        </div>
      </div>

      {/* 加载文本 */}
      {text && (
        <div className={`${textSizeClasses[size]} font-medium text-gray-600 dark:text-gray-300 animate-pulse`}>
          {text}
        </div>
      )}

      {/* 进度条 */}
      {showProgress && (
        <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          ></div>
          <div className="text-xs text-center mt-1 text-gray-500 dark:text-gray-400">
            {Math.round(progress)}%
          </div>
        </div>
      )}
    </div>
  );
}

// K线图专用的加载组件
export function ChartLoadingSpinner({ stage = 'loading' }: { stage?: 'loading' | 'data' | 'signals' | 'rendering' }) {
  const stageTexts = {
    loading: '初始化图表...',
    data: '加载K线数据...',
    signals: '加载交易信号...',
    rendering: '渲染图表...'
  };

  const stageProgress = {
    loading: 10,
    data: 40,
    signals: 70,
    rendering: 90
  };

  return (
    <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <LoadingSpinner
        size="lg"
        text={stageTexts[stage]}
        showProgress={true}
        progress={stageProgress[stage]}
      />

      {/* 图表图标 */}
      <div className="mt-4 text-gray-400 dark:text-gray-500">
        <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
    </div>
  );
}

// 骨架屏加载效果
export function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {/* 标题骨架 */}
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
      </div>

      {/* 图表区域骨架 */}
      <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded-lg">
        {/* 模拟K线柱状图 */}
        <div className="flex items-end justify-center h-full p-4 space-x-1">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="bg-gray-400 dark:bg-gray-500 rounded-sm w-3"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                animationDelay: `${i * 0.1}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* 底部信息骨架 */}
      <div className="flex justify-between">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
      </div>
    </div>
  );
}