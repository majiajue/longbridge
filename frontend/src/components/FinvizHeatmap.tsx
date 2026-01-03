import React, { useState } from "react";
import type { FinvizSector, SectorStock } from "../api/sectorRotation";

interface FinvizHeatmapProps {
  data: FinvizSector[];
  summary?: {
    total_stocks: number;
    positive_count: number;
    negative_count: number;
    avg_change: number;
  };
  width?: number;
  height?: number;
  onStockClick?: (stock: SectorStock, sector: FinvizSector) => void;
  onSectorClick?: (sector: FinvizSector) => void;
}

/**
 * 根据涨跌幅获取颜色
 */
function getChangeColor(change: number): string {
  if (change >= 5) return "#00c853";
  if (change >= 2) return "#4caf50";
  if (change >= 0) return "#81c784";
  if (change >= -2) return "#ef9a9a";
  if (change >= -5) return "#f44336";
  return "#c62828";
}

/**
 * 根据涨跌幅获取背景色（带透明度）
 */
function getChangeBgColor(change: number): string {
  if (change >= 5) return "rgba(0, 200, 83, 0.9)";
  if (change >= 2) return "rgba(76, 175, 80, 0.85)";
  if (change >= 0) return "rgba(129, 199, 132, 0.8)";
  if (change >= -2) return "rgba(239, 154, 154, 0.8)";
  if (change >= -5) return "rgba(244, 67, 54, 0.85)";
  return "rgba(198, 40, 40, 0.9)";
}

/**
 * Finviz 风格热力图
 * 使用 CSS Grid 实现，更稳定可靠
 */
export default function FinvizHeatmap({
  data,
  summary,
  width = 1200,
  height = 600,
  onStockClick,
  onSectorClick,
}: FinvizHeatmapProps) {
  const [viewMode, setViewMode] = useState<"sectors" | "stocks">("sectors");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
        style={{ width, height }}
      >
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <div>暂无热力图数据</div>
          <div className="text-sm mt-1">请先同步板块数据并执行股票筛选</div>
        </div>
      </div>
    );
  }

  // 计算板块权重
  const totalValue = data.reduce(
    (sum, s) => sum + (s.stock_count * 10 + s.strength_score),
    0
  );

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("sectors")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "sectors"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            板块视图
          </button>
          <button
            onClick={() => setViewMode("stocks")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "stocks"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            股票视图
          </button>
        </div>

        {/* 市场摘要 */}
        {summary && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-500 dark:text-gray-400">股票:</span>
              <span className="font-medium">{summary.total_stocks}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {summary.positive_count}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                {summary.negative_count}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500 dark:text-gray-400">平均:</span>
              <span
                className={`font-medium ${
                  summary.avg_change >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {summary.avg_change >= 0 ? "+" : ""}
                {summary.avg_change.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 热力图 */}
      <div
        className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-1"
        style={{ width, minHeight: height }}
      >
        {viewMode === "sectors" ? (
          // 板块视图
          <div className="flex flex-wrap gap-1" style={{ minHeight: height - 10 }}>
            {data.map((sector) => {
              const weight = (sector.stock_count * 10 + sector.strength_score) / totalValue;
              const minWidth = Math.max(120, width * weight * 0.9);
              const isHovered = hoveredItem === sector.symbol;

              return (
                <div
                  key={sector.symbol}
                  className="relative flex flex-col items-center justify-center cursor-pointer transition-all duration-200 rounded"
                  style={{
                    backgroundColor: getChangeBgColor(sector.change_pct),
                    flexGrow: weight * 10,
                    flexBasis: minWidth,
                    minHeight: 80,
                    transform: isHovered ? "scale(1.02)" : "scale(1)",
                    zIndex: isHovered ? 10 : 1,
                    boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                  }}
                  onClick={() => onSectorClick?.(sector)}
                  onMouseEnter={() => setHoveredItem(sector.symbol)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="text-white font-bold text-lg drop-shadow">
                    {sector.name}
                  </div>
                  <div className="text-white/80 text-xs">{sector.symbol}</div>
                  <div className="text-white font-bold text-xl mt-1 drop-shadow">
                    {sector.change_pct >= 0 ? "+" : ""}
                    {sector.change_pct.toFixed(2)}%
                  </div>
                  {isHovered && (
                    <div className="absolute bottom-1 text-white/70 text-xs">
                      强度: {sector.strength_score.toFixed(0)} | 股票: {sector.stock_count}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // 股票视图
          <div className="space-y-2" style={{ minHeight: height - 10 }}>
            {data.map((sector) => (
              <div key={sector.symbol} className="space-y-1">
                {/* 板块标题 */}
                <div
                  className="px-2 py-1 rounded text-white font-bold text-sm cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: getChangeBgColor(sector.change_pct) }}
                  onClick={() => onSectorClick?.(sector)}
                >
                  {sector.name} ({sector.symbol})
                  <span className="ml-2">
                    {sector.change_pct >= 0 ? "+" : ""}
                    {sector.change_pct.toFixed(2)}%
                  </span>
                </div>

                {/* 板块内股票 */}
                {sector.stocks.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pl-1">
                    {sector.stocks.map((stock) => {
                      const stockId = `${sector.symbol}-${stock.symbol}`;
                      const isHovered = hoveredItem === stockId;
                      const change = stock.change_pct || 0;
                      // 根据市值计算大小
                      const size = stock.market_cap
                        ? Math.max(60, Math.min(120, Math.log10(stock.market_cap / 1e9) * 30 + 60))
                        : 60;

                      return (
                        <div
                          key={stock.symbol}
                          className="flex flex-col items-center justify-center cursor-pointer transition-all duration-200 rounded"
                          style={{
                            backgroundColor: getChangeBgColor(change),
                            width: size,
                            height: size * 0.7,
                            transform: isHovered ? "scale(1.1)" : "scale(1)",
                            zIndex: isHovered ? 10 : 1,
                            boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                          }}
                          onClick={() => onStockClick?.(stock, sector)}
                          onMouseEnter={() => setHoveredItem(stockId)}
                          onMouseLeave={() => setHoveredItem(null)}
                          title={`${stock.name || stock.symbol}\n市值: $${((stock.market_cap || 0) / 1e9).toFixed(1)}B`}
                        >
                          <div className="text-white font-bold text-xs drop-shadow truncate px-1">
                            {stock.symbol.split(".")[0]}
                          </div>
                          <div className="text-white font-medium text-xs drop-shadow">
                            {change >= 0 ? "+" : ""}
                            {change.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs pl-2">暂无股票数据</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 颜色图例 */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "#c62828" }}
          ></span>
          <span>&lt;-5%</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "#f44336" }}
          ></span>
          <span>-5% ~ -2%</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "#ef9a9a" }}
          ></span>
          <span>-2% ~ 0</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "#81c784" }}
          ></span>
          <span>0 ~ 2%</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "#4caf50" }}
          ></span>
          <span>2% ~ 5%</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: "#00c853" }}
          ></span>
          <span>&gt;5%</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 因子强度卡片
 */
export function FactorStrengthCard({
  factor,
  name_cn,
  avg_change_1d,
  avg_change_5d,
  strength_score,
  trend,
  momentum,
  rank,
  onClick,
}: {
  factor: string;
  name_cn: string;
  avg_change_1d: number;
  avg_change_5d: number;
  strength_score: number;
  trend: string;
  momentum: string;
  rank: number;
  onClick?: () => void;
}) {
  const isPositive = avg_change_1d >= 0;
  const trendIcon = {
    strong_up: "🚀",
    up: "📈",
    neutral: "➡️",
    down: "📉",
    strong_down: "💥",
  }[trend] || "➡️";

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isPositive
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{trendIcon}</span>
          <span className="font-bold text-lg">{name_cn}</span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          #{rank}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">日涨跌:</span>
          <span
            className={`ml-1 font-medium ${
              isPositive
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isPositive ? "+" : ""}
            {avg_change_1d.toFixed(2)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">5日涨跌:</span>
          <span
            className={`ml-1 font-medium ${
              avg_change_5d >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {avg_change_5d >= 0 ? "+" : ""}
            {avg_change_5d.toFixed(2)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">强度:</span>
          <span className="ml-1 font-medium">{strength_score.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">动量:</span>
          <span
            className={`ml-1 font-medium ${
              momentum === "positive"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {momentum === "positive" ? "正向" : "负向"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 因子轮动信号卡片
 */
export function FactorRotationSignal({
  rotation_signal,
  signal_description,
  dominant_factor_cn,
  recommendation,
  strengthening_factors,
  weakening_factors,
}: {
  rotation_signal: string;
  signal_description: string;
  dominant_factor_cn: string;
  recommendation: string;
  strengthening_factors: string[];
  weakening_factors: string[];
}) {
  const signalConfig = {
    rotation_in_progress: {
      color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500",
      icon: "🔄",
      label: "轮动进行中",
    },
    rotation_ending: {
      color: "bg-orange-100 dark:bg-orange-900/30 border-orange-500",
      icon: "⚠️",
      label: "轮动结束",
    },
    trend_continuation: {
      color: "bg-green-100 dark:bg-green-900/30 border-green-500",
      icon: "📈",
      label: "趋势延续",
    },
    neutral: {
      color: "bg-gray-100 dark:bg-gray-800 border-gray-400",
      icon: "➡️",
      label: "中性",
    },
    no_data: {
      color: "bg-gray-100 dark:bg-gray-800 border-gray-400",
      icon: "❓",
      label: "数据不足",
    },
  }[rotation_signal] || {
    color: "bg-gray-100 dark:bg-gray-800 border-gray-400",
    icon: "❓",
    label: rotation_signal,
  };

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${signalConfig.color} space-y-3`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{signalConfig.icon}</span>
        <div>
          <div className="font-bold text-lg">{signalConfig.label}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {signal_description}
          </div>
        </div>
      </div>

      {dominant_factor_cn && (
        <div className="text-sm">
          <span className="text-gray-500 dark:text-gray-400">主导因子:</span>
          <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
            {dominant_factor_cn}
          </span>
        </div>
      )}

      <div className="flex gap-4 text-sm">
        {strengthening_factors.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-green-500">▲</span>
            <span className="text-gray-500 dark:text-gray-400">走强:</span>
            <span className="text-green-600 dark:text-green-400">
              {strengthening_factors.length}
            </span>
          </div>
        )}
        {weakening_factors.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-red-500">▼</span>
            <span className="text-gray-500 dark:text-gray-400">走弱:</span>
            <span className="text-red-600 dark:text-red-400">
              {weakening_factors.length}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 bg-white/50 dark:bg-black/20 rounded text-sm">
        <span className="font-medium">建议:</span>
        <span className="ml-2">{recommendation}</span>
      </div>
    </div>
  );
}
