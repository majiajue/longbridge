/**
 * 板块轮动分析页面 - 现代化重构版
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Whatshot,
  Sync,
  Refresh,
  TrendingUp,
  TrendingDown,
  Add,
  FilterList,
  Inventory,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  Tabs,
  Select,
  Alert,
  LoadingSpinner,
  EmptyState,
  ProgressBar,
} from "../components/ui";
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
  getETFHoldings,
  syncETFHoldings,
  type SectorInfo,
  type HeatmapItem,
  type SectorStock,
  type FinvizSector,
  type FactorInfo,
  type FactorRotation as FactorRotationType,
  type ETFPerformance,
  type ETFType,
  type ETFHolding,
} from "../api/sectorRotation";
import { SectorCardGrid } from "../components/SectorHeatmap";
import FinvizHeatmap, {
  FactorStrengthCard,
  FactorRotationSignal,
} from "../components/FinvizHeatmap";

type ViewMode = "sector" | "factor" | "finviz" | "holdings";

export default function SectorRotation() {
  const [viewMode, setViewMode] = useState<ViewMode>("sector");
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [screenedStocks, setScreenedStocks] = useState<Record<string, SectorStock[]>>({});
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [finvizData, setFinvizData] = useState<FinvizSector[]>([]);
  const [finvizSummary, setFinvizSummary] = useState<any>(null);
  const [factors, setFactors] = useState<FactorInfo[]>([]);
  const [factorRotation, setFactorRotation] = useState<FactorRotationType | null>(null);
  const [etfPerformance, setEtfPerformance] = useState<ETFPerformance[]>([]);
  const [etfHoldings, setEtfHoldings] = useState<Record<string, { holdings: ETFHolding[]; sector_weights: Record<string, number> }>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingHoldings, setSyncingHoldings] = useState(false);
  const [screening, setScreening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topN, setTopN] = useState(3);
  const [stocksPerSector, setStocksPerSector] = useState(10);
  const [syncType, setSyncType] = useState<ETFType>("sector");
  const [expandedETF, setExpandedETF] = useState<string | null>(null);

  const loadSectorData = useCallback(async () => {
    setLoading(true);
    try {
      const [sectorsRes, heatmapRes] = await Promise.all([getSectors(), getHeatmapData()]);
      setSectors(sectorsRes.sectors || []);
      setHeatmapData(heatmapRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFinvizData = useCallback(async () => {
    setLoading(true);
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

  const loadFactorData = useCallback(async () => {
    setLoading(true);
    try {
      const [factorsRes, rotationRes, perfRes] = await Promise.all([
        getFactors(),
        getFactorRotation(20),
        getETFPerformance("factor"),
      ]);
      setFactors(factorsRes.factors || []);
      setFactorRotation(rotationRes);
      setEtfPerformance(perfRes.etfs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载因子数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHoldingsData = useCallback(async () => {
    setLoading(true);
    try {
      // 先加载板块数据
      const sectorsRes = await getSectors();
      setSectors(sectorsRes.sectors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载持仓数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadETFHoldings = async (symbol: string) => {
    if (etfHoldings[symbol]) {
      // 已经加载过
      return;
    }
    try {
      const res = await getETFHoldings(symbol);
      setEtfHoldings((prev) => ({
        ...prev,
        [symbol]: {
          holdings: res.top_10_holdings || res.holdings || [],
          sector_weights: res.sector_weights || {},
        },
      }));
    } catch (err) {
      console.error(`加载 ${symbol} 持仓失败:`, err);
    }
  };

  const handleSyncHoldings = async () => {
    setSyncingHoldings(true);
    setError(null);
    try {
      const result = await syncETFHoldings("sector");
      setSuccess(`持仓同步完成: ${result.success?.length || 0} 个 ETF`);
      // 清空缓存，重新加载
      setEtfHoldings({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步持仓失败");
    } finally {
      setSyncingHoldings(false);
    }
  };

  const loadData = useCallback(async () => {
    setError(null);
    switch (viewMode) {
      case "sector": await loadSectorData(); break;
      case "finviz": await loadFinvizData(); break;
      case "factor": await loadFactorData(); break;
      case "holdings": await loadHoldingsData(); break;
    }
  }, [viewMode, loadSectorData, loadFinvizData, loadFactorData, loadHoldingsData]);

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

  const handleAddToPicker = async (sectorSymbol: string) => {
    try {
      const result = await addSectorStocksToPicker(sectorSymbol, "LONG");
      setSuccess(result.message || `已添加 ${result.added} 只股票到选股池`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const getTrendColor = (change: number) => {
    if (change > 2) return "text-emerald-600 dark:text-emerald-400";
    if (change > 0) return "text-emerald-500";
    if (change < -2) return "text-red-600 dark:text-red-400";
    if (change < 0) return "text-red-500";
    return "text-slate-500";
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "strong_up": return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case "up": return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case "strong_down": return <TrendingDown className="w-4 h-4 text-red-500" />;
      case "down": return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <span className="text-slate-400">-</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="板块轮动分析"
        description="支持 62 个 ETF 分析：板块、指数、行业、因子、主题"
        icon={<Whatshot />}
        actions={
          <div className="flex items-center gap-3">
            <Select
              value={syncType}
              onChange={(e) => setSyncType(e.target.value as ETFType)}
              options={[
                { value: "sector", label: "板块 ETF (11)" },
                { value: "index", label: "指数 ETF (9)" },
                { value: "industry", label: "行业 ETF (15)" },
                { value: "factor", label: "因子 ETF (14)" },
                { value: "theme", label: "主题 ETF (13)" },
                { value: "all", label: "全部 ETF (62)" },
              ]}
            />
            <Button onClick={handleSync} loading={syncing} icon={<Sync className="w-4 h-4" />}>
              同步数据
            </Button>
            <Button variant="secondary" onClick={() => loadData()} disabled={loading} icon={<Refresh className="w-4 h-4" />}>
              刷新
            </Button>
          </div>
        }
      />

      {/* 消息提示 */}
      {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* 视图切换 */}
      <Tabs
        tabs={[
          { id: "sector", label: "板块分析", icon: <Whatshot className="w-4 h-4" /> },
          { id: "holdings", label: "ETF 持仓", icon: <Inventory className="w-4 h-4" /> },
          { id: "factor", label: "因子分析", icon: <TrendingUp className="w-4 h-4" /> },
          { id: "finviz", label: "Finviz 热力图" },
        ]}
        activeTab={viewMode}
        onChange={(id) => setViewMode(id as ViewMode)}
      />

      {/* 板块分析视图 */}
      {viewMode === "sector" && (
        <>
          <Card>
            <CardHeader title="板块热力图" icon={<Whatshot className="w-5 h-5" />} />
            {loading ? (
              <LoadingSpinner text="加载热力图..." />
            ) : heatmapData.length > 0 ? (
              <SectorCardGrid data={heatmapData} onSectorClick={(s) => setSelectedSector(s.symbol)} />
            ) : (
              <EmptyState title="暂无数据" description="请先同步数据" icon={<Whatshot />} />
            )}
          </Card>

          <Card>
            <CardHeader title="板块强度排名" icon={<TrendingUp className="w-5 h-5" />} />
            {sectors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="py-3 px-3 font-medium text-slate-500">排名</th>
                      <th className="py-3 px-3 font-medium text-slate-500">板块</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">日涨跌</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">5日</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">20日</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">强度</th>
                      <th className="py-3 px-3 text-center font-medium text-slate-500">趋势</th>
                      <th className="py-3 px-3 text-center font-medium text-slate-500">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectors.map((sector) => (
                      <tr
                        key={sector.symbol}
                        className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                          selectedSector === sector.symbol ? "bg-cyan-50 dark:bg-cyan-900/20" : ""
                        }`}
                        onClick={() => setSelectedSector(sector.symbol)}
                      >
                        <td className="py-3 px-3">
                          <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                            sector.rank <= 3 ? "bg-amber-400 text-amber-900" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          }`}>
                            {sector.rank}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">{sector.name_cn}</div>
                              <div className="text-xs text-slate-500">{sector.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`py-3 px-3 text-right font-medium ${getTrendColor(sector.change_1d)}`}>
                          {sector.change_1d >= 0 ? "+" : ""}{sector.change_1d.toFixed(2)}%
                        </td>
                        <td className={`py-3 px-3 text-right ${getTrendColor(sector.change_5d)}`}>
                          {sector.change_5d >= 0 ? "+" : ""}{sector.change_5d.toFixed(2)}%
                        </td>
                        <td className={`py-3 px-3 text-right ${getTrendColor(sector.change_20d)}`}>
                          {sector.change_20d >= 0 ? "+" : ""}{sector.change_20d.toFixed(2)}%
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold text-slate-900 dark:text-white">{sector.strength_score.toFixed(1)}</span>
                        </td>
                        <td className="py-3 px-3 text-center">{getTrendIcon(sector.trend)}</td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleAddToPicker(sector.symbol); }}
                            icon={<Add className="w-3 h-3" />}
                          >
                            选股
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="暂无排名数据" description="请先同步数据" />
            )}
          </Card>

          <Card>
            <CardHeader
              title="强势板块股票筛选"
              icon={<FilterList className="w-5 h-5" />}
              action={
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">前</span>
                    <select
                      value={topN}
                      onChange={(e) => setTopN(Number(e.target.value))}
                      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    >
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-slate-500">板块，每板块</span>
                    <select
                      value={stocksPerSector}
                      onChange={(e) => setStocksPerSector(Number(e.target.value))}
                      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    >
                      {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-slate-500">只</span>
                  </div>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={handleScreen}
                    loading={screening}
                    disabled={sectors.length === 0}
                    icon={<FilterList className="w-4 h-4" />}
                  >
                    开始筛选
                  </Button>
                </div>
              }
            />

            {Object.keys(screenedStocks).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(screenedStocks).map(([sectorSymbol, stocks]) => {
                  const sectorInfo = sectors.find((s) => s.symbol === sectorSymbol);
                  return (
                    <div key={sectorSymbol} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800"
                        style={{ borderLeft: `4px solid ${sectorInfo?.color || "#666"}` }}
                      >
                        <span className="font-medium text-slate-900 dark:text-white">
                          {sectorInfo?.name_cn || sectorSymbol}
                        </span>
                        <Badge variant="default">{stocks.length} 只</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-left">
                              <th className="py-2 px-3 font-medium text-slate-500">#</th>
                              <th className="py-2 px-3 font-medium text-slate-500">代码</th>
                              <th className="py-2 px-3 font-medium text-slate-500">名称</th>
                              <th className="py-2 px-3 text-right font-medium text-slate-500">市值</th>
                              <th className="py-2 px-3 text-right font-medium text-slate-500">价格</th>
                              <th className="py-2 px-3 text-right font-medium text-slate-500">涨跌</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stocks.map((stock, idx) => (
                              <tr key={stock.symbol} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-mono text-slate-900 dark:text-white">{stock.symbol}</td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{stock.name || "-"}</td>
                                <td className="py-2 px-3 text-right text-slate-500">
                                  {stock.market_cap ? `$${(stock.market_cap / 1e9).toFixed(1)}B` : "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-slate-900 dark:text-white">
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
              <EmptyState title="暂无筛选结果" description="点击「开始筛选」从强势板块中筛选股票" icon={<FilterList />} />
            )}
          </Card>
        </>
      )}

      {/* 因子分析视图 */}
      {viewMode === "factor" && (
        <>
          {factorRotation && (
            <Card>
              <CardHeader title="因子轮动信号" icon={<TrendingUp className="w-5 h-5" />} />
              <FactorRotationSignal {...factorRotation} />
            </Card>
          )}

          <Card>
            <CardHeader title="因子强度排名" icon={<TrendingUp className="w-5 h-5" />} />
            {loading ? (
              <LoadingSpinner text="加载因子数据..." />
            ) : factors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {factors.map((factor) => (
                  <FactorStrengthCard key={factor.factor} {...factor} />
                ))}
              </div>
            ) : (
              <EmptyState title="暂无因子数据" description="请先同步因子 ETF 数据" />
            )}
          </Card>

          {etfPerformance.length > 0 && (
            <Card>
              <CardHeader title="因子 ETF 详细表现" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="py-3 px-3 font-medium text-slate-500">ETF</th>
                      <th className="py-3 px-3 font-medium text-slate-500">名称</th>
                      <th className="py-3 px-3 font-medium text-slate-500">因子</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">价格</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">日涨跌</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">5日</th>
                      <th className="py-3 px-3 text-right font-medium text-slate-500">20日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfPerformance.map((etf) => (
                      <tr key={etf.symbol} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etf.color }} />
                            <span className="font-mono">{etf.symbol}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{etf.name_cn || etf.name}</td>
                        <td className="py-3 px-3">
                          <Badge variant="info">{etf.factor}</Badge>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-white">${etf.close?.toFixed(2)}</td>
                        <td className={`py-3 px-3 text-right font-medium ${getTrendColor(etf.change_1d)}`}>
                          {etf.change_1d >= 0 ? "+" : ""}{etf.change_1d.toFixed(2)}%
                        </td>
                        <td className={`py-3 px-3 text-right ${getTrendColor(etf.change_5d)}`}>
                          {etf.change_5d >= 0 ? "+" : ""}{etf.change_5d.toFixed(2)}%
                        </td>
                        <td className={`py-3 px-3 text-right ${getTrendColor(etf.change_20d)}`}>
                          {etf.change_20d >= 0 ? "+" : ""}{etf.change_20d.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Finviz 热力图视图 */}
      {viewMode === "finviz" && (
        <Card>
          <CardHeader title="Finviz 风格热力图" />
          {loading ? (
            <LoadingSpinner text="加载热力图..." />
          ) : (
            <FinvizHeatmap
              data={finvizData}
              summary={finvizSummary || undefined}
              width={1100}
              height={500}
              onSectorClick={(sector) => { setSelectedSector(sector.symbol); setSuccess(`已选择板块: ${sector.name}`); }}
              onStockClick={(stock, sector) => { setSuccess(`${sector.name} - ${stock.symbol}: ${stock.name}`); }}
            />
          )}
        </Card>
      )}

      {/* ETF 持仓视图 */}
      {viewMode === "holdings" && (
        <>
          <Card>
            <CardHeader
              title="板块 ETF 成分股"
              icon={<Inventory className="w-5 h-5" />}
              action={
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleSyncHoldings}
                  loading={syncingHoldings}
                  icon={<Sync className="w-4 h-4" />}
                >
                  同步持仓
                </Button>
              }
            />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              点击板块展开查看成分股和权重分布。需要配置 EODHD API Key 获取数据。
            </p>

            {loading ? (
              <LoadingSpinner text="加载数据..." />
            ) : sectors.length === 0 ? (
              <EmptyState
                title="暂无板块数据"
                description="请先同步板块 ETF 数据"
                icon={<Inventory />}
              />
            ) : (
              <div className="space-y-3">
                {sectors.map((sector) => {
                  const isExpanded = expandedETF === sector.symbol;
                  const holdings = etfHoldings[sector.symbol];

                  return (
                    <div
                      key={sector.symbol}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                    >
                      {/* 板块标题 */}
                      <button
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedETF(null);
                          } else {
                            setExpandedETF(sector.symbol);
                            loadETFHoldings(sector.symbol);
                          }
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                          <span className="font-medium text-slate-900 dark:text-white">{sector.name_cn}</span>
                          <span className="text-sm text-slate-500">{sector.symbol}</span>
                          <span className={`text-sm font-medium ${getTrendColor(sector.change_1d)}`}>
                            {sector.change_1d >= 0 ? "+" : ""}{sector.change_1d.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={sector.change_1d >= 0 ? "success" : "danger"}>
                            强度 {sector.strength_score.toFixed(0)}
                          </Badge>
                          {isExpanded ? (
                            <ExpandLess className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ExpandMore className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* 展开内容 */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                          {!holdings ? (
                            <LoadingSpinner size="sm" text="加载持仓数据..." />
                          ) : holdings.holdings.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">
                              暂无持仓数据，请先点击「同步持仓」获取
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* 板块权重分布 */}
                              {Object.keys(holdings.sector_weights).length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                    板块权重分布
                                  </h4>
                                  <div className="space-y-2">
                                    {Object.entries(holdings.sector_weights)
                                      .sort(([, a], [, b]) => b - a)
                                      .slice(0, 8)
                                      .map(([name, weight]) => (
                                        <div key={name} className="flex items-center gap-2">
                                          <span className="text-xs text-slate-500 w-24 truncate">{name}</span>
                                          <div className="flex-1">
                                            <ProgressBar value={weight} max={100} variant="default" />
                                          </div>
                                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-12 text-right">
                                            {weight.toFixed(1)}%
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* 前10大持仓 */}
                              <div>
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                  前 {Math.min(10, holdings.holdings.length)} 大持仓
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                                        <th className="py-2 px-2 font-medium text-slate-500">#</th>
                                        <th className="py-2 px-2 font-medium text-slate-500">股票</th>
                                        <th className="py-2 px-2 font-medium text-slate-500">名称</th>
                                        <th className="py-2 px-2 text-right font-medium text-slate-500">权重</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {holdings.holdings.slice(0, 10).map((h, idx) => (
                                        <tr
                                          key={h.symbol || idx}
                                          className="border-b border-slate-100 dark:border-slate-700/50"
                                        >
                                          <td className="py-2 px-2 text-slate-400">{idx + 1}</td>
                                          <td className="py-2 px-2 font-mono text-slate-900 dark:text-white">
                                            {h.code || h.symbol}
                                          </td>
                                          <td className="py-2 px-2 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                                            {h.name || "-"}
                                          </td>
                                          <td className="py-2 px-2 text-right font-medium text-cyan-600 dark:text-cyan-400">
                                            {h.assets_pct.toFixed(2)}%
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 添加到选股池 */}
                          {holdings && holdings.holdings.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => handleAddToPicker(sector.symbol)}
                                icon={<Add className="w-4 h-4" />}
                              >
                                添加到选股池
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* 使用说明 */}
      <Alert type="info">
        <strong>使用说明：</strong>板块分析支持 11 个 SPDR 板块 ETF；ETF 持仓展示成分股和权重；因子分析支持 15 个因子 ETF；Finviz 热力图展示股票市值与涨跌。选择 ETF 类型后点击同步获取数据。
      </Alert>
    </div>
  );
}
