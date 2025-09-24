import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  LinearProgress,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
// Using emoji icons to avoid MUI icons build issues
const TrendingUpIcon = () => <span>📈</span>;
const TrendingDownIcon = () => <span>📉</span>;
const AnalyticsIcon = () => <span>📊</span>;
const SearchIcon = () => <span>🔍</span>;
const InfoIcon = () => <span>ℹ️</span>;
const RefreshIcon = () => <span>🔄</span>;
const ShowChartIcon = () => <span>📊</span>;

interface SignalFactor {
  [key: string]: number;
}

interface TradingSignal {
  confidence: number;
  strength: string;
  price: number;
  factors: SignalFactor;
  reason: string;
  stop_loss?: number;
  take_profit?: number;
  position_size?: number;
  timestamp: string;
}

interface SignalAnalysis {
  symbol: string;
  current_price: number;
  analysis_time: string;
  data_points: number;
  signals: {
    buy?: TradingSignal | null;
    sell?: TradingSignal | null;
  };
}

interface MarketOverview {
  analysis_time: string;
  total_symbols: number;
  analyzed_symbols: number;
  signals_summary: {
    buy_signals: {
      total: number;
      strong: number;
      average_confidence: number;
      top_signals: Array<{symbol: string} & TradingSignal>;
    };
    sell_signals: {
      total: number;
      strong: number;
      average_confidence: number;
      top_signals: Array<{symbol: string} & TradingSignal>;
    };
  };
  market_sentiment: {
    bullish_ratio: number;
    sentiment_score: number;
  };
}

export default function SignalAnalysisPage() {
  const [currentTab, setCurrentTab] = useState(0);
  const [symbolInput, setSymbolInput] = useState('');
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorsDialog, setFactorsDialog] = useState(false);

  // Load market overview on component mount
  useEffect(() => {
    loadMarketOverview();
    if (currentTab === 1) {
      loadPortfolioAnalysis();
    }
  }, [currentTab]);

  const loadMarketOverview = async () => {
    try {
      setLoading(true);
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/signals/market_overview`);

      if (response.ok) {
        const data = await response.json();
        setMarketOverview(data);
      } else {
        setError('Failed to load market overview');
      }
    } catch (e) {
      setError('Failed to connect to backend');
      console.error('Error loading market overview:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/signals/portfolio/positions`);

      if (response.ok) {
        const data = await response.json();
        setPortfolioAnalysis(data);
      } else {
        setError('Failed to load portfolio analysis');
      }
    } catch (e) {
      setError('Failed to connect to backend');
      console.error('Error loading portfolio analysis:', e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeSymbol = async (symbol: string) => {
    if (!symbol.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${base}/signals/analyze/${symbol.trim().toUpperCase()}?signal_type=both`);

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Analysis failed');
      }
    } catch (e) {
      setError('Failed to analyze symbol');
      console.error('Error analyzing symbol:', e);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const getStrengthColor = (strength: string) => {
    const colors = {
      'VERY_STRONG': 'success',
      'STRONG': 'info',
      'NEUTRAL': 'default',
      'WEAK': 'warning',
      'VERY_WEAK': 'error',
    };
    return colors[strength] || 'default';
  };

  const getSentimentColor = (ratio: number) => {
    if (ratio > 0.6) return '#4caf50';
    if (ratio < 0.4) return '#f44336';
    return '#ff9800';
  };

  const FactorChart = ({ factors, title }: { factors: SignalFactor; title: string }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}因子分析
        </Typography>
        {Object.entries(factors).map(([factor, score]) => (
          <Box key={factor} sx={{ mb: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="body2">
                {getFactorName(factor)}
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {score.toFixed(1)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={score}
              color={score >= 70 ? 'success' : score >= 50 ? 'warning' : 'error'}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  );

  const getFactorName = (factor: string) => {
    const factorNames = {
      'trend_alignment': '趋势一致性',
      'momentum': '动量指标',
      'mean_reversion': '均值回归',
      'volume_confirmation': '成交量确认',
      'support_resistance': '支撑阻力',
      'market_sentiment': '市场情绪',
      'profit_taking': '获利了结',
      'trend_reversal': '趋势反转',
      'momentum_divergence': '动量背离',
      'resistance_rejection': '阻力拒绝',
      'risk_management': '风险管理',
    };
    return factorNames[factor] || factor;
  };

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white mb-6">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                智能信号分析
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                AI驱动的最佳买卖点识别系统
              </Typography>
            </Box>
            <Box display="flex" gap={2} alignItems="center">
              <ShowChartIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              <IconButton color="inherit" onClick={loadMarketOverview}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="市场概览" />
        <Tab label="持仓分析" />
        <Tab label="个股分析" />
        <Tab label="因子说明" />
      </Tabs>

      {/* Market Overview Tab */}
      {currentTab === 0 && (
        <Box>
          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {marketOverview && (
            <Grid container spacing={3}>
              {/* Market Statistics */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      市场统计
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="primary">
                            {marketOverview.analyzed_symbols}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            分析股票数
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="success.main">
                            {marketOverview.signals_summary.buy_signals.total}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            买入信号
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="error.main">
                            {marketOverview.signals_summary.sell_signals.total}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            卖出信号
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography
                            variant="h4"
                            sx={{ color: getSentimentColor(marketOverview.market_sentiment.bullish_ratio) }}
                          >
                            {(marketOverview.market_sentiment.bullish_ratio * 100).toFixed(0)}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            看涨比例
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Buy Signals */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                      顶级买入机会
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>股票</TableCell>
                            <TableCell align="right">置信度</TableCell>
                            <TableCell align="right">价格</TableCell>
                            <TableCell>原因</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {marketOverview.signals_summary.buy_signals.top_signals.map((signal, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography fontWeight="medium">{signal.symbol}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={`${(signal.confidence * 100).toFixed(0)}%`}
                                  color={getConfidenceColor(signal.confidence)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                {signal.price.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {signal.reason.substring(0, 20)}...
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Sell Signals */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                      <TrendingDownIcon color="error" sx={{ mr: 1 }} />
                      顶级卖出信号
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>股票</TableCell>
                            <TableCell align="right">置信度</TableCell>
                            <TableCell align="right">价格</TableCell>
                            <TableCell>原因</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {marketOverview.signals_summary.sell_signals.top_signals.map((signal, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography fontWeight="medium">{signal.symbol}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={`${(signal.confidence * 100).toFixed(0)}%`}
                                  color={getConfidenceColor(signal.confidence)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                {signal.price.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {signal.reason.substring(0, 20)}...
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* Portfolio Analysis Tab */}
      {currentTab === 1 && (
        <Box>
          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {portfolioAnalysis && (
            <Grid container spacing={3}>
              {/* Portfolio Summary */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      持仓概览
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="primary">
                            {portfolioAnalysis.portfolio_summary.total_positions}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            总持仓数
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="success.main">
                            {portfolioAnalysis.portfolio_summary.profitable_positions}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            盈利持仓
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="error.main">
                            {portfolioAnalysis.portfolio_summary.losing_positions}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            亏损持仓
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center">
                          <Typography variant="h4" color="warning.main">
                            {portfolioAnalysis.portfolio_summary.high_risk_positions}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            高风险持仓
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box mt={3}>
                      <Typography variant="subtitle1" gutterBottom>
                        总盈亏: <span style={{ color: portfolioAnalysis.portfolio_summary.total_pnl >= 0 ? '#4caf50' : '#f44336' }}>
                          ${portfolioAnalysis.portfolio_summary.total_pnl?.toFixed(2) || '0.00'}
                        </span>
                      </Typography>
                      <Typography variant="subtitle1">
                        总市值: ${portfolioAnalysis.portfolio_summary.total_market_value?.toFixed(2) || '0.00'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Position Analysis List */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      持仓分析建议
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>股票</TableCell>
                            <TableCell align="right">数量</TableCell>
                            <TableCell align="right">成本</TableCell>
                            <TableCell align="right">现价</TableCell>
                            <TableCell align="right">盈亏</TableCell>
                            <TableCell align="right">信号置信度</TableCell>
                            <TableCell>建议</TableCell>
                            <TableCell>风险等级</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {portfolioAnalysis.positions_analysis.map((position: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography fontWeight="medium">{position.symbol}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {position.symbol_name}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {position.position_info.quantity}
                              </TableCell>
                              <TableCell align="right">
                                ${position.position_info.avg_cost?.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                ${position.position_info.current_price?.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                <Typography
                                  color={position.position_info.pnl_percent >= 0 ? 'success.main' : 'error.main'}
                                  fontWeight="medium"
                                >
                                  {position.position_info.pnl_percent?.toFixed(2)}%
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {position.sell_signal && (
                                  <Chip
                                    label={`${(position.sell_signal.confidence * 100).toFixed(0)}%`}
                                    color={getConfidenceColor(position.sell_signal.confidence)}
                                    size="small"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {position.recommendation}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={position.risk_level}
                                  color={position.risk_level === 'high' ? 'error' : position.risk_level === 'medium' ? 'warning' : 'success'}
                                  size="small"
                                  variant={position.risk_level === 'high' ? 'filled' : 'outlined'}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Quick Actions */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="error.main">
                      需要立即关注
                    </Typography>
                    {portfolioAnalysis.recommendations.immediate_action.length > 0 ? (
                      portfolioAnalysis.recommendations.immediate_action.map((position: any, index: number) => (
                        <Alert severity="error" key={index} sx={{ mb: 1 }}>
                          <Typography fontWeight="medium">{position.symbol}</Typography>
                          <Typography variant="body2">{position.recommendation}</Typography>
                        </Alert>
                      ))
                    ) : (
                      <Typography color="text.secondary">暂无需要立即处理的持仓</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="success.main">
                      获利了结机会
                    </Typography>
                    {portfolioAnalysis.recommendations.profit_taking.length > 0 ? (
                      portfolioAnalysis.recommendations.profit_taking.map((position: any, index: number) => (
                        <Alert severity="success" key={index} sx={{ mb: 1 }}>
                          <Typography fontWeight="medium">{position.symbol}</Typography>
                          <Typography variant="body2">
                            盈利 {position.position_info.pnl_percent?.toFixed(2)}% - {position.recommendation}
                          </Typography>
                        </Alert>
                      ))
                    ) : (
                      <Typography color="text.secondary">暂无明显获利了结机会</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {portfolioAnalysis?.message && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {portfolioAnalysis.message}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      )}

      {/* Individual Analysis Tab */}
      {currentTab === 2 && (
        <Box>
          {/* Search Box */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  fullWidth
                  label="输入股票代码"
                  placeholder="例如: 0700.HK, AAPL.US"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && analyzeSymbol(symbolInput)}
                />
                <Button
                  variant="contained"
                  onClick={() => analyzeSymbol(symbolInput)}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                >
                  分析
                </Button>
              </Box>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Analysis Results */}
          {analysis && (
            <Grid container spacing={3}>
              {/* Basic Info */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h5" gutterBottom>
                      {analysis.symbol} - 信号分析
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={3}>
                        <Typography variant="body2" color="text.secondary">当前价格</Typography>
                        <Typography variant="h6">{analysis.current_price.toFixed(2)}</Typography>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Typography variant="body2" color="text.secondary">数据点数</Typography>
                        <Typography variant="h6">{analysis.data_points}</Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">分析时间</Typography>
                        <Typography variant="body1">
                          {new Date(analysis.analysis_time).toLocaleString()}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Buy Signal */}
              {analysis.signals.buy && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="success.main">
                        买入信号分析
                      </Typography>

                      <Box display="flex" gap={1} mb={2}>
                        <Chip
                          label={`置信度 ${(analysis.signals.buy.confidence * 100).toFixed(0)}%`}
                          color={getConfidenceColor(analysis.signals.buy.confidence)}
                        />
                        <Chip
                          label={analysis.signals.buy.strength}
                          color={getStrengthColor(analysis.signals.buy.strength) as any}
                        />
                      </Box>

                      <Typography variant="body1" sx={{ mb: 2, fontStyle: 'italic' }}>
                        {analysis.signals.buy.reason}
                      </Typography>

                      <Grid container spacing={1} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">建议价格</Typography>
                          <Typography variant="h6">{analysis.signals.buy.price.toFixed(2)}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">仓位建议</Typography>
                          <Typography variant="h6">
                            {analysis.signals.buy.position_size ? `${(analysis.signals.buy.position_size * 100).toFixed(1)}%` : 'N/A'}
                          </Typography>
                        </Grid>
                        {analysis.signals.buy.stop_loss && (
                          <Grid item xs={6}>
                            <Typography variant="body2" color="error.main">止损价</Typography>
                            <Typography variant="body1">{analysis.signals.buy.stop_loss.toFixed(2)}</Typography>
                          </Grid>
                        )}
                        {analysis.signals.buy.take_profit && (
                          <Grid item xs={6}>
                            <Typography variant="body2" color="success.main">止盈价</Typography>
                            <Typography variant="body1">{analysis.signals.buy.take_profit.toFixed(2)}</Typography>
                          </Grid>
                        )}
                      </Grid>

                      <FactorChart factors={analysis.signals.buy.factors} title="买入" />
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Sell Signal */}
              {analysis.signals.sell && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="error.main">
                        卖出信号分析
                      </Typography>

                      <Box display="flex" gap={1} mb={2}>
                        <Chip
                          label={`置信度 ${(analysis.signals.sell.confidence * 100).toFixed(0)}%`}
                          color={getConfidenceColor(analysis.signals.sell.confidence)}
                        />
                        <Chip
                          label={analysis.signals.sell.strength}
                          color={getStrengthColor(analysis.signals.sell.strength) as any}
                        />
                      </Box>

                      <Typography variant="body1" sx={{ mb: 2, fontStyle: 'italic' }}>
                        {analysis.signals.sell.reason}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        建议价格: {analysis.signals.sell.price.toFixed(2)}
                      </Typography>

                      <FactorChart factors={analysis.signals.sell.factors} title="卖出" />
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* No Signals */}
              {!analysis.signals.buy && !analysis.signals.sell && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    当前没有检测到强烈的买入或卖出信号，建议继续观望。
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      )}

      {/* Factors Explanation Tab */}
      {currentTab === 3 && (
        <Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="success.main">
                    买入因子说明
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="趋势一致性 (0-100)"
                        secondary="分析价格是否与主要趋势方向一致，高分表示趋势向上，适合买入"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="动量指标 (0-100)"
                        secondary="结合RSI、MACD等动量指标，高分表示动量积极，有上涨潜力"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="均值回归机会 (0-100)"
                        secondary="价格偏离均值的程度，高分表示价格被低估，有回归空间"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="成交量确认 (0-100)"
                        secondary="成交量是否支持价格走势，高分表示成交量放大，确认买入信号"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="支撑阻力位置 (0-100)"
                        secondary="价格在支撑阻力位的位置关系，高分表示接近强支撑位，风险较低"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="市场情绪 (0-100)"
                        secondary="基于K线形态的市场情绪指标，高分表示市场情绪乐观"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="error.main">
                    卖出因子说明
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="获利了结时机 (0-100)"
                        secondary="基于盈利情况和持有时间判断，高分表示适合获利了结"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="趋势反转信号 (0-100)"
                        secondary="识别趋势反转的早期信号，高分表示趋势可能反转"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="动量背离 (0-100)"
                        secondary="价格与动量指标的背离情况，高分表示动量背离，谨慎持有"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="阻力位拒绝 (0-100)"
                        secondary="价格在阻力位的表现，高分表示遭遇强阻力，考虑卖出"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="风险管理 (0-100)"
                        secondary="基于亏损和波动率的风险评估，高分表示需要控制风险"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    信号强度和置信度说明
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>信号强度</Typography>
                      <Box display="flex" flexDirection="column" gap={1}>
                        <Chip label="VERY_STRONG - 信号很强，建议操作" color="success" />
                        <Chip label="STRONG - 信号较强，可考虑操作" color="info" />
                        <Chip label="NEUTRAL - 信号中性，可观望" />
                        <Chip label="WEAK - 信号较弱，谨慎操作" color="warning" />
                        <Chip label="VERY_WEAK - 信号很弱，不建议操作" color="error" />
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>置信度区间</Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText primary="90%以上: 极高置信度，强烈建议" />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="80-90%: 高置信度，建议操作" />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="70-80%: 中高置信度，可操作" />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="60-70%: 中等置信度，谨慎操作" />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="60%以下: 低置信度，不建议操作" />
                        </ListItem>
                      </List>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}