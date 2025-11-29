import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceWallet';

interface PositionCalculation {
  symbol: string;
  action: string;
  quantity: number;
  estimated_price: number;
  estimated_cost: number;
  reason: string;
  risk_level: string;
  max_loss: number;
  suggested_stop_loss: number;
  suggested_take_profit: number;
  portfolio_status?: any;
}

interface BatchCalculation {
  symbol: string;
  current_position: any;
  recommendation: PositionCalculation;
  create_strategy: boolean;
}

export default function SmartPositionPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<any>(null);
  const [calculation, setCalculation] = useState<PositionCalculation | null>(null);
  const [batchResults, setBatchResults] = useState<BatchCalculation[]>([]);
  
  // 自动管理状态
  const [autoStatus, setAutoStatus] = useState<any>(null);
  const [autoTrades, setAutoTrades] = useState<any[]>([]);
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [autoConfig, setAutoConfig] = useState({
    enabled: false,
    check_interval_minutes: 30,
    use_ai_analysis: true,
    min_ai_confidence: 0.7,
    auto_stop_loss_percent: -5.0,
    auto_take_profit_percent: 15.0,
    auto_rebalance_percent: -10.0,
    max_position_value: 50000,
    position_allocation: 0.05,
    sell_ratio: 1.0,
    enable_real_trading: false,
  });

  // K线图相关
  const [showKlineDialog, setShowKlineDialog] = useState(false);
  const [selectedKlineSymbol, setSelectedKlineSymbol] = useState('');
  const [klineData, setKlineData] = useState<any[]>([]);
  const [klineLoading, setKlineLoading] = useState(false);

  // 运行日志
  const [runningLogs, setRunningLogs] = useState<string[]>([]);

  // 单个计算表单
  const [singleForm, setSingleForm] = useState({
    symbol: '',
    action: 'buy',
    method: 'percentage',
    target_allocation: 0.1,
    max_risk: 0.02,
    stop_loss_pct: 0.05,
  });

  // 批量处理表单
  const [batchForm, setBatchForm] = useState({
    symbols: '',
    strategy_type: 'ma_crossover',
    allocation_per_symbol: 0.1,
    auto_execute: false,
  });

  const [showBatchDialog, setShowBatchDialog] = useState(false);

  // 加载组合状态
  const loadPortfolioStatus = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/portfolio-status`);
      
      if (response.ok) {
        const data = await response.json();
        setPortfolioStatus(data);
      } else {
        setError('无法加载组合状态');
      }
    } catch (e) {
      console.error('Error loading portfolio status:', e);
      setError('加载组合状态失败');
    }
  };

  // 加载自动管理状态
  const loadAutoStatus = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/auto/status`);
      
      if (response.ok) {
        const data = await response.json();
        setAutoStatus(data);
        if (data.config) {
          // 直接使用后端返回的配置，不要合并状态
          setAutoConfig(data.config);
        }
        // 更新运行日志
        if (data.recent_logs && data.recent_logs.length > 0) {
          setRunningLogs(data.recent_logs.slice(-20));  // 只保留最近20条
        }
      }
    } catch (e) {
      console.error('Error loading auto status:', e);
    }
  };

  // 加载自动交易记录
  const loadAutoTrades = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/auto/trades?limit=20`);
      
      if (response.ok) {
        const data = await response.json();
        const trades = data.trades || [];
        setAutoTrades(trades);
        
        // 如果没有运行日志（系统未运行），从交易记录生成
        if (trades.length > 0 && runningLogs.length === 0) {
          const logs = trades.slice(0, 5).map((trade: any) => {
            const time = new Date(trade.timestamp).toLocaleTimeString('zh-CN');
            const statusEmoji = trade.status === 'FILLED' ? '✅' : 
                              trade.status === 'FAILED' ? '❌' : 
                              trade.status === 'ERROR' ? '⚠️' : '📝';
            return `[${time}] ${statusEmoji} ${trade.action} ${trade.symbol} x${trade.quantity} @ $${trade.price.toFixed(2)} - ${trade.reason}`;
          });
          setRunningLogs(logs);
        }
      }
    } catch (e) {
      console.error('Error loading auto trades:', e);
    }
  };

  // 启动自动管理
  const startAutoManager = async () => {
    // 先检查配置是否已启用
    if (!autoConfig.enabled) {
      alert('⚠️ 自动仓位管理未启用！\n\n请先点击「配置」按钮，在配置对话框中将「启用自动仓位管理」设置为「是」，然后保存配置。');
      setShowAutoConfig(true); // 自动打开配置对话框
      return;
    }

    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/auto/start`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message || '启动成功');
        loadAutoStatus();
      } else {
        const error = await response.json();
        alert(error.detail || '启动失败');
      }
    } catch (e) {
      alert(`启动失败: ${e}`);
    }
  };

  // 停止自动管理
  const stopAutoManager = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/auto/stop`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message || '停止成功');
        loadAutoStatus();
      } else {
        const error = await response.json();
        alert(error.detail || '停止失败');
      }
    } catch (e) {
      alert(`停止失败: ${e}`);
    }
  };

  // 保存自动配置
  const saveAutoConfig = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/auto/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoConfig),
      });
      
      if (response.ok) {
        // 先重新加载配置，确保状态同步
        await loadAutoStatus();
        setShowAutoConfig(false);
        alert('配置已保存');
      } else {
        const error = await response.json();
        alert(error.detail || '保存失败');
      }
    } catch (e) {
      alert(`保存失败: ${e}`);
    }
  };

  // 加载K线数据
  const loadKlineData = async (symbol: string) => {
    setKlineLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/klines/${symbol}?limit=100`);
      
      if (response.ok) {
        const data = await response.json();
        setKlineData(data.klines || []);
      } else {
        const error = await response.json();
        alert(error.detail || '获取K线数据失败');
        setKlineData([]);
      }
    } catch (e) {
      console.error('Error loading kline data:', e);
      alert(`获取K线数据失败: ${e}`);
      setKlineData([]);
    } finally {
      setKlineLoading(false);
    }
  };

  // 打开K线图对话框
  const openKlineChart = (symbol: string) => {
    setSelectedKlineSymbol(symbol);
    setShowKlineDialog(true);
    loadKlineData(symbol);
  };

  // 计算单个仓位
  const calculatePosition = async () => {
    if (!singleForm.symbol) {
      setError('请输入股票代码');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/position-manager/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(singleForm),
      });

      if (response.ok) {
        const data = await response.json();
        setCalculation(data);
        if (data.portfolio_status) {
          setPortfolioStatus(data.portfolio_status);
        }
      } else {
        const error = await response.json();
        setError(error.detail || '计算失败');
      }
    } catch (e) {
      console.error('Error calculating position:', e);
      setError('计算失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量生成策略
  const generateBatchStrategies = async () => {
    if (!batchForm.symbols) {
      setError('请输入股票代码');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const symbols = batchForm.symbols.split(',').map(s => s.trim()).filter(s => s);
      
      const response = await fetch(`${base}/position-manager/auto-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          strategy_type: batchForm.strategy_type,
          allocation_per_symbol: batchForm.allocation_per_symbol,
          auto_execute: batchForm.auto_execute,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBatchResults(data);
        setShowBatchDialog(false);
      } else {
        const error = await response.json();
        setError(error.detail || '生成失败');
      }
    } catch (e) {
      console.error('Error generating strategies:', e);
      setError('生成失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolioStatus();
    loadAutoStatus();
    loadAutoTrades();
    
    // 定期刷新自动管理状态
    const interval = setInterval(() => {
      loadAutoStatus();
      loadAutoTrades();
    }, 10000); // 每10秒刷新一次
    
    return () => clearInterval(interval);
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'default';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'low':
        return '低风险';
      case 'medium':
        return '中风险';
      case 'high':
        return '高风险';
      default:
        return level;
    }
  };

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Card className="bg-gradient-to-br from-blue-600 to-cyan-700 text-white mb-6">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                智能仓位管理
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                根据账户资金和风险偏好自动计算买卖数量
              </Typography>
            </Box>
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={loadPortfolioStatus}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
              >
                刷新
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 自动仓位管理控制面板 */}
      <Card sx={{ mb: 4, bgcolor: 'background.paper' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <AutoModeIcon fontSize="large" color="primary" />
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  自动仓位管理
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  自动识别持仓，智能决策买卖操作
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={2} alignItems="center">
              {autoStatus && (
                <>
                  <Chip
                    label={autoStatus.running ? '● 运行中' : '○ 已停止'}
                    color={autoStatus.running ? 'success' : 'default'}
                    size="small"
                  />
                  <Chip
                    label={`今日交易: ${autoStatus.today_trades || 0}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`检查间隔: ${autoStatus.check_interval_minutes || 30}分钟`}
                    size="small"
                    variant="outlined"
                  />
                </>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowAutoConfig(true)}
              >
                ⚙️ 配置
              </Button>
              {autoStatus?.running ? (
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={stopAutoManager}
                >
                  停止
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  onClick={startAutoManager}
                >
                  启动
                </Button>
              )}
            </Box>
          </Box>
          
          {/* 功能说明 */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>自动管理功能：</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>自动监控所有持仓，定期检查盈亏状态</li>
              <li>触发止损（默认-5%）或止盈（默认+15%）时自动卖出</li>
              <li>持仓跌幅较大（默认-10%）时考虑补仓</li>
              <li>支持 AI 智能分析决策（需配置 DeepSeek API Key）</li>
              <li><strong>当前为模拟模式</strong>，不会执行真实交易，仅记录决策</li>
            </ul>
          </Alert>
          
          {/* 运行日志 */}
          {autoStatus?.running && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
                📋 运行日志（实时更新）
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5',
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
                }}
              >
                {runningLogs.length > 0 ? (
                  runningLogs.map((log, index) => (
                    <Box key={index} sx={{ mb: 0.5, whiteSpace: 'pre-wrap' }}>
                      {log}
                    </Box>
                  ))
                ) : (
                  <Box sx={{ color: '#666', fontStyle: 'italic' }}>
                    {autoStatus?.running ? '⏳ 等待第一轮检查...' : '系统未运行'}
                  </Box>
                )}
              </Paper>
            </Box>
          )}
          
          {/* 最近交易记录 */}
          {autoTrades.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                交易记录（最多显示20条）
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>时间</TableCell>
                      <TableCell>操作</TableCell>
                      <TableCell>股票</TableCell>
                      <TableCell align="right">数量</TableCell>
                      <TableCell align="right">价格</TableCell>
                      <TableCell align="right">总额</TableCell>
                      <TableCell>原因</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>订单ID</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {autoTrades.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center">
                          暂无交易记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      autoTrades.slice(0, 20).map((trade: any) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            {new Date(trade.timestamp).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={trade.action}
                              color={trade.action === 'BUY' ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{trade.symbol}</TableCell>
                          <TableCell align="right">{trade.quantity}</TableCell>
                          <TableCell align="right">${trade.price?.toFixed(2)}</TableCell>
                          <TableCell align="right">${trade.total_value?.toFixed(2)}</TableCell>
                          <TableCell>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 150, display: 'block' }} title={trade.reason}>
                              {trade.reason}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={trade.status || 'SIMULATION'} 
                              size="small" 
                              color={
                                trade.status === 'FILLED' ? 'success' :
                                trade.status === 'FAILED' || trade.status === 'ERROR' ? 'error' :
                                'default'
                              }
                              variant="outlined" 
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" noWrap>
                              {trade.order_id || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              onClick={() => openKlineChart(trade.symbol)}
                            >
                              K线
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Status */}
      {portfolioStatus && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <AccountBalanceIcon />
              账户概览
            </Typography>
            <Grid container spacing={3} mt={1}>
              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    总资产
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${portfolioStatus.total_capital?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    可用资金
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    ${portfolioStatus.available_cash?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    持仓市值
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    ${portfolioStatus.market_value?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    现金比例
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {((portfolioStatus.cash_ratio || 0) * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Left: Single Calculation */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <CalculateIcon />
                单个仓位计算
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2} mt={3}>
                <Autocomplete
                  freeSolo
                  options={portfolioStatus?.positions?.map((p: any) => p.symbol) || []}
                  value={singleForm.symbol}
                  onChange={(_, newValue) => {
                    setSingleForm({ ...singleForm, symbol: (newValue || '').toUpperCase() });
                  }}
                  onInputChange={(_, newInputValue) => {
                    setSingleForm({ ...singleForm, symbol: newInputValue.toUpperCase() });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="股票代码"
                      placeholder="例如：700.HK, AAPL.US 或从持仓选择"
                      helperText="可以直接输入或从当前持仓中选择"
                    />
                  )}
                  renderOption={(props, option) => {
                    const position = portfolioStatus?.positions?.find((p: any) => p.symbol === option);
                    return (
                      <li {...props} key={option}>
                        <Box display="flex" justifyContent="space-between" width="100%">
                          <Typography>{option}</Typography>
                          {position && (
                            <Typography variant="caption" color="text.secondary">
                              {position.quantity} 股 @ ${position.value?.toFixed(2) || '0'}
                            </Typography>
                          )}
                        </Box>
                      </li>
                    );
                  }}
                />

                <FormControl fullWidth>
                  <InputLabel>操作类型</InputLabel>
                  <Select
                    value={singleForm.action}
                    onChange={(e) => setSingleForm({ ...singleForm, action: e.target.value })}
                    label="操作类型"
                  >
                    <MenuItem value="buy">买入</MenuItem>
                    <MenuItem value="sell">卖出</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>计算方法</InputLabel>
                  <Select
                    value={singleForm.method}
                    onChange={(e) => setSingleForm({ ...singleForm, method: e.target.value })}
                    label="计算方法"
                  >
                    <MenuItem value="percentage">资金百分比</MenuItem>
                    <MenuItem value="risk_based">基于风险</MenuItem>
                    <MenuItem value="fixed_amount">固定金额</MenuItem>
                    <MenuItem value="equal_weight">等权重</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="目标仓位比例"
                  type="number"
                  value={singleForm.target_allocation}
                  onChange={(e) => setSingleForm({ ...singleForm, target_allocation: parseFloat(e.target.value) })}
                  inputProps={{ min: 0.01, max: 1, step: 0.01 }}
                  helperText={`${(singleForm.target_allocation * 100).toFixed(0)}% of capital`}
                  fullWidth
                />

                <TextField
                  label="止损比例"
                  type="number"
                  value={singleForm.stop_loss_pct}
                  onChange={(e) => setSingleForm({ ...singleForm, stop_loss_pct: parseFloat(e.target.value) })}
                  inputProps={{ min: 0.01, max: 0.5, step: 0.01 }}
                  helperText={`${(singleForm.stop_loss_pct * 100).toFixed(0)}%`}
                  fullWidth
                />

                <Button
                  variant="contained"
                  onClick={calculatePosition}
                  disabled={loading || !singleForm.symbol}
                  fullWidth
                  size="large"
                >
                  {loading ? '计算中...' : '计算'}
                </Button>
              </Box>

              {/* Calculation Result */}
              {calculation && (
                <Box mt={4} p={2} bgcolor="grey.50" borderRadius={2}>
                  <Typography variant="h6" gutterBottom>
                    计算结果
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        操作
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {calculation.action === 'buy' ? '买入' : '卖出'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        数量
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {calculation.quantity} 股
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        预估价格
                      </Typography>
                      <Typography variant="body1">
                        ${calculation.estimated_price.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        预估成本
                      </Typography>
                      <Typography variant="body1" color={calculation.estimated_cost < 0 ? 'success.main' : 'inherit'}>
                        ${Math.abs(calculation.estimated_cost).toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        风险等级
                      </Typography>
                      <Chip 
                        label={getRiskLabel(calculation.risk_level)} 
                        color={getRiskColor(calculation.risk_level) as any}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        建议止损
                      </Typography>
                      <Typography variant="body1" color="error.main">
                        ${calculation.suggested_stop_loss.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        建议止盈
                      </Typography>
                      <Typography variant="body1" color="success.main">
                        ${calculation.suggested_take_profit.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        说明
                      </Typography>
                      <Typography variant="body2">
                        {calculation.reason}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Batch Processing */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                  <AutoModeIcon />
                  批量策略生成
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setShowBatchDialog(true)}
                >
                  新建批量任务
                </Button>
              </Box>

              {batchResults.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>股票</TableCell>
                        <TableCell align="right">建议数量</TableCell>
                        <TableCell align="right">预估成本</TableCell>
                        <TableCell>风险</TableCell>
                        <TableCell>状态</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {batchResults.map((result) => (
                        <TableRow key={result.symbol}>
                          <TableCell>{result.symbol}</TableCell>
                          <TableCell align="right">{result.recommendation.quantity}</TableCell>
                          <TableCell align="right">
                            ${result.recommendation.estimated_cost.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getRiskLabel(result.recommendation.risk_level)}
                              color={getRiskColor(result.recommendation.risk_level) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {result.create_strategy ? (
                              <Chip label="需创建策略" color="primary" size="small" />
                            ) : (
                              <Chip label="已有持仓" color="default" size="small" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {batchResults.length === 0 && (
                <Box textAlign="center" py={8} color="text.secondary">
                  <AutoModeIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                  <Typography variant="body1">
                    点击"新建批量任务"开始
                  </Typography>
                  <Typography variant="body2">
                    可以一次性为多个股票计算仓位并生成策略
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Batch Dialog */}
      <Dialog open={showBatchDialog} onClose={() => setShowBatchDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <span>批量策略生成</span>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                const allSymbols = portfolioStatus?.positions?.map((p: any) => p.symbol).join(', ') || '';
                setBatchForm({ ...batchForm, symbols: allSymbols });
              }}
              disabled={!portfolioStatus?.positions || portfolioStatus.positions.length === 0}
            >
              选择全部持仓
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <Autocomplete
              multiple
              freeSolo
              options={portfolioStatus?.positions?.map((p: any) => p.symbol) || []}
              value={batchForm.symbols.split(',').map(s => s.trim()).filter(s => s)}
              onChange={(_, newValue) => {
                setBatchForm({ ...batchForm, symbols: newValue.join(', ') });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="股票代码列表"
                  placeholder="例如：700.HK, AAPL.US 或从持仓选择"
                  helperText="可以直接输入或从当前持仓中选择多个股票"
                  multiline
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                    size="small"
                  />
                ))
              }
              renderOption={(props, option) => {
                const position = portfolioStatus?.positions?.find((p: any) => p.symbol === option);
                return (
                  <li {...props} key={option}>
                    <Box display="flex" justifyContent="space-between" width="100%">
                      <Typography>{option}</Typography>
                      {position && (
                        <Typography variant="caption" color="text.secondary">
                          {position.quantity} 股
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
            />

            <FormControl fullWidth>
              <InputLabel>策略类型</InputLabel>
              <Select
                value={batchForm.strategy_type}
                onChange={(e) => setBatchForm({ ...batchForm, strategy_type: e.target.value })}
                label="策略类型"
              >
                <MenuItem value="ma_crossover">均线交叉策略</MenuItem>
                <MenuItem value="rsi_oversold">RSI 超卖反弹策略</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="每个股票的配置比例"
              type="number"
              value={batchForm.allocation_per_symbol}
              onChange={(e) => setBatchForm({ ...batchForm, allocation_per_symbol: parseFloat(e.target.value) })}
              inputProps={{ min: 0.01, max: 1, step: 0.01 }}
              helperText={`每个股票占总资产的 ${(batchForm.allocation_per_symbol * 100).toFixed(0)}%`}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBatchDialog(false)}>取消</Button>
          <Button
            onClick={generateBatchStrategies}
            variant="contained"
            disabled={loading || !batchForm.symbols}
          >
            {loading ? '生成中...' : '生成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 自动管理配置对话框 */}
      <Dialog open={showAutoConfig} onClose={() => setShowAutoConfig(false)} maxWidth="md" fullWidth>
        <DialogTitle>自动仓位管理配置</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={2}>
            <Alert severity="warning">
              <strong>注意：</strong>当前为<strong>模拟模式</strong>，不会执行真实交易。如需启用真实交易，请在配置中开启。
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>基础设置</Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>启用自动仓位管理</InputLabel>
                  <Select
                    value={autoConfig.enabled ? 'yes' : 'no'}
                    onChange={(e) => setAutoConfig({ ...autoConfig, enabled: e.target.value === 'yes' })}
                    label="启用自动仓位管理"
                  >
                    <MenuItem value="no">否（已禁用）</MenuItem>
                    <MenuItem value="yes">是（已启用）</MenuItem>
                  </Select>
                  <FormHelperText>
                    必须启用后才能点击「启动」按钮开始自动管理
                  </FormHelperText>
                </FormControl>
              </Grid>

              {!autoConfig.enabled && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    ⚠️ 自动仓位管理当前处于<strong>禁用</strong>状态，请先启用后再点击「启动」按钮
                  </Alert>
                </Grid>
              )}

              <Grid item xs={6}>
                <TextField
                  label="检查间隔（分钟）"
                  type="number"
                  value={autoConfig.check_interval_minutes}
                  onChange={(e) => setAutoConfig({ ...autoConfig, check_interval_minutes: parseInt(e.target.value) })}
                  inputProps={{ min: 5, max: 1440 }}
                  fullWidth
                  helperText="建议 30-60 分钟"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="卖出比例"
                  type="number"
                  value={autoConfig.sell_ratio}
                  onChange={(e) => setAutoConfig({ ...autoConfig, sell_ratio: parseFloat(e.target.value) })}
                  inputProps={{ min: 0.1, max: 1, step: 0.1 }}
                  fullWidth
                  helperText="1.0 = 全部卖出"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>风险管理参数</Typography>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  label="自动止损（%）"
                  type="number"
                  value={autoConfig.auto_stop_loss_percent}
                  onChange={(e) => setAutoConfig({ ...autoConfig, auto_stop_loss_percent: parseFloat(e.target.value) })}
                  inputProps={{ min: -50, max: 0, step: 0.5 }}
                  fullWidth
                  helperText="负数表示跌幅"
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  label="自动止盈（%）"
                  type="number"
                  value={autoConfig.auto_take_profit_percent}
                  onChange={(e) => setAutoConfig({ ...autoConfig, auto_take_profit_percent: parseFloat(e.target.value) })}
                  inputProps={{ min: 1, max: 100, step: 1 }}
                  fullWidth
                  helperText="正数表示涨幅"
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  label="补仓触发（%）"
                  type="number"
                  value={autoConfig.auto_rebalance_percent}
                  onChange={(e) => setAutoConfig({ ...autoConfig, auto_rebalance_percent: parseFloat(e.target.value) })}
                  inputProps={{ min: -50, max: 0, step: 0.5 }}
                  fullWidth
                  helperText="跌幅达到时考虑补仓"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="最大单个持仓（$）"
                  type="number"
                  value={autoConfig.max_position_value}
                  onChange={(e) => setAutoConfig({ ...autoConfig, max_position_value: parseFloat(e.target.value) })}
                  inputProps={{ min: 1000, max: 1000000, step: 1000 }}
                  fullWidth
                  helperText="单个股票最大市值"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="补仓比例"
                  type="number"
                  value={autoConfig.position_allocation}
                  onChange={(e) => setAutoConfig({ ...autoConfig, position_allocation: parseFloat(e.target.value) })}
                  inputProps={{ min: 0.01, max: 0.5, step: 0.01 }}
                  fullWidth
                  helperText={`占总资产的 ${(autoConfig.position_allocation * 100).toFixed(1)}%`}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>AI 分析设置</Typography>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>启用 AI 分析</InputLabel>
                  <Select
                    value={autoConfig.use_ai_analysis ? 'yes' : 'no'}
                    onChange={(e) => setAutoConfig({ ...autoConfig, use_ai_analysis: e.target.value === 'yes' })}
                    label="启用 AI 分析"
                  >
                    <MenuItem value="yes">是</MenuItem>
                    <MenuItem value="no">否（仅规则引擎）</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  label="AI 最小信心度"
                  type="number"
                  value={autoConfig.min_ai_confidence}
                  onChange={(e) => setAutoConfig({ ...autoConfig, min_ai_confidence: parseFloat(e.target.value) })}
                  inputProps={{ min: 0.5, max: 1, step: 0.05 }}
                  fullWidth
                  disabled={!autoConfig.use_ai_analysis}
                  helperText="建议 0.7+"
                />
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info">
                  AI 分析需要在「基础配置」页面设置 DeepSeek API Key
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>高级设置</Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>启用真实交易</InputLabel>
                  <Select
                    value={autoConfig.enable_real_trading ? 'yes' : 'no'}
                    onChange={(e) => setAutoConfig({ ...autoConfig, enable_real_trading: e.target.value === 'yes' })}
                    label="启用真实交易"
                  >
                    <MenuItem value="no">否（模拟模式）</MenuItem>
                    <MenuItem value="yes">是（真实交易）⚠️</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {autoConfig.enable_real_trading && (
                <Grid item xs={12}>
                  <Alert severity="error">
                    <strong>警告：</strong>启用真实交易将会执行真实的买卖操作！请谨慎配置参数并充分测试。
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAutoConfig(false)}>取消</Button>
          <Button onClick={saveAutoConfig} variant="contained" color="primary">
            保存配置
          </Button>
        </DialogActions>
      </Dialog>

      {/* K线图对话框 */}
      <Dialog
        open={showKlineDialog}
        onClose={() => setShowKlineDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedKlineSymbol} K线数据
        </DialogTitle>
        <DialogContent>
          {klineLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : klineData.length === 0 ? (
            <Alert severity="info">
              暂无K线数据，请先在「历史数据」页面同步该股票的历史数据
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>日期</TableCell>
                    <TableCell align="right">开盘</TableCell>
                    <TableCell align="right">最高</TableCell>
                    <TableCell align="right">最低</TableCell>
                    <TableCell align="right">收盘</TableCell>
                    <TableCell align="right">成交量</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {klineData.map((kline: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{kline.ts}</TableCell>
                      <TableCell align="right">${kline.open?.toFixed(2)}</TableCell>
                      <TableCell align="right">${kline.high?.toFixed(2)}</TableCell>
                      <TableCell align="right">${kline.low?.toFixed(2)}</TableCell>
                      <TableCell align="right">${kline.close?.toFixed(2)}</TableCell>
                      <TableCell align="right">{kline.volume?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKlineDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {loading && <LinearProgress />}
    </Box>
  );
}

