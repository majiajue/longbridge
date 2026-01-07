import { useState, useEffect } from "react";
import {
  SmartToy,
  Calculate,
  FilterList,
  Whatshot,
  Visibility,
  MonitorHeart,
  CandlestickChart,
  Settings,
  DarkMode,
  LightMode,
  ChevronLeft,
  ChevronRight,
} from "@mui/icons-material";
import { Tooltip } from "@mui/material";

export type TabType =
  | "ai-trading"
  | "smart-position"
  | "stock-picker"
  | "sector-rotation"
  | "strategy-watch"
  | "monitoring"
  | "position-klines"
  | "settings";

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "交易中心",
    items: [
      { id: "ai-trading", label: "AI 交易", icon: <SmartToy /> },
      { id: "smart-position", label: "智能仓位", icon: <Calculate /> },
    ],
  },
  {
    title: "分析工具",
    items: [
      { id: "stock-picker", label: "智能选股", icon: <FilterList /> },
      { id: "sector-rotation", label: "板块轮动", icon: <Whatshot /> },
      { id: "strategy-watch", label: "策略盯盘", icon: <Visibility /> },
    ],
  },
  {
    title: "持仓管理",
    items: [
      { id: "monitoring", label: "持仓监控", icon: <MonitorHeart /> },
      { id: "position-klines", label: "持仓K线", icon: <CandlestickChart /> },
    ],
  },
];

const settingsItem: NavItem = {
  id: "settings",
  label: "基础配置",
  icon: <Settings />,
};

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  darkMode,
  onToggleDarkMode,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  const renderNavItem = (item: NavItem) => {
    const isActive = activeTab === item.id;
    const button = (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
          transition-all duration-200 relative group
          ${
            isActive
              ? "bg-slate-700/50 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
          }
        `}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-500 rounded-r-full" />
        )}
        <span
          className={`text-xl ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-400"}`}
        >
          {item.icon}
        </span>
        {!collapsed && <span>{item.label}</span>}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id} title={item.label} placement="right" arrow>
          {button}
        </Tooltip>
      );
    }
    return button;
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-slate-900 dark:bg-slate-950
        flex flex-col border-r border-slate-800
        transition-all duration-300 ease-in-out z-30
        ${collapsed ? "w-16" : "w-60"}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800">
        <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
          <span className="text-white font-bold text-sm">LB</span>
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-lg font-semibold text-white leading-tight">
              Longbridge
            </h1>
            <p className="text-xs text-slate-500">Quant Console</p>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <div className="space-y-1">{group.items.map(renderNavItem)}</div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        {/* Settings */}
        {renderNavItem(settingsItem)}

        {/* Dark Mode Toggle */}
        <Tooltip
          title={darkMode ? "切换浅色模式" : "切换深色模式"}
          placement="right"
          arrow
          disableHoverListener={!collapsed}
        >
          <button
            onClick={onToggleDarkMode}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-all duration-200"
          >
            <span className="text-xl text-slate-500">
              {darkMode ? <DarkMode /> : <LightMode />}
            </span>
            {!collapsed && <span>{darkMode ? "深色模式" : "浅色模式"}</span>}
          </button>
        </Tooltip>

        {/* Collapse Toggle */}
        <Tooltip
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          placement="right"
          arrow
          disableHoverListener={!collapsed}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-all duration-200"
          >
            <span className="text-xl text-slate-500">
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </span>
            {!collapsed && <span>收起侧边栏</span>}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
