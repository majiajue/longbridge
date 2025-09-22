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
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Grid,
  Divider,
  Slider,
  Stack,
  Tooltip,
  Badge,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import BlockIcon from '@mui/icons-material/Block';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircleSharp';
import WarningIcon from '@mui/icons-material/WarningAmber';
import InfoIcon from '@mui/icons-material/Info';
import EyeIcon from '@mui/icons-material/RemoveRedEye';
import EyeOffIcon from '@mui/icons-material/VisibilityOffRounded';
import SpeedIcon from '@mui/icons-material/SpeedOutlined';
import SecurityIcon from '@mui/icons-material/SecurityRounded';

interface PositionMonitoring {
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl: number;
  pnl_ratio: number;
  monitoring_status: string;
  strategy_mode: string;
  enabled_strategies: string[];
  custom_stop_loss?: number;
  custom_take_profit?: number;
  notes?: string;
}

interface GlobalSettings {
  auto_monitor_new_positions: boolean;
  default_strategy_mode: string;
  default_enabled_strategies: string[];
  global_stop_loss: number;
  global_take_profit: number;
  max_daily_loss: number;
  max_position_size: number;
  excluded_symbols: string[];
  vip_symbols: string[];
}

interface Strategy {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_STRATEGIES: Strategy[] = [
  { id: 'ma_crossover', name: '均线交叉', description: '基于MA金叉死叉' },
  { id: 'rsi_oversold', name: 'RSI超卖反弹', description: 'RSI指标反转' },
  { id: 'breakout', name: '突破策略', description: '价格突破关键位' },
  { id: 'bollinger_bands', name: '布林带', description: '均值回归' },
  { id: 'macd_divergence', name: 'MACD背离', description: '趋势反转' },
];

export default function PositionMonitoringPage() {
  const [positions, setPositions] = useState<PositionMonitoring[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    position: PositionMonitoring | null;
  }>({ open: false, position: null });
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load positions with monitoring config
  const loadPositions = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/monitoring/positions`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions);
        setGlobalSettings(data.global_settings);
      } else {
        setError('Failed to load positions');
      }
    } catch (e) {
      setError('Failed to connect to backend');
      console.error('Error loading positions:', e);
    } finally {
      setLoading(false);
    }
  };

  // Update single position monitoring
  const updatePositionMonitoring = async (
    symbol: string,
    updates: any
  ) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/monitoring/position/${symbol}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadPositions();
        setEditDialog({ open: false, position: null });
      }
    } catch (e) {
      console.error('Error updating position:', e);
    }
  };

  // Batch update monitoring status
  const batchUpdateMonitoring = async (status: string) => {
    if (selectedPositions.size === 0) return;

    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/monitoring/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: Array.from(selectedPositions),
          monitoring_status: status,
        }),
      });

      if (response.ok) {
        await loadPositions();
        setSelectedPositions(new Set());
      }
    } catch (e) {
      console.error('Error batch updating:', e);
    }
  };

  // Toggle position monitoring
  const toggleMonitoring = async (symbol: string, enabled: boolean) => {
    await updatePositionMonitoring(symbol, {
      monitoring_status: enabled ? 'active' : 'paused',
    });
  };

  // Exclude position from monitoring
  const excludePosition = async (symbol: string) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/monitoring/exclude/${symbol}`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadPositions();
      }
    } catch (e) {
      console.error('Error excluding position:', e);
    }
  };

  // Update global settings
  const updateGlobalSettings = async (settings: GlobalSettings) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/monitoring/global-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setGlobalSettings(settings);
        setSettingsDialog(false);
      }
    } catch (e) {
      console.error('Error updating global settings:', e);
    }
  };

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'paused':
        return <PauseIcon color="warning" />;
      case 'excluded':
        return <BlockIcon color="error" />;
      default:
        return <InfoIcon />;
    }
  };

  const getStrategyModeChip = (mode: string) => {
    switch (mode) {
      case 'auto':
        return <Chip label="自动执行" color="success" size="small" icon={<SpeedIcon />} />;
      case 'alert_only':
        return <Chip label="仅提醒" color="warning" size="small" icon={<WarningIcon />} />;
      case 'disabled':
        return <Chip label="禁用" color="default" size="small" />;
      default:
        return <Chip label={mode} size="small" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>加载中...</Typography>
      </Box>
    );
  }

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Card className="bg-gradient-to-br from-blue-600 to-purple-700 text-white mb-6">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                持仓监控管理
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                为每个持仓配置个性化的监控策略
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Badge badgeContent={positions.filter(p => p.monitoring_status === 'active').length} color="success">
                <Chip
                  icon={<EyeIcon />}
                  label="监控中"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
              </Badge>
              <Badge badgeContent={positions.filter(p => p.monitoring_status === 'paused').length} color="warning">
                <Chip
                  icon={<PauseIcon />}
                  label="已暂停"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
              </Badge>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<SettingsIcon />}
                onClick={() => setSettingsDialog(true)}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
              >
                全局设置
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Batch Actions */}
      {selectedPositions.size > 0 && (
        <Card sx={{ mb: 2, p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>
              已选择 {selectedPositions.size} 个持仓
            </Typography>
            <Button
              size="small"
              color="success"
              onClick={() => batchUpdateMonitoring('active')}
              startIcon={<PlayIcon />}
            >
              启用监控
            </Button>
            <Button
              size="small"
              color="warning"
              onClick={() => batchUpdateMonitoring('paused')}
              startIcon={<PauseIcon />}
            >
              暂停监控
            </Button>
            <Button
              size="small"
              color="error"
              onClick={() => batchUpdateMonitoring('excluded')}
              startIcon={<BlockIcon />}
            >
              排除监控
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSelectedPositions(new Set())}
            >
              清除选择
            </Button>
          </Stack>
        </Card>
      )}

      {/* Positions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedPositions.size === positions.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPositions(new Set(positions.map(p => p.symbol)));
                    } else {
                      setSelectedPositions(new Set());
                    }
                  }}
                />
              </TableCell>
              <TableCell>股票</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>策略模式</TableCell>
              <TableCell align="right">持仓</TableCell>
              <TableCell align="right">成本</TableCell>
              <TableCell align="right">现价</TableCell>
              <TableCell align="right">盈亏</TableCell>
              <TableCell align="right">止损/止盈</TableCell>
              <TableCell>启用策略</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((position) => {
              const isSelected = selectedPositions.has(position.symbol);
              const isActive = position.monitoring_status === 'active';

              return (
                <TableRow
                  key={position.symbol}
                  selected={isSelected}
                  sx={{
                    opacity: position.monitoring_status === 'excluded' ? 0.5 : 1,
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => {
                        const newSelected = new Set(selectedPositions);
                        if (e.target.checked) {
                          newSelected.add(position.symbol);
                        } else {
                          newSelected.delete(position.symbol);
                        }
                        setSelectedPositions(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(position.monitoring_status)}
                      <Box>
                        <Typography fontWeight="bold">{position.symbol}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {position.name}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={isActive}
                      onChange={(e) => toggleMonitoring(position.symbol, e.target.checked)}
                      disabled={position.monitoring_status === 'excluded'}
                    />
                  </TableCell>
                  <TableCell>{getStrategyModeChip(position.strategy_mode)}</TableCell>
                  <TableCell align="right">{position.quantity}</TableCell>
                  <TableCell align="right">{position.avg_cost.toFixed(2)}</TableCell>
                  <TableCell align="right">{position.current_price.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <Stack alignItems="flex-end">
                      <Typography
                        color={position.pnl >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={position.pnl_ratio >= 0 ? 'success.main' : 'error.main'}
                      >
                        {position.pnl_ratio >= 0 ? '+' : ''}{(position.pnl_ratio * 100).toFixed(2)}%
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack>
                      <Typography variant="caption" color="error.main">
                        -{((position.custom_stop_loss || globalSettings?.global_stop_loss || 0.05) * 100).toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" color="success.main">
                        +{((position.custom_take_profit || globalSettings?.global_take_profit || 0.15) * 100).toFixed(0)}%
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {position.enabled_strategies.map((strategyId) => {
                        const strategy = AVAILABLE_STRATEGIES.find(s => s.id === strategyId);
                        return (
                          <Tooltip key={strategyId} title={strategy?.description || strategyId}>
                            <Chip label={strategy?.name || strategyId} size="small" />
                          </Tooltip>
                        );
                      })}
                      {position.enabled_strategies.length === 0 && (
                        <Typography variant="caption" color="text.secondary">无</Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        size="small"
                        onClick={() => setEditDialog({ open: true, position })}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                      {position.monitoring_status !== 'excluded' && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => excludePosition(position.symbol)}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Position Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, position: null })}
        maxWidth="md"
        fullWidth
      >
        {editDialog.position && (
          <>
            <DialogTitle>
              编辑监控设置: {editDialog.position.symbol} - {editDialog.position.name}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>策略模式</InputLabel>
                    <Select
                      value={editDialog.position.strategy_mode}
                      label="策略模式"
                      onChange={(e) => {
                        setEditDialog({
                          ...editDialog,
                          position: {
                            ...editDialog.position!,
                            strategy_mode: e.target.value,
                          },
                        });
                      }}
                    >
                      <MenuItem value="auto">自动执行</MenuItem>
                      <MenuItem value="alert_only">仅提醒</MenuItem>
                      <MenuItem value="disabled">禁用</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography gutterBottom>启用的策略</Typography>
                  <FormGroup>
                    {AVAILABLE_STRATEGIES.map((strategy) => (
                      <FormControlLabel
                        key={strategy.id}
                        control={
                          <Checkbox
                            checked={editDialog.position.enabled_strategies.includes(strategy.id)}
                            onChange={(e) => {
                              const strategies = [...editDialog.position!.enabled_strategies];
                              if (e.target.checked) {
                                strategies.push(strategy.id);
                              } else {
                                const index = strategies.indexOf(strategy.id);
                                if (index > -1) strategies.splice(index, 1);
                              }
                              setEditDialog({
                                ...editDialog,
                                position: {
                                  ...editDialog.position!,
                                  enabled_strategies: strategies,
                                },
                              });
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography>{strategy.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {strategy.description}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </FormGroup>
                </Grid>

                <Grid item xs={6}>
                  <Typography gutterBottom>
                    自定义止损 (留空使用全局设置)
                  </Typography>
                  <Slider
                    value={(editDialog.position.custom_stop_loss || 0) * 100}
                    onChange={(_, value) => {
                      setEditDialog({
                        ...editDialog,
                        position: {
                          ...editDialog.position!,
                          custom_stop_loss: (value as number) / 100,
                        },
                      });
                    }}
                    min={0}
                    max={20}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography gutterBottom>
                    自定义止盈 (留空使用全局设置)
                  </Typography>
                  <Slider
                    value={(editDialog.position.custom_take_profit || 0) * 100}
                    onChange={(_, value) => {
                      setEditDialog({
                        ...editDialog,
                        position: {
                          ...editDialog.position!,
                          custom_take_profit: (value as number) / 100,
                        },
                      });
                    }}
                    min={0}
                    max={50}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="备注"
                    multiline
                    rows={2}
                    value={editDialog.position.notes || ''}
                    onChange={(e) => {
                      setEditDialog({
                        ...editDialog,
                        position: {
                          ...editDialog.position!,
                          notes: e.target.value,
                        },
                      });
                    }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialog({ open: false, position: null })}>
                取消
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  updatePositionMonitoring(editDialog.position!.symbol, {
                    strategy_mode: editDialog.position!.strategy_mode,
                    enabled_strategies: editDialog.position!.enabled_strategies,
                    custom_stop_loss: editDialog.position!.custom_stop_loss || null,
                    custom_take_profit: editDialog.position!.custom_take_profit || null,
                    notes: editDialog.position!.notes,
                  });
                }}
              >
                保存
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Global Settings Dialog */}
      <Dialog
        open={settingsDialog}
        onClose={() => setSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        {globalSettings && (
          <>
            <DialogTitle>全局监控设置</DialogTitle>
            <DialogContent>
              <Stack spacing={3} sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={globalSettings.auto_monitor_new_positions}
                      onChange={(e) => {
                        setGlobalSettings({
                          ...globalSettings,
                          auto_monitor_new_positions: e.target.checked,
                        });
                      }}
                    />
                  }
                  label="自动监控新持仓"
                />

                <Box>
                  <Typography gutterBottom>全局止损 ({(globalSettings.global_stop_loss * 100).toFixed(0)}%)</Typography>
                  <Slider
                    value={globalSettings.global_stop_loss * 100}
                    onChange={(_, value) => {
                      setGlobalSettings({
                        ...globalSettings,
                        global_stop_loss: (value as number) / 100,
                      });
                    }}
                    min={1}
                    max={20}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>全局止盈 ({(globalSettings.global_take_profit * 100).toFixed(0)}%)</Typography>
                  <Slider
                    value={globalSettings.global_take_profit * 100}
                    onChange={(_, value) => {
                      setGlobalSettings({
                        ...globalSettings,
                        global_take_profit: (value as number) / 100,
                      });
                    }}
                    min={5}
                    max={50}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>单日最大亏损 ({(globalSettings.max_daily_loss * 100).toFixed(0)}%)</Typography>
                  <Slider
                    value={globalSettings.max_daily_loss * 100}
                    onChange={(_, value) => {
                      setGlobalSettings({
                        ...globalSettings,
                        max_daily_loss: (value as number) / 100,
                      });
                    }}
                    min={5}
                    max={30}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSettingsDialog(false)}>取消</Button>
              <Button
                variant="contained"
                onClick={() => updateGlobalSettings(globalSettings)}
              >
                保存设置
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
