import { useState, useEffect, ReactNode } from "react";
import Sidebar, { TabType } from "./Sidebar";

interface LayoutProps {
  children: (activeTab: TabType) => ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem("activeTab");
    return (saved as TabType) || "ai-trading";
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(localStorage.getItem("sidebarCollapsed") === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(() => {
      const current = localStorage.getItem("sidebarCollapsed") === "true";
      if (current !== sidebarCollapsed) {
        setSidebarCollapsed(current);
      }
    }, 100);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [sidebarCollapsed]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Main Content */}
      <main
        className={`
          min-h-screen transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "ml-16" : "ml-60"}
        `}
      >
        <div className="p-6 animate-fade-in">{children(activeTab)}</div>
      </main>
    </div>
  );
}

export type { TabType };
