import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Alert,
  LinearProgress,
  Grid,
  Divider,
} from '@mui/material';
import PlayIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import StopIcon from '@mui/icons-material/StopCircleSharp';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  symbols: string[];
  status: string;
  last_trade: string | null;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  status: string;
  pnl: number;
  strategy_id: string;
}

interface StrategyStatus {
  strategies: Record<string, any>;
  positions: Record<string, Position>;
  daily_trades: number;
  max_daily_trades: number;
}

export default function StrategyControlPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<StrategyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; strategy: Strategy | null }>({
    open: false,
    strategy: null,
  });
  const [createDialog, setCreateDialog] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    description: '',
    symbols: '',
    strategy_type: 'ma_crossover',
  });
  const [wsConnected, setWsConnected] = useState(false);

  // Load strategies
  const loadStrategies = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/`);
      if (response.ok) {
        const data = await response.json();
        setStrategies(data);
      } else {
        setError('Failed to load strategies');
      }
    } catch (e) {
      setError('Failed to connect to backend');
      console.error('Error loading strategies:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load positions
  const loadPositions = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/positions/all`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data);
      }
    } catch (e) {
      console.error('Error loading positions:', e);
    }
  };

  // Load strategy status
  const loadStatus = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Error loading status:', e);
    }
  };

  // Toggle strategy
  const toggleStrategy = async (strategyId: string, enabled: boolean) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const endpoint = enabled ? 'enable' : 'disable';
      const response = await fetch(`${base}/strategies/${strategyId}/${endpoint}`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadStrategies();
        await loadStatus();
      }
    } catch (e) {
      console.error('Error toggling strategy:', e);
    }
  };

  // Reload strategies from config
  const reloadStrategies = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/reload`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadStrategies();
        await loadStatus();
      }
    } catch (e) {
      console.error('Error reloading strategies:', e);
    }
  };

  // Update strategy settings
  const updateStrategy = async (strategyId: string, updates: any) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/${strategyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadStrategies();
        setEditDialog({ open: false, strategy: null });
      }
    } catch (e) {
      console.error('Error updating strategy:', e);
    }
  };

  // Create new strategy
  const createStrategy = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const symbols = newStrategy.symbols
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const response = await fetch(`${base}/strategies/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStrategy.name,
          description: newStrategy.description,
          symbols: symbols,
          strategy_type: newStrategy.strategy_type,
        }),
      });

      if (response.ok) {
        await loadStrategies();
        setCreateDialog(false);
        setNewStrategy({
          name: '',
          description: '',
          symbols: '',
          strategy_type: 'ma_crossover',
        });
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to create strategy');
      }
    } catch (e) {
      console.error('Error creating strategy:', e);
      setError('Failed to create strategy');
    }
  };

  // Delete strategy
  const deleteStrategy = async (strategyId: string) => {
    if (!window.confirm('确定要删除这个策略吗？')) {
      return;
    }

    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/strategies/${strategyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadStrategies();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to delete strategy');
      }
    } catch (e) {
      console.error('Error deleting strategy:', e);
      setError('Failed to delete strategy');
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = `ws://localhost:8000/strategies/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Strategy WebSocket connected');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status_update') {
          setStatus(data.data);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('Strategy WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('Strategy WebSocket disconnected');
      setWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    loadStrategies();
    loadPositions();
    loadStatus();

    // Refresh periodically
    const interval = setInterval(() => {
      loadPositions();
      loadStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'default';
      case 'monitoring':
        return 'primary';
      case 'triggered':
        return 'warning';
      case 'executing':
        return 'success';
      case 'cooldown':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'idle':
        return '空闲';
      case 'monitoring':
        return '监控中';
      case 'triggered':
        return '已触发';
      case 'executing':
        return '执行中';
      case 'cooldown':
        return '冷却中';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white mb-6">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                策略控制中心
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                自动交易策略管理与监控
              </Typography>
            </Box>
            <Box display="flex" gap={2}>
              <Chip
                icon={<AccountBalanceIcon />}
                label={`今日交易: ${status?.daily_trades || 0}/${status?.max_daily_trades || 10}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                label={wsConnected ? '● 实时连接' : '○ 未连接'}
                sx={{
                  bgcolor: wsConnected ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)',
                  color: 'white',
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialog(true)}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
              >
                新建策略
              </Button>
              <IconButton color="inherit" onClick={reloadStrategies}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Strategies Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {strategies.map((strategy) => (
          <Grid item xs={12} md={6} lg={4} key={strategy.id}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom>
                      {strategy.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {strategy.description}
                    </Typography>
                  </Box>
                  <Switch
                    checked={strategy.enabled}
                    onChange={(e) => toggleStrategy(strategy.id, e.target.checked)}
                    color="primary"
                  />
                </Box>

                <Box display="flex" gap={1} mb={2}>
                  <Chip
                    label={getStatusLabel(strategy.status)}
                    color={getStatusColor(strategy.status) as any}
                    size="small"
                  />
                  {strategy.enabled && (
                    <Chip
                      icon={strategy.status === 'monitoring' ? <PlayIcon /> : <StopIcon />}
                      label={strategy.status === 'monitoring' ? '运行中' : '已停止'}
                      size="small"
                      color={strategy.status === 'monitoring' ? 'success' : 'default'}
                    />
                  )}
                </Box>

                <Typography variant="caption" display="block" gutterBottom>
                  监控标的: {strategy.symbols.join(', ')}
                </Typography>

                {strategy.last_trade && (
                  <Typography variant="caption" color="text.secondary">
                    最后交易: {new Date(strategy.last_trade).toLocaleString()}
                  </Typography>
                )}

                <Box display="flex" justifyContent="space-between" mt={2}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deleteStrategy(strategy.id)}
                    disabled={strategy.enabled}
                    title={strategy.enabled ? '请先禁用策略' : '删除策略'}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setEditDialog({ open: true, strategy })}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Open Positions */}
      <Typography variant="h5" gutterBottom fontWeight="bold">
        当前持仓
      </Typography>

      {positions.filter((p) => p.status === 'open').length === 0 ? (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography color="text.secondary" align="center">
              暂无持仓
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>标的</TableCell>
                <TableCell>策略</TableCell>
                <TableCell>方向</TableCell>
                <TableCell align="right">数量</TableCell>
                <TableCell align="right">入场价</TableCell>
                <TableCell align="right">止损</TableCell>
                <TableCell align="right">止盈</TableCell>
                <TableCell align="right">盈亏</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {positions
                .filter((p) => p.status === 'open')
                .map((position) => {
                  const strategy = strategies.find((s) => s.id === position.strategy_id);
                  return (
                    <TableRow key={position.id}>
                      <TableCell>{position.symbol}</TableCell>
                      <TableCell>{strategy?.name || position.strategy_id}</TableCell>
                      <TableCell>
                        <Chip
                          label={position.side === 'buy' ? '买入' : '卖出'}
                          size="small"
                          color={position.side === 'buy' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">{position.quantity}</TableCell>
                      <TableCell align="right">{position.entry_price.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>
                        {position.stop_loss.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>
                        {position.take_profit.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" alignItems="center" justifyContent="flex-end">
                          {position.pnl > 0 ? (
                            <TrendingUpIcon color="success" fontSize="small" />
                          ) : (
                            <TrendingDownIcon color="error" fontSize="small" />
                          )}
                          <Typography
                            color={position.pnl > 0 ? 'success.main' : 'error.main'}
                            fontWeight="medium"
                          >
                            {position.pnl.toFixed(2)}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Strategy Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建新策略</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="策略名称"
              value={newStrategy.name}
              onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
              fullWidth
              required
              placeholder="例如：我的均线策略"
            />
            <TextField
              label="策略描述"
              value={newStrategy.description}
              onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="描述策略的作用和特点"
            />
            <FormControl fullWidth>
              <InputLabel>策略类型</InputLabel>
              <Select
                value={newStrategy.strategy_type}
                onChange={(e) => setNewStrategy({ ...newStrategy, strategy_type: e.target.value })}
                label="策略类型"
              >
                <MenuItem value="ma_crossover">均线交叉策略</MenuItem>
                <MenuItem value="rsi_oversold">RSI 超卖反弹策略</MenuItem>
                <MenuItem value="breakout">突破策略</MenuItem>
                <MenuItem value="bollinger_bands">布林带策略</MenuItem>
                <MenuItem value="macd">MACD 背离策略</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="监控标的"
              value={newStrategy.symbols}
              onChange={(e) => setNewStrategy({ ...newStrategy, symbols: e.target.value })}
              fullWidth
              placeholder="例如：700.HK, AAPL.US"
              helperText="用逗号分隔多个标的代码"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>取消</Button>
          <Button
            onClick={createStrategy}
            variant="contained"
            disabled={!newStrategy.name}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Strategy Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, strategy: null })}
        maxWidth="sm"
        fullWidth
      >
        {editDialog.strategy && (
          <>
            <DialogTitle>编辑策略: {editDialog.strategy.name}</DialogTitle>
            <DialogContent>
              <Box display="flex" flexDirection="column" gap={2} mt={2}>
                <TextField
                  label="监控标的"
                  value={editDialog.strategy.symbols.join(', ')}
                  helperText="用逗号分隔多个标的代码"
                  fullWidth
                  onChange={(e) => {
                    const symbols = e.target.value.split(',').map((s) => s.trim());
                    setEditDialog({
                      ...editDialog,
                      strategy: { ...editDialog.strategy!, symbols },
                    });
                  }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialog({ open: false, strategy: null })}>
                取消
              </Button>
              <Button
                onClick={() =>
                  updateStrategy(editDialog.strategy!.id, {
                    symbols: editDialog.strategy!.symbols,
                  })
                }
                variant="contained"
              >
                保存
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
