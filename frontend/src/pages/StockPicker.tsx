/**
 * 智能选股页面
 */
import React, { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogType, setAddDialogType] = useState<'LONG' | 'SHORT'>('LONG');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // 🔥 新增：进度条状态
  const [analysisProgress, setAnalysisProgress] = useState({
    current: '',
    total: 0,
    completed: 0,
    status: 'idle' as 'idle' | 'running' | 'completed',
  });

  // 加载股票池
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

  // 加载分析结果
  const loadAnalysis = async () => {
    try {
      const data = await getAnalysisResults({ sort_by: 'recommendation' });
      setAnalysis(data);
    } catch (err) {
      console.error('加载分析结果失败:', err);
    }
  };

  // 触发分析
  const handleAnalyze = async (poolType?: 'LONG' | 'SHORT') => {
    setAnalyzing(true);
    setError(null);
    setAnalysisLogs([]);
    setShowLogs(true);
    
    // 🔥 重置进度
    setAnalysisProgress({
      current: '',
      total: 0,
      completed: 0,
      status: 'idle',
    });
    
    // 连接SSE获取实时日志和进度
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const eventSource = new EventSource(`${API_BASE}/api/stock-picker/analysis/progress`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 🔥 更新进度条
        setAnalysisProgress({
          current: data.current || '',
          total: data.total || 0,
          completed: data.completed || 0,
          status: data.status || 'idle',
        });
        
        // 更新日志
        if (data.logs && data.logs.length > 0) {
          setAnalysisLogs(data.logs.map((log: any) => log.message));
        }
        
        // 如果完成，关闭连接
        if (data.status === 'completed') {
          eventSource.close();
          loadAnalysis();
        }
      } catch (e) {
        console.error('解析进度数据失败:', e);
      }
    };
    
    eventSource.onerror = () => {
      eventSource.close();
    };
    
    try {
      const result = await analyzeStocks({
        pool_type: poolType,
        force_refresh: true,
      });
      
      setSuccess(result.message);
      
      // 等待2秒后刷新结果
      setTimeout(() => {
        loadAnalysis();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      eventSource.close();
    } finally {
      setAnalyzing(false);
    }
  };

  // 删除股票
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

  // 打开添加对话框
  const openAddDialog = (type: 'LONG' | 'SHORT') => {
    setAddDialogType(type);
    setShowAddDialog(true);
  };

  useEffect(() => {
    loadPools();
    loadAnalysis();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 标题栏 */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 智能选股分析</h1>
            <p className="text-gray-600 mt-1">
              AI驱动的多维度量化评分系统
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnalyze()}
              disabled={analyzing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {analyzing ? '🔄 分析中...' : '🔄 分析全部'}
            </button>
          </div>
        </div>

        {/* 消息提示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
            <span className="text-red-700">❌ {error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
            <span className="text-green-700">✅ {success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 做多池 */}
        <StockPool
          title="做多股票池"
          type="LONG"
          stocks={pools.long_pool}
          analysis={analysis?.long_analysis || []}
          onAdd={() => openAddDialog('LONG')}
          onRemove={handleRemove}
          onAnalyze={() => handleAnalyze('LONG')}
          analyzing={analyzing}
        />

        {/* 做空池 */}
        <StockPool
          title="做空股票池"
          type="SHORT"
          stocks={pools.short_pool}
          analysis={analysis?.short_analysis || []}
          onAdd={() => openAddDialog('SHORT')}
          onRemove={handleRemove}
          onAnalyze={() => handleAnalyze('SHORT')}
          analyzing={analyzing}
        />
      </div>

      {/* 🔥 分析进度和日志 */}
      {showLogs && (
        <div className="max-w-7xl mx-auto mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">📊 分析进度</h3>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕ 关闭
              </button>
            </div>
            
            {/* 🔥 进度条区域 */}
            {analysisProgress.status !== 'idle' && (
              <div className="mb-6">
                {/* 当前分析股票和进度数字 */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {analysisProgress.status === 'running' && analysisProgress.current ? (
                      <>
                        正在分析: <span className="text-blue-600 font-semibold">{analysisProgress.current}</span>
                      </>
                    ) : analysisProgress.status === 'completed' ? (
                      <span className="text-green-600">✅ 分析完成！</span>
                    ) : (
                      '准备分析...'
                    )}
                  </span>
                  <span className="text-sm font-semibold text-gray-600">
                    {analysisProgress.completed} / {analysisProgress.total}
                  </span>
                </div>
                
                {/* 进度条 */}
                <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ease-out ${
                      analysisProgress.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'
                    }`}
                    style={{
                      width: analysisProgress.total > 0 
                        ? `${Math.min((analysisProgress.completed / analysisProgress.total) * 100, 100)}%`
                        : '0%',
                    }}
                  >
                    {/* 动画效果 */}
                    {analysisProgress.status === 'running' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                    )}
                  </div>
                </div>
                
                {/* 百分比显示 */}
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">
                    {analysisProgress.status === 'completed' 
                      ? `成功分析 ${analysisProgress.total} 只股票`
                      : `正在分析中...`
                    }
                  </span>
                  <span className="text-xs font-semibold text-gray-600">
                    {analysisProgress.total > 0 
                      ? `${Math.round((analysisProgress.completed / analysisProgress.total) * 100)}%`
                      : '0%'
                    }
                  </span>
                </div>
              </div>
            )}
            
            {/* 详细日志 */}
            {analysisLogs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-2">📝 详细日志</h4>
                <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-60 overflow-y-auto">
                  {analysisLogs.map((log, i) => (
                    <div key={i} className="mb-1">
                      {log}
                    </div>
                  ))}
                  {analyzing && (
                    <div className="animate-pulse">▋</div>
                  )}
                </div>
              </div>
            )}
            
            {/* 空状态 */}
            {analysisLogs.length === 0 && analysisProgress.status === 'idle' && (
              <div className="text-center text-gray-500 py-8">
                <p>等待分析开始...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {analysis && (
        <div className="max-w-7xl mx-auto mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📈 统计信息</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-gray-600">做多池</p>
                <p className="text-2xl font-bold text-green-600">
                  平均评分: {analysis.stats.long_avg_score.toFixed(1)}/100
                </p>
                <p className="text-sm text-gray-500">
                  共 {analysis.stats.long_count} 只股票
                </p>
              </div>
              <div>
                <p className="text-gray-600">做空池</p>
                <p className="text-2xl font-bold text-red-600">
                  平均评分: {analysis.stats.short_avg_score.toFixed(1)}/100
                </p>
                <p className="text-sm text-gray-500">
                  共 {analysis.stats.short_count} 只股票
                </p>
              </div>
            </div>
          </div>
        </div>
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

// ========== 子组件 ==========

interface StockPoolProps {
  title: string;
  type: 'LONG' | 'SHORT';
  stocks: Stock[];
  analysis: Analysis[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onAnalyze: () => void;
  analyzing: boolean;
}

function StockPool({
  title,
  type,
  stocks,
  analysis,
  onAdd,
  onRemove,
  onAnalyze,
  analyzing,
}: StockPoolProps) {
  const bgColor = type === 'LONG' ? 'bg-green-50' : 'bg-red-50';
  const borderColor = type === 'LONG' ? 'border-green-200' : 'border-red-200';
  const titleColor = type === 'LONG' ? 'text-green-700' : 'text-red-700';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-6`}>
      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-xl font-bold ${titleColor}`}>
          {type === 'LONG' ? '📈' : '📉'} {title} ({stocks.length}/20)
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
          >
            ➕ 添加
          </button>
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
          >
            🔍 分析
          </button>
        </div>
      </div>

      {/* 股票列表 */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {analysis.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>暂无分析结果</p>
            <p className="text-sm mt-2">点击「分析」按钮开始分析</p>
          </div>
        )}
        
        {analysis.map((item, index) => (
          <StockCard
            key={item.id}
            rank={index + 1}
            analysis={item}
            type={type}
            onRemove={() => onRemove(item.pool_id)}
          />
        ))}
      </div>
    </div>
  );
}

interface StockCardProps {
  rank: number;
  analysis: Analysis;
  type: 'LONG' | 'SHORT';
  onRemove: () => void;
}

function StockCard({ rank, analysis, type, onRemove }: StockCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  // 评级颜色
  const gradeColors: Record<string, string> = {
    'A': 'bg-green-100 text-green-700 border-green-300',
    'B': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'C': 'bg-orange-100 text-orange-700 border-orange-300',
    'D': 'bg-red-100 text-red-700 border-red-300',
  };
  
  const gradeEmoji: Record<string, string> = {
    'A': '🟢',
    'B': '🟡',
    'C': '🟠',
    'D': '🔴',
  };

  const gradeColor = gradeColors[analysis.score.grade] || 'bg-gray-100 text-gray-700 border-gray-300';
  const emoji = gradeEmoji[analysis.score.grade] || '⚪';

  // 价格涨跌颜色
  const priceChangeColor = analysis.price_change_1d >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeSymbol = analysis.price_change_1d >= 0 ? '↑' : '↓';

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border border-gray-200">
      {/* 头部信息 */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">#{rank}</span>
            <span className="font-bold text-lg">{analysis.symbol}</span>
            <span className={`px-2 py-0.5 rounded border text-xs font-medium ${gradeColor}`}>
              {emoji} {analysis.score.grade}级
            </span>
          </div>
          {analysis.name && (
            <p className="text-gray-600 text-sm mt-1">{analysis.name}</p>
          )}
        </div>
        
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 text-sm"
          title="删除"
        >
          🗑️
        </button>
      </div>

      {/* 价格信息 */}
      {analysis.current_price > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl font-bold">${analysis.current_price.toFixed(2)}</span>
          <span className={`${priceChangeColor} font-medium`}>
            {priceChangeSymbol} {Math.abs(analysis.price_change_1d).toFixed(2)}%
          </span>
        </div>
      )}

      {/* 评分信息 */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">量化评分</span>
          <span className="font-bold">{analysis.score.total.toFixed(1)}/100</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">推荐度</span>
          <span className="font-bold text-blue-600">{analysis.recommendation_score.toFixed(1)}/100</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">信心度</span>
          <span className="font-bold">{(analysis.ai_decision.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* 推荐理由 */}
      <div className="bg-gray-50 rounded p-2 mb-3">
        <p className="text-sm text-gray-700">{analysis.recommendation_reason}</p>
      </div>

      {/* 主要信号 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {analysis.signals.slice(0, 3).map((signal, i) => (
          <span
            key={i}
            className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
          >
            ✓ {signal}
          </span>
        ))}
      </div>

      {/* 展开/收起按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        {expanded ? '▲ 收起详情' : '▼ 查看详情'}
      </button>

      {/* 详细信息 */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          {/* 评分细节 */}
          <div>
            <p className="text-sm font-semibold mb-2">评分细节（V3.1 舆情增强版）：</p>
            <div className="space-y-1">
              <ScoreBar label="波动" value={analysis.score.breakdown.volatility} max={25} color="purple" />
              <ScoreBar label="新闻舆情" value={analysis.score.breakdown.news || 0} max={20} color="blue" />
              <ScoreBar label="动量" value={analysis.score.breakdown.momentum} max={18} />
              <ScoreBar label="趋势" value={analysis.score.breakdown.trend} max={15} />
              <ScoreBar label="量能" value={analysis.score.breakdown.volume} max={12} />
              <ScoreBar label="形态" value={analysis.score.breakdown.pattern} max={10} />
            </div>
            {!analysis.score.breakdown.news && (
              <p className="text-xs text-gray-500 mt-2">
                🔍 未启用新闻分析 - 请在"设置"页面配置Tavily API Key
              </p>
            )}
          </div>

          {/* AI理由 */}
          <div>
            <p className="text-sm font-semibold mb-2">AI分析：</p>
            <ul className="space-y-1">
              {analysis.ai_decision.reasoning.map((reason, i) => (
                <li key={i} className="text-sm text-gray-700">• {reason}</li>
              ))}
            </ul>
          </div>

          {/* 所有信号 */}
          {analysis.signals.length > 3 && (
            <div>
              <p className="text-sm font-semibold mb-2">全部信号：</p>
              <div className="flex flex-wrap gap-1">
                {analysis.signals.map((signal, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

function ScoreBar({ label, value, max, color: customColor }: ScoreBarProps) {
  const percentage = (value / max) * 100;
  
  // 自定义颜色映射
  const colorMap: { [key: string]: string } = {
    'purple': 'bg-purple-500',
    'blue': 'bg-blue-500',
    'green': 'bg-green-500',
    'yellow': 'bg-yellow-500',
    'orange': 'bg-orange-500',
  };
  
  // 如果提供了自定义颜色，使用它；否则根据百分比自动选择
  const barColor = customColor && colorMap[customColor] 
    ? colorMap[customColor]
    : (percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-gray-400');

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-16">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium w-12 text-right">
        {value.toFixed(0)}/{max}
      </span>
    </div>
  );
}

// 添加股票对话框
interface AddStockDialogProps {
  type: 'LONG' | 'SHORT';
  onClose: () => void;
  onSuccess: () => void;
}

function AddStockDialog({ type, onClose, onSuccess }: AddStockDialogProps) {
  const [batchMode, setBatchMode] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [batchSymbols, setBatchSymbols] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [clearBeforeAdd, setClearBeforeAdd] = useState(true); // 添加前清空（默认勾选）
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (batchMode) {
      // 批量添加模式
      if (!batchSymbols.trim()) {
        setError('请输入股票代码');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 如果勾选了清空现有数据，先清空
        if (clearBeforeAdd) {
          await clearPool(type);
        }

        // 解析股票代码（支持逗号、空格、换行分隔，自动去除引号、方括号等）
        const symbols = batchSymbols
          .replace(/[\[\]'"`]/g, '') // 去除方括号、单引号、双引号、反引号
          .split(/[,\s\n]+/)
          .map(s => s.trim().toUpperCase())
          .filter(s => s.length > 0);
        
        if (symbols.length === 0) {
          setError('请输入有效的股票代码');
          return;
        }

        const result = await batchAddStocks({
          pool_type: type,
          symbols: symbols,
        });

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
      // 单个添加模式
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4">
          添加股票到{type === 'LONG' ? '做多' : '做空'}池
        </h3>

        {/* 模式切换 */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setBatchMode(false)}
            className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
              !batchMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            单个添加
          </button>
          <button
            type="button"
            onClick={() => setBatchMode(true)}
            className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
              batchMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            批量添加
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {batchMode ? (
            /* 批量添加模式 */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                股票代码列表 *
              </label>
              <textarea
                value={batchSymbols}
                onChange={(e) => setBatchSymbols(e.target.value)}
                placeholder="每行一个股票代码，或用逗号/空格分隔&#10;例如：&#10;AAPL.US&#10;MSFT.US&#10;GOOGL.US&#10;&#10;也可直接粘贴Python代码：&#10;['AAPL.US', 'MSFT.US', 'GOOGL.US']"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 支持直接粘贴Python列表代码，系统会自动解析
              </p>
              
              {/* 清空选项 */}
              <div className="mt-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearBeforeAdd}
                    onChange={(e) => setClearBeforeAdd(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    添加前先清空现有的{type === 'LONG' ? '多头' : '空头'}股票池
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  ⚠️ 勾选后，将删除现有的所有{type === 'LONG' ? '多头' : '空头'}股票，然后添加新股票
                </p>
              </div>
            </div>
          ) : (
            /* 单个添加模式 */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  股票代码 *
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="例如: AAPL.US"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持格式: AAPL.US, 00700.HK
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  股票名称（可选）
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如: Apple Inc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  添加理由（可选）
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例如: 科技龙头，业绩稳定"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (batchMode ? '批量添加中...' : '添加中...') : (batchMode ? '批量添加' : '确定添加')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

