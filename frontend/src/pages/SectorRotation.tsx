/**
 * 板块轮动分析页面 V2
 * 支持板块、因子、主题 ETF 分析
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  syncSectorData,
  getSectors,
  getHeatmapData,
  screenTopSectorStocks,
  addSectorStocksToPicker,
  getFinvizHeatmap,
  getFactors,
  getFactorRotation,
  getETFPerformance,
  type SectorInfo,
  type HeatmapItem,
  type SectorStock,
  type FinvizSector,
  type FactorInfo,
  type FactorRotation as FactorRotationType,
  type ETFPerformance,
  type ETFType,
} from "../api/sectorRotation";
import { SectorCardGrid } from "../components/SectorHeatmap";
import FinvizHeatmap, {
  FactorStrengthCard,
  FactorRotationSignal,
} from "../components/FinvizHeatmap";

type ViewMode = "sector" | "factor" | "finviz";

export default function SectorRotation() {
  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>("sector");

  // 板块数据
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [screenedStocks, setScreenedStocks] = useState<Record<string, SectorStock[]>>({});
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  // Finviz 数据
  const [finvizData, setFinvizData] = useState<FinvizSector[]>([]);
  const [finvizSummary, setFinvizSummary] = useState<{
    total_stocks: number;
    positive_count: number;
    negative_count: number;
    avg_change: number;
  } | null>(null);

  // 因子数据
  const [factors, setFactors] = useState<FactorInfo[]>([]);
  const [factorRotation, setFactorRotation] = useState<FactorRotationType | null>(null);
  const [etfPerformance, setEtfPerformance] = useState<ETFPerformance[]>([]);

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [screening, setScreening] = useState(false);

  // 消息状态
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 筛选参数
  const [topN, setTopN] = useState(3);
  const [stocksPerSector, setStocksPerSector] = useState(10);

  // 同步类型
  const [syncType, setSyncType] = useState<ETFType>("sector");

  // 加载板块数据
  const loadSectorData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectorsRes, heatmapRes] = await Promise.all([
        getSectors(),
        getHeatmapData(),
      ]);
      setSectors(sectorsRes.sectors || []);
      setHeatmapData(heatmapRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载 Finviz 热力图数据
  const loadFinvizData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFinvizHeatmap();
      setFinvizData(res.sectors || []);
      setFinvizSummary(res.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载热力图数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载因子数据
  const loadFactorData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [factorsRes, rotationRes, perfRes] = await Promise.all([
        getFactors(),
        getFactorRotation(20),
        getETFPerformance("factor"),
      ]);
      setFactors(factorsRes.factors || []);
      setFactorRotation({
        dominant_factor: rotationRes.dominant_factor,
        dominant_factor_cn: rotationRes.dominant_factor_cn,
        rotation_signal: rotationRes.rotation_signal,
        signal_description: rotationRes.signal_description,
        factor_momentum: rotationRes.factor_momentum,
        strengthening_factors: rotationRes.strengthening_factors,
        weakening_factors: rotationRes.weakening_factors,
        recommendation: rotationRes.recommendation,
      });
      setEtfPerformance(perfRes.etfs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载因子数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 根据视图模式加载数据
  const loadData = useCallback(async () => {
    switch (viewMode) {
      case "sector":
        await loadSectorData();
        break;
      case "finviz":
        await loadFinvizData();
        break;
      case "factor":
        await loadFactorData();
        break;
    }
  }, [viewMode, loadSectorData, loadFinvizData, loadFactorData]);

  // 同步数据
  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncSectorData(60, syncType);
      setSuccess(`同步完成: ${result.success?.length || 0} 个 ETF 数据已更新`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  // 筛选股票
  const handleScreen = async () => {
    setScreening(true);
    setError(null);
    try {
      const result = await screenTopSectorStocks(topN, stocksPerSector);
      setScreenedStocks(result.stocks_by_sector || {});
      setSuccess(`筛选完成: 从 ${result.sectors?.length || 0} 个板块筛选出股票`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "筛选失败");
    } finally {
      setScreening(false);
    }
  };

  // 添加到选股池
  const handleAddToPicker = async (sectorSymbol: string) => {
    try {
      const result = await addSectorStocksToPicker(sectorSymbol, "LONG");
      setSuccess(result.message || `已添加 ${result.added} 只股票到选股池`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  };

  // 热力图点击
  const handleHeatmapClick = (sector: HeatmapItem) => {
    setSelectedSector(sector.symbol);
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 自动清除消息
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // 获取趋势颜色
  const getTrendColor = (change: number) => {
    if (change > 2) return "text-green-600 dark:text-green-400";
    if (change > 0) return "text-green-500 dark:text-green-300";
    if (change < -2) return "text-red-600 dark:text-red-400";
    if (change < 0) return "text-red-500 dark:text-red-300";
    return "text-gray-500";
  };

  // 获取趋势图标
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "strong_up": return "🚀";
      case "up": return "📈";
      case "strong_down": return "📉";
      case "down": return "⬇️";
      default: return "➡️";
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题和操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            板块轮动分析 V2
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            支持 62 个 ETF 分析：板块、指数、行业、因子、主题
          </p>
        </div>

        <div className="flex gap-2">
          {/* 同步类型选择 */}
          <select
            value={syncType}
            onChange={(e) => setSyncType(e.target.value as ETFType)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="sector">板块 ETF (11)</option>
            <option value="index">指数 ETF (9)</option>
            <option value="industry">行业 ETF (15)</option>
            <option value="factor">因子 ETF (14)</option>
            <option value="theme">主题 ETF (13)</option>
            <option value="all">全部 ETF (62)</option>
          </select>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {syncing ? (
              <><span className="animate-spin">⏳</span> 同步中...</>
            ) : (
              <>📡 同步数据</>
            )}
          </button>

          <button
            onClick={() => loadData()}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* 视图模式切换 */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: "sector", label: "板块分析", icon: "📊" },
          { key: "factor", label: "因子分析", icon: "📈" },
          { key: "finviz", label: "Finviz 热力图", icon: "🗺️" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key as ViewMode)}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              viewMode === tab.key
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          ❌ {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          ✅ {success}
        </div>
      )}

      {/* 板块分析视图 */}
      {viewMode === "sector" && (
        <>
          {/* 热力图区域 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              📊 板块热力图
            </h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <span className="animate-spin text-4xl">⏳</span>
              </div>
            ) : heatmapData.length > 0 ? (
              <SectorCardGrid data={heatmapData} onSectorClick={handleHeatmapClick} />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                暂无数据，请先同步
              </div>
            )}
          </div>

          {/* 板块排行表 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              🏆 板块强度排名
            </h2>

            {sectors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">排名</th>
                      <th className="text-left py-2 px-3">板块</th>
                      <th className="text-right py-2 px-3">日涨跌</th>
                      <th className="text-right py-2 px-3">5日</th>
                      <th className="text-right py-2 px-3">20日</th>
                      <th className="text-right py-2 px-3">60日</th>
                      <th className="text-right py-2 px-3">强度</th>
                      <th className="text-center py-2 px-3">趋势</th>
                      <th className="text-center py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectors.map((sector) => (
                      <tr
                        key={sector.symbol}
                        className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          selectedSector === sector.symbol ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                        onClick={() => setSelectedSector(sector.symbol)}
                      >
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                              sector.rank <= 3
                                ? "bg-yellow-400 text-yellow-900"
                                : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {sector.rank}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{sector.name_cn}</div>
                              <div className="text-xs text-gray-500">{sector.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${getTrendColor(sector.change_1d)}`}>
                          {sector.change_1d >= 0 ? "+" : ""}{sector.change_1d.toFixed(2)}%
                        </td>
                        <td className={`py-2 px-3 text-right ${getTrendColor(sector.change_5d)}`}>
                          {sector.change_5d >= 0 ? "+" : ""}{sector.change_5d.toFixed(2)}%
                        </td>
                        <td className={`py-2 px-3 text-right ${getTrendColor(sector.change_20d)}`}>
                          {sector.change_20d >= 0 ? "+" : ""}{sector.change_20d.toFixed(2)}%
                        </td>
                        <td className={`py-2 px-3 text-right ${getTrendColor(sector.change_60d)}`}>
                          {sector.change_60d >= 0 ? "+" : ""}{sector.change_60d.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="font-bold text-gray-900 dark:text-white">{sector.strength_score.toFixed(1)}</span>
                        </td>
                        <td className="py-2 px-3 text-center">{getTrendIcon(sector.trend)}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddToPicker(sector.symbol); }}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            + 选股
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">暂无排名数据</div>
            )}
          </div>

          {/* 股票筛选区 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">🔍 强势板块股票筛选</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">前</label>
                  <select
                    value={topN}
                    onChange={(e) => setTopN(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <label className="text-sm text-gray-600 dark:text-gray-400">个板块</label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">每板块</label>
                  <select
                    value={stocksPerSector}
                    onChange={(e) => setStocksPerSector(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <label className="text-sm text-gray-600 dark:text-gray-400">只</label>
                </div>
                <button
                  onClick={handleScreen}
                  disabled={screening || sectors.length === 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {screening ? <><span className="animate-spin">⏳</span> 筛选中...</> : <>🎯 开始筛选</>}
                </button>
              </div>
            </div>

            {Object.keys(screenedStocks).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(screenedStocks).map(([sectorSymbol, stocks]) => {
                  const sectorInfo = sectors.find((s) => s.symbol === sectorSymbol);
                  return (
                    <div key={sectorSymbol} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50"
                        style={{ borderLeft: `4px solid ${sectorInfo?.color || "#666"}` }}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {sectorInfo?.name_cn || sectorSymbol} ({sectorSymbol})
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{stocks.length} 只股票</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                              <th className="text-left py-2 px-3">#</th>
                              <th className="text-left py-2 px-3">代码</th>
                              <th className="text-left py-2 px-3">名称</th>
                              <th className="text-right py-2 px-3">市值</th>
                              <th className="text-right py-2 px-3">PE</th>
                              <th className="text-right py-2 px-3">价格</th>
                              <th className="text-right py-2 px-3">涨跌</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stocks.map((stock, idx) => (
                              <tr key={stock.symbol} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                                <td className="py-2 px-3 font-mono text-gray-900 dark:text-white">{stock.symbol}</td>
                                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{stock.name || "-"}</td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                                  {stock.market_cap ? `$${(stock.market_cap / 1e9).toFixed(1)}B` : "-"}
                                </td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                                  {stock.pe_ratio?.toFixed(1) || "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                                  ${stock.price?.toFixed(2) || "-"}
                                </td>
                                <td className={`py-2 px-3 text-right font-medium ${getTrendColor(stock.change_pct || 0)}`}>
                                  {stock.change_pct != null ? `${stock.change_pct >= 0 ? "+" : ""}${stock.change_pct.toFixed(2)}%` : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                点击"开始筛选"从强势板块中筛选股票
              </div>
            )}
          </div>
        </>
      )}

      {/* 因子分析视图 */}
      {viewMode === "factor" && (
        <>
          {/* 因子轮动信号 */}
          {factorRotation && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🔄 因子轮动信号
              </h2>
              <FactorRotationSignal {...factorRotation} />
            </div>
          )}

          {/* 因子强度排名 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              📈 因子强度排名
            </h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <span className="animate-spin text-4xl">⏳</span>
              </div>
            ) : factors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {factors.map((factor) => (
                  <FactorStrengthCard key={factor.factor} {...factor} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                暂无因子数据，请先同步因子 ETF 数据
              </div>
            )}
          </div>

          {/* 因子 ETF 详细表现 */}
          {etfPerformance.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                📋 因子 ETF 详细表现
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">ETF</th>
                      <th className="text-left py-2 px-3">名称</th>
                      <th className="text-left py-2 px-3">因子</th>
                      <th className="text-right py-2 px-3">价格</th>
                      <th className="text-right py-2 px-3">日涨跌</th>
                      <th className="text-right py-2 px-3">5日</th>
                      <th className="text-right py-2 px-3">20日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfPerformance.map((etf) => (
                      <tr key={etf.symbol} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etf.color }} />
                            <span className="font-mono">{etf.symbol}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{etf.name_cn || etf.name}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                            {etf.factor}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                          ${etf.close?.toFixed(2)}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${getTrendColor(etf.change_1d)}`}>
                          {etf.change_1d >= 0 ? "+" : ""}{etf.change_1d.toFixed(2)}%
                        </td>
                        <td className={`py-2 px-3 text-right ${getTrendColor(etf.change_5d)}`}>
                          {etf.change_5d >= 0 ? "+" : ""}{etf.change_5d.toFixed(2)}%
                        </td>
                        <td className={`py-2 px-3 text-right ${getTrendColor(etf.change_20d)}`}>
                          {etf.change_20d >= 0 ? "+" : ""}{etf.change_20d.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Finviz 热力图视图 */}
      {viewMode === "finviz" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            🗺️ Finviz 风格热力图
          </h2>
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <span className="animate-spin text-4xl">⏳</span>
            </div>
          ) : (
            <FinvizHeatmap
              data={finvizData}
              summary={finvizSummary || undefined}
              width={1100}
              height={500}
              onSectorClick={(sector) => {
                setSelectedSector(sector.symbol);
                setSuccess(`已选择板块: ${sector.name}`);
              }}
              onStockClick={(stock, sector) => {
                setSuccess(`${sector.name} - ${stock.symbol}: ${stock.name}`);
              }}
            />
          )}
        </div>
      )}

      {/* 使用说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">💡 使用说明</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li><strong>板块分析</strong>: 分析 11 个 SPDR 板块 ETF 的轮动情况</li>
          <li><strong>指数 ETF</strong>: 三大指数 (SPY/QQQ/DIA) + 罗素指数 + 全市场 ETF</li>
          <li><strong>行业 ETF</strong>: 半导体、银行、生物科技、零售、能源等细分行业</li>
          <li><strong>因子分析</strong>: 分析价值、成长、动量等 15 个因子 ETF 的强弱变化</li>
          <li><strong>主题 ETF</strong>: 创新科技、清洁能源、网络安全、云计算等主题</li>
          <li><strong>Finviz 热力图</strong>: 按板块分组展示股票，矩形大小代表市值，颜色代表涨跌</li>
          <li><strong>同步数据</strong>: 选择 ETF 类型后点击同步，从 EODHD API 获取数据</li>
        </ul>
      </div>
    </div>
  );
}
