import { useState, useEffect } from "react";
import SettingsPage from "./pages/Settings";
import PositionMonitoringPage from "./pages/PositionMonitoring";
import StrategyWatchPage from "./pages/StrategyWatch";
import PositionKLinesPage from "./pages/PositionKLines";
import SmartPositionPage from "./pages/SmartPosition";
import AiTradingPage from "./pages/AiTrading";
import StockPickerPage from "./pages/StockPicker";
import SectorRotationPage from "./pages/SectorRotation";
import DashboardPage from "./pages/Dashboard";

type TabType = "dashboard" | "settings" | "monitoring" | "strategy-watch" | "position-klines" | "smart-position" | "ai-trading" | "stock-picker" | "sector-rotation";

interface TabItem {
  id: TabType;
  label: string;
  icon: string;
}

const tabs: TabItem[] = [
  { id: "dashboard", label: "工作台", icon: "🏠" },
  { id: "settings", label: "基础配置", icon: "⚙️" },
  { id: "ai-trading", label: "AI 交易", icon: "🤖" },
  { id: "stock-picker", label: "智能选股", icon: "🎯" },
  { id: "sector-rotation", label: "板块轮动", icon: "🔥" },
  { id: "smart-position", label: "智能仓位", icon: "🎲" },
  { id: "position-klines", label: "持仓K线", icon: "📊" },
  { id: "strategy-watch", label: "策略盯盘", icon: "🔍" },
  { id: "monitoring", label: "持仓监控", icon: "👁️" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Dashboard 有自己的布局，直接返回
  if (activeTab === "dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
        {/* 简化的导航栏 */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 shadow-sm">
          <div className="max-w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LB</span>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">Longbridge</span>
              </div>
              <div className="flex space-x-2 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap
                      ${
                        activeTab === tab.id
                          ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }
                    `}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                {darkMode ? "🌙" : "☀️"}
              </button>
            </div>
          </div>
        </div>
        <DashboardPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">LB</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
                  Longbridge Quant Console
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">本地量化沙盘</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              aria-label="Toggle dark mode"
            >
              {darkMode ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative py-4 px-1 flex items-center space-x-2 text-sm font-medium border-b-2 transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {activeTab === "settings" && <SettingsPage />}
          {activeTab === "ai-trading" && <AiTradingPage />}
          {activeTab === "stock-picker" && <StockPickerPage />}
          {activeTab === "sector-rotation" && <SectorRotationPage />}
          {activeTab === "smart-position" && <SmartPositionPage />}
          {activeTab === "position-klines" && <PositionKLinesPage />}
          {activeTab === "strategy-watch" && <StrategyWatchPage />}
          {activeTab === "monitoring" && <PositionMonitoringPage />}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© 2024 Longbridge Quant Console. All rights reserved.</p>
      </footer>
    </div>
  );
}