import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useState } from 'react';
import { ProjectProgress, ProjectStatus, CardState } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface ProgressCardProps {
  data?: ProjectProgress[];
  state: CardState;
  onRetry?: () => void;
  onItemClick?: (item: ProjectProgress) => void;
  onViewAll?: () => void;
  onUrge?: (item: ProjectProgress) => void;
  height?: number;
  variant?: 'list' | 'table';
}

const statusConfig: Record<ProjectStatus, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  not_started: { label: '未开始', color: 'default' },
  in_progress: { label: '进行中', color: 'primary' },
  delayed: { label: '已延期', color: 'error' },
  completed: { label: '已完成', color: 'success' },
  suspended: { label: '已暂停', color: 'warning' },
};

const riskConfig: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  low: { label: '低', color: 'success' },
  medium: { label: '中', color: 'warning' },
  high: { label: '高', color: 'error' },
};

export default function ProgressCard({
  data,
  state,
  onRetry,
  onItemClick,
  onViewAll,
  onUrge,
  height = 260,
  variant = 'list',
}: ProgressCardProps) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  const filteredData = data?.filter((item) => {
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchSearch = !searchText ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchSearch;
  });

  const isTableVariant = variant === 'table';

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography variant="h6" fontWeight="bold">
            {isTableVariant ? '项目/合同进度总览' : '我参与的进度'}
          </Typography>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isTableVariant && (
              <>
                <TextField
                  size="small"
                  placeholder="搜索项目..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 160, '& .MuiInputBase-input': { py: 0.75, fontSize: 13 } }}
                />
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                    sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 12 } }}
                  >
                    <MenuItem value="all">全部状态</MenuItem>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <MenuItem key={key} value={key}>
                        {config.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
            <Button
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={onViewAll}
              sx={{ fontSize: 12 }}
            >
              全部
            </Button>
          </Box>
        }
        sx={{ pb: 1 }}
      />

      <CardContent sx={{ flex: 1, overflow: 'auto', pt: 0, px: isTableVariant ? 0 : 2 }}>
        {state === 'loading' && <CardSkeleton variant={isTableVariant ? 'table' : 'list'} rows={5} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && (!filteredData || filteredData.length === 0) && (
          <EmptyState
            title="暂无进行中项目"
            description="当前没有符合条件的项目"
            icon={<span style={{ fontSize: 48 }}>📊</span>}
          />
        )}

        {/* 列表视图 */}
        {state === 'success' && filteredData && filteredData.length > 0 && !isTableVariant && (
          <Box>
            {filteredData.slice(0, 5).map((item) => {
              const statusInfo = statusConfig[item.status];

              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: 'background.default',
                    '&:hover': { bgcolor: 'action.hover', cursor: 'pointer' },
                  }}
                  onClick={() => onItemClick?.(item)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {item.name}
                      </Typography>
                      {item.code && (
                        <Typography variant="caption" color="text.secondary">
                          {item.code}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={statusInfo.label}
                        size="small"
                        color={statusInfo.color}
                        sx={{ height: 20, fontSize: 10 }}
                      />
                      {item.riskLevel && (
                        <Chip
                          label={`风险:${riskConfig[item.riskLevel].label}`}
                          size="small"
                          color={riskConfig[item.riskLevel].color}
                          variant="outlined"
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      )}
                    </Box>
                  </Box>

                  {/* 进度条或 Stepper */}
                  {item.steps ? (
                    <Stepper activeStep={item.steps.findIndex(s => s.status === 'current')} alternativeLabel sx={{ py: 1 }}>
                      {item.steps.map((step) => (
                        <Step key={step.id} completed={step.status === 'completed'}>
                          <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 10 } }}>
                            {step.name}
                          </StepLabel>
                        </Step>
                      ))}
                    </Stepper>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={item.progress}
                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                        color={item.status === 'delayed' ? 'error' : 'primary'}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35 }}>
                        {item.progress}%
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {item.client && `${item.client} · `}
                      {item.manager && `负责人: ${item.manager}`}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={item.delayDays && item.delayDays > 0 ? 'error' : 'text.secondary'}
                    >
                      {item.delayDays && item.delayDays > 0
                        ? `延期${item.delayDays}天`
                        : `计划: ${new Date(item.endDate).toLocaleDateString('zh-CN')}`}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {/* 表格视图 */}
        {state === 'success' && filteredData && filteredData.length > 0 && isTableVariant && (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>项目名称</TableCell>
                  <TableCell>客户</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>进度</TableCell>
                  <TableCell>负责人</TableCell>
                  <TableCell>计划完成</TableCell>
                  <TableCell>风险</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((item) => {
                  const statusInfo = statusConfig[item.status];

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onItemClick?.(item)}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {item.name}
                          </Typography>
                          {item.code && (
                            <Typography variant="caption" color="text.secondary">
                              {item.code}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.client || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusInfo.label}
                          size="small"
                          color={statusInfo.color}
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={item.progress}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                            color={item.status === 'delayed' ? 'error' : 'primary'}
                          />
                          <Typography variant="caption">{item.progress}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.manager || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {new Date(item.endDate).toLocaleDateString('zh-CN')}
                          </Typography>
                          {item.delayDays && item.delayDays > 0 && (
                            <Typography variant="caption" color="error">
                              延期{item.delayDays}天
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {item.riskLevel ? (
                          <Chip
                            label={riskConfig[item.riskLevel].label}
                            size="small"
                            color={riskConfig[item.riskLevel].color}
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUrge?.(item);
                          }}
                          sx={{ fontSize: 11, minWidth: 'auto', px: 1 }}
                        >
                          催办
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
