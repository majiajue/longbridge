/**
 * 智能选股页面 - 现代化重构版
 */
import React, { useState, useEffect } from 'react';
import {
  FilterList,
  TrendingUp,
  TrendingDown,
  Add,
  Delete,
  DeleteSweep,
  Analytics,
  ExpandMore,
  ExpandLess,
  Close,
} from '@mui/icons-material';
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  Input,
  Tabs,
  ProgressBar,
  Alert,
  EmptyState,
  LoadingSpinner,
} from '../components/ui';
import {
  getPools,
  getAnalysisResults,
  addStock,
  batchAddStocks,
  removeStock,
  clearPool,
  analyzeStocks,
  type Stock,
  type Analysis,
  type PoolsResponse,
  type AnalysisResponse,
} from '../api/stockPicker';

export default function StockPicker() {
  const [pools, setPools] = useState<PoolsResponse>({ long_pool: [], short_pool: [] });
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogType, setAddDialogType] = useState<'LONG' | 'SHORT'>('LONG');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({
    current: '',
    total: 0,
    completed: 0,
    status: 'idle' as 'idle' | 'running' | 'completed',
  });

  const loadPools = async () => {
    try {
      setLoading(true);
      const data = await getPools();
      setPools(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async () => {
    try {
      const data = await getAnalysisResults({ sort_by: 'recommendation' });
      setAnalysis(data);
    } catch (err) {
      console.error('加载分析结果失败:', err);
    }
  };

  const handleAnalyze = async (poolType?: 'LONG' | 'SHORT') => {
    setAnalyzing(true);
    setError(null);
    setAnalysisLogs([]);
    setShowLogs(true);
    setAnalysisProgress({ current: '', total: 0, completed: 0, status: 'idle' });

    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const eventSource = new EventSource(`${API_BASE}/api/stock-picker/analysis/progress`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setAnalysisProgress({
          current: data.current || '',
          total: data.total || 0,
          completed: data.completed || 0,
          status: data.status || 'idle',
        });
        if (data.logs && data.logs.length > 0) {
          setAnalysisLogs(data.logs.map((log: any) => log.message));
        }
        if (data.status === 'completed') {
          eventSource.close();
          loadAnalysis();
        }
      } catch (e) {
        console.error('解析进度数据失败:', e);
      }
    };

    eventSource.onerror = () => eventSource.close();

    try {
      const result = await analyzeStocks({ pool_type: poolType, force_refresh: true });
      setSuccess(result.message);
      setTimeout(() => loadAnalysis(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      eventSource.close();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('确定要删除这只股票吗？')) return;
    try {
      await removeStock(id);
      setSuccess('删除成功');
      loadPools();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleClear = async (type: 'LONG' | 'SHORT') => {
    const poolName = type === 'LONG' ? '做多' : '做空';
    if (!confirm(`确定要清空${poolName}股票池吗？此操作不可恢复！`)) return;
    try {
      await clearPool(type);
      setSuccess(`${poolName}股票池已清空`);
      loadPools();
      loadAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空失败');
    }
  };

  const openAddDialog = (type: 'LONG' | 'SHORT') => {
    setAddDialogType(type);
    setShowAddDialog(true);
  };

  useEffect(() => {
    loadPools();
    loadAnalysis();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" text="加载股票池..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="智能选股分析"
        description="AI驱动的多维度量化评分系统"
        icon={<FilterList />}
        actions={
          <Button
            onClick={() => handleAnalyze()}
            loading={analyzing}
            icon={<Analytics className="w-4 h-4" />}
          >
            分析全部
          </Button>
        }
      />

      {/* 消息提示 */}
      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert type="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* 统计卡片 */}
      {analysis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="做多股票"
            value={analysis.stats.long_count}
            color="emerald"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="做多平均分"
            value={`${analysis.stats.long_avg_score.toFixed(1)}`}
            color="emerald"
          />
          <StatCard
            label="做空股票"
            value={analysis.stats.short_count}
            color="red"
            icon={<TrendingDown className="w-5 h-5" />}
          />
          <StatCard
            label="做空平均分"
            value={`${analysis.stats.short_avg_score.toFixed(1)}`}
            color="red"
          />
        </div>
      )}

      {/* 股票池 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockPoolCard
          title="做多股票池"
          type="LONG"
          stocks={pools.long_pool}
          analysis={analysis?.long_analysis || []}
          onAdd={() => openAddDialog('LONG')}
          onRemove={handleRemove}
          onAnalyze={() => handleAnalyze('LONG')}
          onClear={() => handleClear('LONG')}
          analyzing={analyzing}
        />
        <StockPoolCard
          title="做空股票池"
          type="SHORT"
          stocks={pools.short_pool}
          analysis={analysis?.short_analysis || []}
          onAdd={() => openAddDialog('SHORT')}
          onRemove={handleRemove}
          onAnalyze={() => handleAnalyze('SHORT')}
          onClear={() => handleClear('SHORT')}
          analyzing={analyzing}
        />
      </div>

      {/* 分析进度 */}
      {showLogs && (
        <Card>
          <CardHeader
            title="分析进度"
            icon={<Analytics className="w-5 h-5" />}
            action={
              <button
                onClick={() => setShowLogs(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <Close className="w-5 h-5 text-slate-500" />
              </button>
            }
          />

          {analysisProgress.status !== 'idle' && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">
                  {analysisProgress.status === 'running'
                    ? `正在分析: ${analysisProgress.current}`
                    : analysisProgress.status === 'completed'
                      ? '分析完成'
                      : '准备中...'}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {analysisProgress.completed} / {analysisProgress.total}
                </span>
              </div>
              <ProgressBar
                value={analysisProgress.completed}
                max={analysisProgress.total}
                variant={analysisProgress.status === 'completed' ? 'success' : 'default'}
              />
            </div>
          )}

          {analysisLogs.length > 0 && (
            <div className="bg-slate-900 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-sm">
              {analysisLogs.map((log, i) => (
                <div key={i} className="text-emerald-400 mb-1">
                  {log}
                </div>
              ))}
              {analyzing && <span className="text-emerald-400 animate-pulse">▋</span>}
            </div>
          )}
        </Card>
      )}

      {/* 添加股票对话框 */}
      {showAddDialog && (
        <AddStockDialog
          type={addDialogType}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            loadPools();
            setSuccess('添加成功');
          }}
        />
      )}
    </div>
  );
}

// 统计卡片
function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: 'emerald' | 'red';
  icon?: React.ReactNode;
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };
  const textColor = color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
        </div>
        {icon && <span className={textColor}>{icon}</span>}
      </div>
    </div>
  );
}

// 股票池卡片
function StockPoolCard({
  title,
  type,
  stocks,
  analysis,
  onAdd,
  onRemove,
  onAnalyze,
  onClear,
  analyzing,
}: {
  title: string;
  type: 'LONG' | 'SHORT';
  stocks: Stock[];
  analysis: Analysis[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onAnalyze: () => void;
  onClear: () => void;
  analyzing: boolean;
}) {
  const isLong = type === 'LONG';
  const borderColor = isLong
    ? 'border-l-emerald-500'
    : 'border-l-red-500';

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader
        title={title}
        icon={isLong ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
        action={
          <div className="flex gap-2">
            <Badge variant={isLong ? 'success' : 'danger'}>
              {stocks.length}/20
            </Badge>
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="secondary" onClick={onAdd} icon={<Add className="w-4 h-4" />}>
          添加
        </Button>
        <Button size="sm" variant="secondary" onClick={onAnalyze} disabled={analyzing} icon={<Analytics className="w-4 h-4" />}>
          分析
        </Button>
        <Button size="sm" variant="danger" onClick={onClear} disabled={stocks.length === 0} icon={<DeleteSweep className="w-4 h-4" />}>
          清空
        </Button>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {analysis.length === 0 ? (
          <EmptyState
            title="暂无分析结果"
            description="点击「分析」按钮开始分析"
            icon={<Analytics />}
          />
        ) : (
          analysis.map((item, index) => (
            <StockItem
              key={item.id}
              rank={index + 1}
              analysis={item}
              type={type}
              onRemove={() => onRemove(item.pool_id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

// 股票项
function StockItem({
  rank,
  analysis,
  type,
  onRemove,
}: {
  rank: number;
  analysis: Analysis;
  type: 'LONG' | 'SHORT';
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const gradeStyles: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
    B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    C: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
    D: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  };

  const priceChangeColor = analysis.price_change_1d >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400 w-6">#{rank}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">{analysis.symbol}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${gradeStyles[analysis.score.grade] || gradeStyles.D}`}>
                {analysis.score.grade}级
              </span>
            </div>
            {analysis.name && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{analysis.name}</p>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      {/* 价格和评分 */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          {analysis.current_price > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                ${analysis.current_price.toFixed(2)}
              </span>
              <span className={`text-sm font-medium ${priceChangeColor}`}>
                {analysis.price_change_1d >= 0 ? '+' : ''}{analysis.price_change_1d.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">评分</p>
          <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
            {analysis.score.total.toFixed(0)}/100
          </p>
        </div>
      </div>

      {/* 推荐理由 */}
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
        {analysis.recommendation_reason}
      </p>

      {/* 信号标签 */}
      <div className="mt-3 flex flex-wrap gap-1">
        {analysis.signals.slice(0, 3).map((signal, i) => (
          <span key={i} className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded text-xs">
            {signal}
          </span>
        ))}
      </div>

      {/* 展开详情 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700"
      >
        {expanded ? <ExpandLess className="w-4 h-4" /> : <ExpandMore className="w-4 h-4" />}
        {expanded ? '收起' : '详情'}
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
          {/* 评分细节 */}
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">评分细节</p>
            <div className="space-y-2">
              <ScoreRow label="波动" value={analysis.score.breakdown.volatility} max={25} />
              <ScoreRow label="新闻" value={analysis.score.breakdown.news || 0} max={20} />
              <ScoreRow label="动量" value={analysis.score.breakdown.momentum} max={18} />
              <ScoreRow label="趋势" value={analysis.score.breakdown.trend} max={15} />
              <ScoreRow label="量能" value={analysis.score.breakdown.volume} max={12} />
              <ScoreRow label="形态" value={analysis.score.breakdown.pattern} max={10} />
            </div>
          </div>

          {/* AI分析 */}
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">AI分析</p>
            <ul className="space-y-1">
              {analysis.ai_decision.reasoning.map((reason, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <span className="text-cyan-500 mt-1">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// 评分行
function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = (value / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-10">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-12 text-right">
        {value.toFixed(0)}/{max}
      </span>
    </div>
  );
}

// 添加股票对话框
function AddStockDialog({
  type,
  onClose,
  onSuccess,
}: {
  type: 'LONG' | 'SHORT';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [batchMode, setBatchMode] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [batchSymbols, setBatchSymbols] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [clearBeforeAdd, setClearBeforeAdd] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (batchMode) {
      if (!batchSymbols.trim()) {
        setError('请输入股票代码');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (clearBeforeAdd) {
          await clearPool(type);
        }

        const symbols = batchSymbols
          .replace(/[\[\]'"`]/g, '')
          .split(/[,\s\n]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0);

        if (symbols.length === 0) {
          setError('请输入有效的股票代码');
          return;
        }

        const result = await batchAddStocks({ pool_type: type, symbols });

        if (result.failed.length > 0) {
          setError(`成功添加 ${result.success_count} 只，失败 ${result.failed.length} 只`);
        }

        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : '批量添加失败');
      } finally {
        setLoading(false);
      }
    } else {
      if (!symbol.trim()) {
        setError('请输入股票代码');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await addStock({
          pool_type: type,
          symbol: symbol.trim().toUpperCase(),
          name: name.trim() || undefined,
          added_reason: reason.trim() || undefined,
        });
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : '添加失败');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            添加到{type === 'LONG' ? '做多' : '做空'}池
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <Close className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <Tabs
          tabs={[
            { id: 'single', label: '单个添加' },
            { id: 'batch', label: '批量添加' },
          ]}
          activeTab={batchMode ? 'batch' : 'single'}
          onChange={(id) => setBatchMode(id === 'batch')}
        />

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {batchMode ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  股票代码列表
                </label>
                <textarea
                  value={batchSymbols}
                  onChange={(e) => setBatchSymbols(e.target.value)}
                  placeholder="每行一个或用逗号分隔&#10;AAPL.US, MSFT.US, GOOGL.US"
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                    bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm
                    focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearBeforeAdd}
                  onChange={(e) => setClearBeforeAdd(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  添加前清空现有股票
                </span>
              </label>
            </>
          ) : (
            <>
              <Input
                label="股票代码"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="例如: AAPL.US"
                required
              />
              <Input
                label="股票名称（可选）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: Apple Inc."
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  添加理由（可选）
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例如: 科技龙头，业绩稳定"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                    bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm
                    focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                />
              </div>
            </>
          )}

          {error && <Alert type="error">{error}</Alert>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {batchMode ? '批量添加' : '添加'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
