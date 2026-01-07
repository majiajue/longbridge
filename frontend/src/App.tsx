import SettingsPage from "./pages/Settings";
import PositionMonitoringPage from "./pages/PositionMonitoring";
import StrategyWatchPage from "./pages/StrategyWatch";
import PositionKLinesPage from "./pages/PositionKLines";
import SmartPositionPage from "./pages/SmartPosition";
import AiTradingPage from "./pages/AiTrading";
import StockPickerPage from "./pages/StockPicker";
import SectorRotationPage from "./pages/SectorRotation";
import Layout, { TabType } from "./components/Layout";

function renderPage(activeTab: TabType) {
  switch (activeTab) {
    case "ai-trading":
      return <AiTradingPage />;
    case "smart-position":
      return <SmartPositionPage />;
    case "stock-picker":
      return <StockPickerPage />;
    case "sector-rotation":
      return <SectorRotationPage />;
    case "strategy-watch":
      return <StrategyWatchPage />;
    case "monitoring":
      return <PositionMonitoringPage />;
    case "position-klines":
      return <PositionKLinesPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <AiTradingPage />;
  }
}

export default function App() {
  return <Layout>{(activeTab) => renderPage(activeTab)}</Layout>;
}
