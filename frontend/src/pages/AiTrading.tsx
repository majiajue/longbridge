import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Collapse,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SimpleKLineChart from '../components/SimpleKLineChart';
import AiAnalysisPanel from '../components/AiAnalysisPanel';
import { resolveWsUrl } from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

interface EngineStatus {
  running: boolean;
  enabled_in_config: boolean;
  symbols_monitoring: number;
  today_trades: number;
  today_pnl: number;
  current_positions: number;
  config: any;
}

interface AiAnalysis {
  id: number;
  symbol: string;
  analysis_time: string;
  action: string;
  confidence: number;
  reasoning: string[];
  current_price: number;
  triggered_trade: boolean;
  skip_reason?: string;
}

interface AiTrade {
  id: number;
  symbol: string;
  action: string;
  order_quantity: number;
  filled_price: number;
  status: string;
  pnl?: number;
  pnl_percent?: number;
  order_time: string;
  ai_confidence: number;
  ai_reasoning: string;
}

interface AiPosition {
  symbol: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  open_time: string;
}

export default function AiTradingPage() {
  const [activeTab, setActiveTab] = useState(0);
  
  // K线图相关（用于主视图）
  const [mainKlineSymbol, setMainKlineSymbol] = useState('');
  const [mainKlineData, setMainKlineData] = useState<any[]>([]);
  const [mainKlineLoading, setMainKlineLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [analyses, setAnalyses] = useState<AiAnalysis[]>([]);
  const [trades, setTrades] = useState<AiTrade[]>([]);
  const [positions, setPositions] = useState<AiPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [engineLoading, setEngineLoading] = useState(false); // 引擎启动/停止loading
  const [configDialog, setConfigDialog] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [symbolsInput, setSymbolsInput] = useState<string>(''); // 用于编辑的临时输入
  const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null);
  const [processLogs, setProcessLogs] = useState<string[]>([]); // 实时分析过程日志
  
  // K线图表相关
  const [showKlineDialog, setShowKlineDialog] = useState(false);
  const [selectedKlineSymbol, setSelectedKlineSymbol] = useState('');
  const [klineData, setKlineData] = useState<any[]>([]);
  const [klineLoading, setKlineLoading] = useState(false);
  
  // 日志自动滚动
  const analysisLogRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到日志底部
  useEffect(() => {
    if (analysisLogRef.current) {
      analysisLogRef.current.scrollTop = analysisLogRef.current.scrollHeight;
    }
  }, [analyses]);

  // 加载主K线图（1分钟K线，实时监控）
  const loadMainKline = async (symbol: string, autoSync: boolean = true) => {
    if (!symbol) {
      console.warn('⚠️ loadMainKline: symbol is empty');
      return;
    }
    
    console.log(`📊 开始加载K线数据: ${symbol} (1分钟K线)`);
    setMainKlineLoading(true);
    try {
      // 加载1分钟K线，200根约3-4小时的数据
      const response = await fetch(`${API_BASE}/ai-trading/klines/${symbol}?period=min1&limit=200`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ K线数据加载成功: ${symbol}, 数量: ${data.klines?.length || 0}`);
        setMainKlineData(data.klines || []);
        setMainKlineSymbol(symbol);
        setLastUpdateTime(new Date()); // 更新时间
      } else if (response.status === 404 && autoSync) {
        // 404表示没有K线数据，自动同步
        console.log(`🔄 ${symbol} 没有1分钟K线数据，开始自动同步...`);
        
        // 显示同步提示
        setMainKlineData([]);
        setMainKlineSymbol(symbol);
        
        // 同步1分钟K线（300根约5小时）
        const syncResponse = await fetch(`${API_BASE}/quotes/history/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: [symbol],
            period: 'min1',
            count: 300
          })
        });
        
        if (syncResponse.ok) {
          console.log(`✅ ${symbol} K线同步成功，重新加载...`);
          // 等待2秒让数据写入数据库
          await new Promise(resolve => setTimeout(resolve, 2000));
          // 重新加载，但不再自动同步（避免无限循环）
          await loadMainKline(symbol, false);
        } else {
          const errorText = await syncResponse.text();
          console.error(`❌ ${symbol} K线同步失败:`, errorText);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ K线加载失败:', errorText);
      }
    } catch (e) {
      console.error('❌ K线加载异常:', e);
    } finally {
      setMainKlineLoading(false);
    }
  };

  // 加载引擎状态
  const loadEngineStatus = async (loadDefaultKline: boolean = false) => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/status`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 引擎状态:', data);
        setEngineStatus(data);
        
        // 只在初始加载时自动加载第一个股票的K线
        // 如果用户已经选择了股票，不要覆盖
        if (loadDefaultKline && !mainKlineSymbol && data.config?.symbols && data.config.symbols.length > 0) {
          const firstSymbol = data.config.symbols[0];
          console.log(`🎯 初始加载第一个股票的K线: ${firstSymbol}`);
          await loadMainKline(firstSymbol);
        } else if (loadDefaultKline && mainKlineSymbol) {
          console.log(`ℹ️ 用户已选择股票 ${mainKlineSymbol}，跳过自动加载`);
        } else if (!data.config?.symbols || data.config.symbols.length === 0) {
          console.warn('⚠️ 配置中没有监控股票');
        }
      }
    } catch (e) {
      console.error('Failed to load engine status:', e);
    }
  };

  // 加载分析记录
  const loadAnalyses = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/analysis?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setAnalyses(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load analyses:', e);
    }
  };

  // 加载交易记录
  const loadTrades = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/trades?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load trades:', e);
    }
  };

  // 加载持仓
  const loadPositions = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/positions`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (e) {
      console.error('Failed to load positions:', e);
    }
  };

  // 删除单个持仓
  const deletePosition = async (symbol: string) => {
    if (!confirm(`确定要删除持仓 ${symbol}？\n\n⚠️ 此操作仅删除数据库记录，不会触发真实卖出。`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/ai-trading/positions/${symbol}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        alert(`✅ 持仓 ${symbol} 已删除`);
        await loadPositions();
        await loadEngineStatus(false);
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.detail}`);
      }
    } catch (e) {
      alert(`删除失败: ${e}`);
    }
  };

  // 清空所有持仓
  const clearAllPositions = async () => {
    if (!confirm(`确定要清空所有持仓？\n\n⚠️ 此操作仅删除数据库记录，不会触发真实卖出。\n建议仅在清理模拟数据时使用。`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/ai-trading/positions`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.message}\n删除了 ${data.deleted_count} 条持仓记录`);
        await loadPositions();
        await loadEngineStatus(false);
      } else {
        const error = await response.json();
        alert(`清空失败: ${error.detail}`);
      }
    } catch (e) {
      alert(`清空失败: ${e}`);
    }
  };

  // 加载所有数据
  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadEngineStatus(true),  // 初始加载时自动加载第一个股票
      loadAnalyses(),
      loadTrades(),
      loadPositions(),
    ]);
    setLoading(false);
  };

  // 刷新主K线图
  const refreshMainKline = () => {
    if (mainKlineSymbol) {
      loadMainKline(mainKlineSymbol);
    }
  };

  // WebSocket 连接
  useEffect(() => {
    loadAll();  // 初始加载
    
    // 创建 WebSocket 连接
    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/ai-trading';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('✅ Connected to AI Trading WebSocket');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'connected') {
          console.log('🤖 AI Trading WebSocket connected:', message);
        } else if (message.type === 'log') {
          // 收到实时过程日志
          const logMessage = message.data.message;
          setProcessLogs(prev => {
            const newLogs = [...prev, `${new Date().toLocaleTimeString()} ${logMessage}`];
            // 保持最新50条日志
            return newLogs.slice(-50);
          });
        } else if (message.type === 'ai_analysis') {
          // 收到新的AI分析，更新数据
          const analysisData = message.data;
          
          // ⚠️ 不要更新主K线图！
          // WebSocket推送的是日K线（用于AI分析），而主图显示的是1分钟K线
          // 混合两种周期的数据会导致图表混乱
          // 主K线图只通过手动刷新按钮或切换股票来更新
          
          // 更新最后更新时间（表示收到了新数据）
          setLastUpdateTime(new Date());
          
          // 更新AI分析记录（添加到列表顶部）
          setAnalyses(prev => {
            const newAnalysis: AiAnalysis = {
              id: analysisData.id,
              symbol: analysisData.symbol,
              analysis_time: analysisData.analysis_time,
              action: analysisData.action,
              confidence: analysisData.confidence,
              reasoning: analysisData.reasoning,
              current_price: analysisData.current_price,
              triggered_trade: false,
              skip_reason: analysisData.confidence < 0.75 ? `信心度 ${(analysisData.confidence * 100).toFixed(2)}% < 阈值 75.00%` : undefined
            };
            return [newAnalysis, ...prev.slice(0, 19)]; // 保持最新20条
          });
          
          console.log('📊 Received AI analysis:', analysisData.symbol, analysisData.action);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };
    
    // 定时刷新其他数据（持仓、交易记录等）
    const interval = setInterval(() => {
      loadTrades();
      loadPositions();
    }, 60000);
    
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [mainKlineSymbol]);

  // 启动引擎
  const startEngine = async () => {
    setEngineLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/start`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        await loadEngineStatus(false);  // 不覆盖用户已选股票
        alert(data.message || 'AI 交易引擎启动成功');
      } else {
        const error = await response.json();
        const errorMsg = typeof error.detail === 'string' 
          ? error.detail 
          : error.detail?.message || error.message || '启动失败';
        alert(`启动失败: ${errorMsg}`);
      }
    } catch (e) {
      console.error('启动失败:', e);
      alert(`启动失败: ${e}`);
    } finally {
      setEngineLoading(false);
    }
  };

  // 停止引擎
  const stopEngine = async () => {
    setEngineLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/stop`, {
        method: 'POST',
      });
      if (response.ok) {
        await loadEngineStatus(false);  // 不覆盖用户已选股票
      }
    } catch (e) {
      alert(`停止失败: ${e}`);
    } finally {
      setEngineLoading(false);
    }
  };

  // 立即触发分析
  const triggerAnalysis = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/engine/trigger`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.result.message}`);
        await loadAnalyses();  // 刷新分析列表
      } else {
        const error = await response.json();
        alert(`❌ ${error.detail || '触发失败'}`);
      }
    } catch (e) {
      alert(`触发失败: ${e}`);
    }
  };

  // 打开配置对话框
  const openConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-trading/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        // 初始化输入框内容
        setSymbolsInput(Array.isArray(data.symbols) ? data.symbols.join(', ') : '');
        setConfigDialog(true);
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    try {
      // 将输入文本转换为股票数组
      const symbols = symbolsInput
        .split(/[,，;\s\n]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      
      if (symbols.length === 0) {
        alert('⚠️ 请至少添加一只股票');
        return;
      }
      
      const configToSave = {
        ...config,
        symbols: symbols  // 直接使用用户输入的股票代码
      };
      
      const response = await fetch(`${API_BASE}/ai-trading/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });
      if (response.ok) {
        const updatedConfig = await response.json();
        setConfig(updatedConfig);  // ✅ 同步更新 config state
        setConfigDialog(false);
        
        // 🔄 自动同步K线数据
        alert('⏳ 正在同步K线数据，请稍候...');
        await syncKlinesForSymbols(symbols);
        
        await loadEngineStatus(false);  // 不覆盖用户已选股票
        alert('✅ 配置已保存并同步K线！监控股票：' + (updatedConfig.symbols?.join(', ') || '无'));
      } else {
        const error = await response.json();
        alert(`保存失败: ${error.detail}`);
      }
    } catch (e) {
      alert(`保存失败: ${e}`);
    }
  };

  // 同步K线数据（1分钟K线，实时监控）
  const syncKlinesForSymbols = async (symbols: string[]) => {
    try {
      const syncPromises = symbols.map(async (symbol) => {
        try {
          // 同步两种数据：1分钟K线（实时）+ 日线（AI分析用）
          const syncRequests = [
            {
              symbols: [symbol],
              period: 'min1',
              count: 300  // 约5小时的1分钟数据
            },
            {
              symbols: [symbol],
              period: 'day',
              count: 60   // 60天日线供AI分析
            }
          ];
          
          const responses = await Promise.all(
            syncRequests.map(req => 
              fetch(`${API_BASE}/quotes/history/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
              })
            )
          );
          
          const allSuccess = responses.every(r => r.ok);
          if (allSuccess) {
            console.log(`✅ ${symbol} K线同步成功（1分钟 + 日线）`);
            return { symbol, success: true };
          } else {
            const error = await responses[0].json();
            console.error(`❌ ${symbol} K线同步失败:`, error);
            return { symbol, success: false, error: error.detail };
          }
        } catch (e) {
          console.error(`❌ ${symbol} K线同步异常:`, e);
          return { symbol, success: false, error: String(e) };
        }
      });
      
      const results = await Promise.all(syncPromises);
      const successCount = results.filter(r => r.success).length;
      const failedSymbols = results.filter(r => !r.success).map(r => r.symbol);
      
      if (failedSymbols.length > 0) {
        console.warn(`部分股票同步失败: ${failedSymbols.join(', ')}`);
      }
      
      console.log(`📊 K线同步完成：成功 ${successCount}/${symbols.length}`);
      return results;
    } catch (e) {
      console.error('K线同步失败:', e);
      throw e;
    }
  };

  // 加载K线数据
  const loadKlineData = async (symbol: string) => {
    setKlineLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-trading/klines/${symbol}?period=day&count=100`);
      if (response.ok) {
        const data = await response.json();
        setKlineData(data.klines || []);
      } else {
        const error = await response.json();
        alert(`加载K线失败: ${error.detail}`);
      }
    } catch (e) {
      console.error('Failed to load klines:', e);
      alert(`加载K线失败: ${e}`);
    } finally {
      setKlineLoading(false);
    }
  };

  // 打开K线图表
  const openKlineChart = (symbol: string) => {
    setSelectedKlineSymbol(symbol);
    setShowKlineDialog(true);
    loadKlineData(symbol);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY':
        return 'success';
      case 'SELL':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'success';
      case 'FAILED':
        return 'error';
      default:
        return 'warning';
    }
  };

  if (loading && !engineStatus) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* 头部控制面板 */}
      <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white mb-6">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                🤖 AI 自动交易
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                DeepSeek 驱动的智能交易系统
              </Typography>
            </Box>
            <Box display="flex" gap={2} alignItems="center">
              <Chip
                label={engineStatus?.running ? '● 运行中' : '○ 已停止'}
                sx={{
                  bgcolor: engineStatus?.running ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
              <Chip
                icon={<span>📈</span>}
                label={`监控股票: ${engineStatus?.config?.symbols?.length || 0}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                icon={<span>📊</span>}
                label={`今日交易: ${engineStatus?.today_trades || 0}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                icon={<span>💰</span>}
                label={`今日盈亏: $${(engineStatus?.today_pnl || 0).toFixed(2)}`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: (engineStatus?.today_pnl || 0) >= 0 ? '#4caf50' : '#f44336',
                }}
              />
              <IconButton color="inherit" onClick={openConfig}>
                <SettingsIcon />
              </IconButton>
              <IconButton color="inherit" onClick={loadAll}>
                <RefreshIcon />
              </IconButton>
              {engineStatus?.running && (
                <Button
                  variant="contained"
                  startIcon={<FlashOnIcon />}
                  onClick={triggerAnalysis}
                  sx={{ bgcolor: 'rgba(255,193,7,0.8)', '&:hover': { bgcolor: 'rgba(255,193,7,1)' } }}
                >
                  立即分析
                </Button>
              )}
              {engineStatus?.running ? (
                <Button
                  variant="contained"
                  startIcon={engineLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <StopIcon />}
                  onClick={stopEngine}
                  disabled={engineLoading}
                  sx={{ bgcolor: 'rgba(244,67,54,0.8)', '&:hover': { bgcolor: 'rgba(244,67,54,1)' } }}
                >
                  {engineLoading ? '停止中...' : '停止'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={engineLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PlayArrowIcon />}
                  onClick={startEngine}
                  disabled={engineLoading}
                  sx={{ bgcolor: 'rgba(76,175,80,0.8)', '&:hover': { bgcolor: 'rgba(76,175,80,1)' } }}
                >
                  {engineLoading ? '启动中...' : '启动'}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 提示信息 */}
      {!engineStatus?.running && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          AI 交易未启用。请点击右上角「基础配置」页面设置按钮配置 DeepSeek API Key 和监控股票池。
        </Alert>
      )}

      {/* 监控股票列表 */}
      {engineStatus?.config?.symbols && engineStatus.config.symbols.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="body2" fontWeight="bold" color="primary">
                📊 当前监控股票：
              </Typography>
              {engineStatus.config.symbols.map((symbol: string) => (
                <Chip
                  key={symbol}
                  label={symbol}
                  color={mainKlineSymbol === symbol ? 'primary' : 'default'}
                  variant={mainKlineSymbol === symbol ? 'filled' : 'outlined'}
                  size="small"
                  onClick={() => {
                    console.log('🎯 点击股票卡片:', symbol);
                    setMainKlineSymbol(symbol);
                    loadMainKline(symbol);
                  }}
                  sx={{ 
                    cursor: 'pointer',
                    fontWeight: mainKlineSymbol === symbol ? 'bold' : 'normal',
                    boxShadow: mainKlineSymbol === symbol ? 2 : 0,
                  }}
                />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                点击股票查看K线图
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 主内容区 - 实时分析视图 */}
      <Grid container spacing={2}>
        {/* 左侧：K线图 */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box flex={1}>
                  <Typography variant="h6" gutterBottom>
                    📈 实时K线图 {mainKlineSymbol && <span style={{ color: '#1976d2', fontWeight: 'bold' }}>({mainKlineSymbol})</span>}
                  </Typography>
                  {lastUpdateTime && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      📡 WebSocket 实时推送 • 最后更新: {lastUpdateTime.toLocaleTimeString('zh-CN')}
                    </Typography>
                  )}
                </Box>
                
                {/* 股票选择器 */}
                {engineStatus?.config?.symbols && engineStatus.config.symbols.length > 0 && (
                  <Box display="flex" gap={1} alignItems="center">
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>选择股票</InputLabel>
                      <Select
                        value={mainKlineSymbol || ''}
                        label="选择股票"
                        onChange={(e) => {
                          const newSymbol = e.target.value;
                          console.log('🔄 切换股票:', newSymbol);
                          setMainKlineSymbol(newSymbol);
                          loadMainKline(newSymbol);
                        }}
                        size="small"
                      >
                        {engineStatus.config.symbols.map((symbol: string) => (
                          <MenuItem key={symbol} value={symbol}>
                            {symbol}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton 
                      size="small" 
                      onClick={() => mainKlineSymbol && loadMainKline(mainKlineSymbol)}
                      title="刷新K线数据"
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
                
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  {mainKlineData.length > 0 ? `${mainKlineData.length} 根K线` : '无数据'}
                </Typography>
              </Box>
              
              {mainKlineLoading ? (
                <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height={500} gap={2}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    {mainKlineSymbol && mainKlineData.length === 0 
                      ? `正在同步 ${mainKlineSymbol} 的K线数据，请稍候...` 
                      : `正在加载K线数据...`}
                  </Typography>
                </Box>
              ) : mainKlineData.length > 0 ? (
                <Box display="flex" justifyContent="center">
                  {(() => {
                    const chartData = mainKlineData.map(bar => ({
                      time: bar.ts,
                      open: bar.open,
                      high: bar.high,
                      low: bar.low,
                      close: bar.close,
                      volume: bar.volume
                    }));
                    console.log('📊 准备渲染K线图，数据数量:', chartData.length, '第一条:', chartData[0]);
                    return (
                      <SimpleKLineChart 
                        data={chartData}
                        width={700}
                        height={500}
                      />
                    );
                  })()}
                </Box>
              ) : (
                <Box sx={{ p: 3 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {mainKlineSymbol 
                      ? `股票: ${mainKlineSymbol} - K线数据为空，请检查数据源`
                      : '请在配置中添加监控股票，系统将自动加载K线图'
                    }
                  </Alert>
                  {mainKlineSymbol && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="caption" display="block" gutterBottom>
                        调试信息：
                      </Typography>
                      <Typography variant="caption" display="block">
                        • 当前股票: {mainKlineSymbol}
                      </Typography>
                      <Typography variant="caption" display="block">
                        • 数据数量: {mainKlineData.length}
                      </Typography>
                      <Typography variant="caption" display="block">
                        • 加载状态: {mainKlineLoading ? '加载中' : '已完成'}
                      </Typography>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => loadMainKline(mainKlineSymbol)}
                        sx={{ mt: 1 }}
                      >
                        重新加载
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* 右侧：AI 实时分析面板（类似 RockAlpha）*/}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '600px', overflow: 'hidden' }}>
            <AiAnalysisPanel 
              wsUrl={resolveWsUrl('/ws/ai-trading')} 
              maxMessages={30}
            />
          </Card>
        </Grid>
      </Grid>

      {/* 底部标签页 - 详细记录 */}
      <Card sx={{ mt: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="📝 交易记录" />
          <Tab label="💼 持仓管理" />
        </Tabs>

        <CardContent>
          {/* Tab 1: 交易记录 */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                历史交易记录
              </Typography>
              {trades.length === 0 ? (
                <Alert severity="info">暂无交易记录</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>时间</TableCell>
                        <TableCell>股票</TableCell>
                        <TableCell>操作</TableCell>
                        <TableCell align="right">数量</TableCell>
                        <TableCell align="right">价格</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell align="right">盈亏</TableCell>
                        <TableCell align="right">信心度</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            {new Date(trade.order_time).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>{trade.symbol}</TableCell>
                          <TableCell>
                            <Chip label={trade.action} color={getActionColor(trade.action) as any} size="small" />
                          </TableCell>
                          <TableCell align="right">{trade.order_quantity}</TableCell>
                          <TableCell align="right">${trade.filled_price?.toFixed(2)}</TableCell>
                          <TableCell>
                            <Chip label={trade.status} color={getStatusColor(trade.status) as any} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            {trade.pnl != null ? (
                              <Typography
                                variant="body2"
                                sx={{ color: trade.pnl >= 0 ? 'success.main' : 'error.main' }}
                              >
                                ${trade.pnl.toFixed(2)} ({trade.pnl_percent?.toFixed(2)}%)
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right">{(trade.ai_confidence * 100).toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* Tab 2: 持仓管理 */}
          {activeTab === 1 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  当前 AI 持仓
                </Typography>
                {positions.length > 0 && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={clearAllPositions}
                  >
                    清空所有持仓
                  </Button>
                )}
              </Box>
              {positions.length === 0 ? (
                <Alert severity="info">暂无持仓</Alert>
              ) : (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    ⚠️ <strong>注意：</strong>删除持仓仅清除数据库记录，不会触发真实卖出操作。建议仅在清理模拟数据时使用。
                  </Alert>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>股票</TableCell>
                          <TableCell align="right">数量</TableCell>
                          <TableCell align="right">成本</TableCell>
                          <TableCell align="right">当前价</TableCell>
                          <TableCell align="right">市值</TableCell>
                          <TableCell align="right">盈亏</TableCell>
                          <TableCell>开仓时间</TableCell>
                          <TableCell align="center">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {positions.map((pos) => (
                          <TableRow key={pos.symbol}>
                            <TableCell>{pos.symbol}</TableCell>
                            <TableCell align="right">{pos.quantity}</TableCell>
                            <TableCell align="right">${pos.avg_cost?.toFixed(2)}</TableCell>
                            <TableCell align="right">${pos.current_price?.toFixed(2)}</TableCell>
                            <TableCell align="right">${(pos.current_price * pos.quantity).toFixed(2)}</TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                sx={{ color: pos.unrealized_pnl >= 0 ? 'success.main' : 'error.main' }}
                              >
                                ${pos.unrealized_pnl?.toFixed(2)} ({pos.unrealized_pnl_percent?.toFixed(2)}%)
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {new Date(pos.open_time).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                color="error"
                                onClick={() => deletePosition(pos.symbol)}
                              >
                                删除
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 配置对话框 */}
      <Dialog open={configDialog} onClose={() => setConfigDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI 交易配置</DialogTitle>
        <DialogContent>
          {config && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enabled || false}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    />
                  }
                  label="启用 AI 自动交易"
                />
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info">
                  <strong>DeepSeek API Key 配置：</strong>请前往左侧菜单「⚙️ 基础配置」页面的「AI 配置」区域设置 DeepSeek API Key。
                  <br />
                  API Key 将被加密存储，更加安全。
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={1} mb={1}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_BASE}/portfolio/positions`);
                        if (response.ok) {
                          const positions = await response.json();
                          const positionSymbols = positions.map((p: any) => p.symbol);
                          if (positionSymbols.length > 0) {
                            // 添加到输入框
                            const currentText = symbolsInput.trim();
                            const newText = currentText 
                              ? currentText + ', ' + positionSymbols.join(', ')
                              : positionSymbols.join(', ');
                            setSymbolsInput(newText);
                            alert(`✅ 已添加 ${positionSymbols.length} 只持仓股票：\n${positionSymbols.join(', ')}`);
                          } else {
                            alert('当前没有持仓');
                          }
                        }
                      } catch (e) {
                        alert('获取持仓失败: ' + e);
                      }
                    }}
                  >
                    📊 从持仓中添加
                  </Button>
                  
                  <Button 
                    variant="outlined" 
                    size="small"
                    color="primary"
                    onClick={async () => {
                      if (!config?.symbols || config.symbols.length === 0) {
                        alert('⚠️ 请先添加监控股票');
                        return;
                      }
                      
                      if (confirm(`确定要同步 ${config.symbols.length} 只股票的K线数据吗？\n${config.symbols.join(', ')}`)) {
                        try {
                          alert('⏳ 正在同步K线数据，请稍候...');
                          await syncKlinesForSymbols(config.symbols);
                          alert('✅ K线数据同步完成！');
                        } catch (e) {
                          alert('❌ K线同步失败: ' + e);
                        }
                      }
                    }}
                  >
                    🔄 手动同步K线
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="监控股票池（英文逗号分隔）"
                  value={symbolsInput}
                  onChange={(e) => {
                    // 直接保存输入，不做任何转换
                    setSymbolsInput(e.target.value);
                  }}
                  placeholder="例如：DVN.US, AAPL.US, 700.HK"
                  helperText="✅ 可以输入英文逗号、空格、换行，保存时会自动处理"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="检查间隔（分钟）"
                  type="number"
                  value={config.check_interval_minutes || 5}
                  onChange={(e) => setConfig({ ...config, check_interval_minutes: parseInt(e.target.value) })}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="最小信心度"
                  type="number"
                  inputProps={{ min: 0, max: 1, step: 0.05 }}
                  value={config.min_confidence || 0.75}
                  onChange={(e) => setConfig({ ...config, min_confidence: parseFloat(e.target.value) })}
                  helperText="0-1 之间，建议 0.75+"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="每日最大交易次数"
                  type="number"
                  value={config.max_daily_trades || 20}
                  onChange={(e) => setConfig({ ...config, max_daily_trades: parseInt(e.target.value) })}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="每日最大亏损($)"
                  type="number"
                  value={config.max_loss_per_day || 5000}
                  onChange={(e) => setConfig({ ...config, max_loss_per_day: parseFloat(e.target.value) })}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="每笔固定交易金额($)"
                  type="number"
                  value={config.fixed_amount_per_trade || 10000}
                  onChange={(e) => setConfig({ ...config, fixed_amount_per_trade: parseFloat(e.target.value) })}
                  helperText="每次交易的固定金额"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config?.enable_real_trading || false}
                      onChange={(e) => setConfig({ ...config, enable_real_trading: e.target.checked })}
                    />
                  }
                  label="启用真实交易（⚠️ 谨慎操作）"
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  关闭时为模拟模式，开启后会通过 Longbridge API 执行真实下单
                </Typography>
              </Grid>
              
              {config?.enable_real_trading && (
                <Grid item xs={12}>
                  <Alert severity="error">
                    <strong>警告：</strong>真实交易模式已开启！系统将会执行实际的买卖操作，请确保已充分测试并理解风险。
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialog(false)}>取消</Button>
          <Button onClick={saveConfig} variant="contained" color="primary">
            保存配置
          </Button>
        </DialogActions>
      </Dialog>

      {/* K线图表对话框 */}
      <Dialog 
        open={showKlineDialog} 
        onClose={() => setShowKlineDialog(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          K线图表 - {selectedKlineSymbol}
        </DialogTitle>
        <DialogContent>
          {klineLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
              <CircularProgress />
            </Box>
          ) : klineData.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                显示最近 {klineData.length} 根 K 线（用于 AI 分析）
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <SimpleKLineChart 
                  data={klineData.map(bar => ({
                    time: bar.ts,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume
                  }))}
                  width={900}
                  height={500}
                />
              </Box>
              
              {/* 详细数据表格（可展开） */}
              <Collapse in={false}>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300, mt: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>时间</TableCell>
                        <TableCell align="right">开盘</TableCell>
                        <TableCell align="right">最高</TableCell>
                        <TableCell align="right">最低</TableCell>
                        <TableCell align="right">收盘</TableCell>
                        <TableCell align="right">成交量</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {klineData.slice(0, 20).map((bar, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {new Date(bar.ts).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell align="right">${bar.open?.toFixed(2)}</TableCell>
                          <TableCell align="right">${bar.high?.toFixed(2)}</TableCell>
                          <TableCell align="right">${bar.low?.toFixed(2)}</TableCell>
                          <TableCell align="right">${bar.close?.toFixed(2)}</TableCell>
                          <TableCell align="right">{bar.volume?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              暂无K线数据，请先在「设置」页面同步历史数据
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKlineDialog(false)}>关闭</Button>
          <Button 
            onClick={() => loadKlineData(selectedKlineSymbol)}
            variant="contained"
            disabled={klineLoading}
          >
            刷新
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// K线预览组件
function KLinePreview({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/ai-trading/klines/${symbol}?period=day&count=30`);
        if (response.ok) {
          const result = await response.json();
          setData(result.klines || []);
        }
      } catch (e) {
        console.error('Failed to load kline preview:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [symbol]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={250}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
        暂无K线数据，请先在「设置」页面同步历史数据
      </Alert>
    );
  }

  return (
    <Box display="flex" justifyContent="center">
      <SimpleKLineChart 
        data={data.map(bar => ({
          time: bar.ts,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume
        }))}
        width={500}
        height={250}
      />
    </Box>
  );
}


