import React, { useState } from "react";
import type { HeatmapItem } from "../api/sectorRotation";

interface SectorHeatmapProps {
  data: HeatmapItem[];
  width?: number;
  height?: number;
  onSectorClick?: (sector: HeatmapItem) => void;
}

/**
 * 根据涨跌幅获取背景色
 */
function getChangeBgColor(change: number): string {
  if (change > 2) return "rgba(34, 197, 94, 0.9)"; // green-500
  if (change > 0) return "rgba(134, 239, 172, 0.85)"; // green-300
  if (change > -2) return "rgba(252, 165, 165, 0.85)"; // red-300
  return "rgba(239, 68, 68, 0.9)"; // red-500
}

/**
 * 板块热力图组件
 * 使用 CSS Flexbox 实现
 */
export default function SectorHeatmap({
  data,
  width = 800,
  height = 400,
  onSectorClick,
}: SectorHeatmapProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
        style={{ width, height }}
      >
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <div>暂无板块数据</div>
          <div className="text-sm mt-1">请先同步数据</div>
        </div>
      </div>
    );
  }

  // 计算总权重
  const totalWeight = data.reduce((sum, item) => sum + Math.abs(item.strength) + 50, 0);

  const handleClick = (sector: HeatmapItem) => {
    setSelectedSector(sector.symbol);
    onSectorClick?.(sector);
  };

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1 rounded-lg overflow-hidden p-1 bg-gray-100 dark:bg-gray-800"
        style={{ width, minHeight: height }}
      >
        {data.map((item) => {
          const weight = (Math.abs(item.strength) + 50) / totalWeight;
          const minWidth = Math.max(100, width * weight * 0.8);
          const isHovered = hoveredSector === item.symbol;
          const isSelected = selectedSector === item.symbol;
          const change = item.value;

          return (
            <div
              key={item.symbol}
              className="relative flex flex-col items-center justify-center cursor-pointer transition-all duration-200 rounded"
              style={{
                backgroundColor: getChangeBgColor(change),
                flexGrow: weight * 10,
                flexBasis: minWidth,
                minHeight: 70,
                transform: isHovered ? "scale(1.02)" : "scale(1)",
                zIndex: isHovered ? 10 : 1,
                boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                outline: isSelected ? "3px solid #3b82f6" : "none",
              }}
              onClick={() => handleClick(item)}
              onMouseEnter={() => setHoveredSector(item.symbol)}
              onMouseLeave={() => setHoveredSector(null)}
            >
              <div className="text-white font-bold text-sm drop-shadow">
                {item.name}
              </div>
              <div className="text-white font-bold text-lg mt-1 drop-shadow">
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </div>
              {isHovered && (
                <div className="absolute bottom-1 text-white/80 text-xs">
                  强度: {item.strength.toFixed(0)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedSector && (
        <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-sm shadow-lg border border-gray-200 dark:border-gray-700">
          已选: <span className="font-bold">{selectedSector}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 简化版板块卡片网格
 * 作为热力图的替代方案
 */
export function SectorCardGrid({
  data,
  onSectorClick,
}: {
  data: HeatmapItem[];
  onSectorClick?: (sector: HeatmapItem) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {data.map((sector) => {
        const isUp = sector.value >= 0;
        const bgColor = isUp
          ? sector.value > 2
            ? "bg-green-500"
            : "bg-green-400"
          : sector.value < -2
          ? "bg-red-500"
          : "bg-red-400";

        return (
          <div
            key={sector.symbol}
            className={`${bgColor} rounded-lg p-3 text-white cursor-pointer hover:opacity-90 transition-opacity`}
            onClick={() => onSectorClick?.(sector)}
          >
            <div className="font-bold text-sm truncate">{sector.name}</div>
            <div className="text-xs opacity-80">{sector.symbol}</div>
            <div className="text-lg font-bold mt-1">
              {isUp ? "+" : ""}
              {sector.value.toFixed(2)}%
            </div>
            <div className="text-xs mt-1 opacity-80">
              强度: {sector.strength.toFixed(0)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
