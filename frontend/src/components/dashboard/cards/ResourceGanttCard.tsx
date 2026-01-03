import { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  Select,
  MenuItem,
  Avatar,
  Tooltip,
  Chip,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import BuildIcon from '@mui/icons-material/Build';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningIcon from '@mui/icons-material/Warning';
import { ResourceItem, ResourceType, ResourceAssignment, CardState } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface ResourceGanttCardProps {
  data?: ResourceItem[];
  state: CardState;
  onRetry?: () => void;
  onResourceClick?: (resource: ResourceItem) => void;
  onAssignmentClick?: (assignment: ResourceAssignment) => void;
  onViewAll?: () => void;
  height?: number;
}

type ViewMode = 'resource' | 'project';
type TimeGranularity = 'day' | 'week';

// 获取日期范围
function getDateRange(granularity: TimeGranularity, offset: number = 0): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  const daysToShow = granularity === 'day' ? 14 : 7;

  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i + offset * daysToShow);
    dates.push(date);
  }
  return dates;
}

// 格式化日期
function formatDate(date: Date, granularity: TimeGranularity): string {
  if (granularity === 'week') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  return `${date.getDate()} ${weekDay}`;
}

// 计算任务在时间轴上的位置和宽度
function calculateBarPosition(
  assignment: ResourceAssignment,
  dates: Date[],
  cellWidth: number
): { left: number; width: number; visible: boolean } {
  const startDate = new Date(assignment.startDate);
  const endDate = new Date(assignment.endDate);
  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];

  // 检查是否在可见范围内
  if (endDate < rangeStart || startDate > rangeEnd) {
    return { left: 0, width: 0, visible: false };
  }

  const effectiveStart = startDate < rangeStart ? rangeStart : startDate;
  const effectiveEnd = endDate > rangeEnd ? rangeEnd : endDate;

  const startIndex = Math.max(0, Math.floor((effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));
  const endIndex = Math.min(dates.length - 1, Math.ceil((effectiveEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));

  const left = startIndex * cellWidth;
  const width = (endIndex - startIndex + 1) * cellWidth;

  return { left, width, visible: true };
}

export default function ResourceGanttCard({
  data,
  state,
  onRetry,
  onResourceClick,
  onAssignmentClick,
  onViewAll,
  height = 420,
}: ResourceGanttCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('resource');
  const [granularity, setGranularity] = useState<TimeGranularity>('week');
  const [resourceType, setResourceType] = useState<ResourceType | 'all'>('all');
  const [dateOffset, setDateOffset] = useState(0);

  const dates = useMemo(() => getDateRange(granularity, dateOffset), [granularity, dateOffset]);

  const filteredData = data?.filter(
    (resource) => resourceType === 'all' || resource.type === resourceType
  );

  const cellWidth = 60; // 每个日期格子的宽度
  const resourceColumnWidth = 140; // 资源列宽度

  // 检查是否有冲突
  const hasConflicts = data?.some((resource) =>
    resource.assignments.some((a) => a.hasConflict)
  );

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              资源排布
            </Typography>
            {hasConflicts && (
              <Chip
                icon={<WarningIcon sx={{ fontSize: 14 }} />}
                label="有冲突"
                size="small"
                color="warning"
                sx={{ height: 22, fontSize: 11 }}
              />
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="small"
            >
              <ToggleButton value="resource" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>
                资源视图
              </ToggleButton>
              <ToggleButton value="project" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>
                项目视图
              </ToggleButton>
            </ToggleButtonGroup>

            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as TimeGranularity)}
                sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 12 } }}
              >
                <MenuItem value="day">日</MenuItem>
                <MenuItem value="week">周</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as ResourceType | 'all')}
                sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 12 } }}
              >
                <MenuItem value="all">全部</MenuItem>
                <MenuItem value="person">人员</MenuItem>
                <MenuItem value="equipment">设备</MenuItem>
              </Select>
            </FormControl>

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

      <CardContent sx={{ flex: 1, overflow: 'hidden', pt: 0, px: 2 }}>
        {state === 'loading' && <CardSkeleton variant="gantt" height={height - 80} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && (!filteredData || filteredData.length === 0) && (
          <EmptyState
            title="暂无排布数据"
            description="请选择资源类型或调整时间范围"
            icon={<span style={{ fontSize: 48 }}>📊</span>}
          />
        )}
        {state === 'success' && filteredData && filteredData.length > 0 && (
          <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* 左侧资源列表 */}
            <Box
              sx={{
                width: resourceColumnWidth,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              {/* 表头 */}
              <Box
                sx={{
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  bgcolor: 'grey.100',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" fontWeight="bold">
                  资源
                </Typography>
              </Box>
              {/* 资源行 */}
              <Box sx={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
                {filteredData.map((resource) => (
                  <Box
                    key={resource.id}
                    sx={{
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      px: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover', cursor: 'pointer' },
                    }}
                    onClick={() => onResourceClick?.(resource)}
                  >
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        mr: 1,
                        bgcolor: resource.type === 'person' ? 'primary.main' : 'secondary.main',
                        fontSize: 14,
                      }}
                    >
                      {resource.type === 'person' ? (
                        <PersonIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <BuildIcon sx={{ fontSize: 16 }} />
                      )}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" noWrap fontWeight="medium">
                        {resource.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {resource.role || resource.department}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* 右侧甘特图区域 */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* 日期导航 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1,
                  height: 40,
                  bgcolor: 'grey.100',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <IconButton size="small" onClick={() => setDateOffset(dateOffset - 1)}>
                  <ChevronLeftIcon />
                </IconButton>
                <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                  {dates.map((date, index) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    return (
                      <Box
                        key={index}
                        sx={{
                          width: cellWidth,
                          flexShrink: 0,
                          textAlign: 'center',
                          bgcolor: isToday ? 'primary.100' : isWeekend ? 'grey.200' : 'transparent',
                          borderRight: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography
                          variant="caption"
                          fontWeight={isToday ? 'bold' : 'normal'}
                          color={isToday ? 'primary.main' : 'text.secondary'}
                        >
                          {formatDate(date, granularity)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                <IconButton size="small" onClick={() => setDateOffset(dateOffset + 1)}>
                  <ChevronRightIcon />
                </IconButton>
              </Box>

              {/* 甘特图内容 */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {filteredData.map((resource) => (
                  <Box
                    key={resource.id}
                    sx={{
                      height: 48,
                      position: 'relative',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {/* 网格线 */}
                    <Box sx={{ display: 'flex', position: 'absolute', inset: 0 }}>
                      {dates.map((date, index) => {
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                          <Box
                            key={index}
                            sx={{
                              width: cellWidth,
                              flexShrink: 0,
                              borderRight: '1px solid',
                              borderColor: 'divider',
                              bgcolor: isToday ? 'primary.50' : isWeekend ? 'grey.50' : 'transparent',
                            }}
                          />
                        );
                      })}
                    </Box>

                    {/* 任务条 */}
                    {resource.assignments.map((assignment) => {
                      const { left, width, visible } = calculateBarPosition(
                        assignment,
                        dates,
                        cellWidth
                      );

                      if (!visible) return null;

                      return (
                        <Tooltip
                          key={assignment.id}
                          title={
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {assignment.projectName}
                              </Typography>
                              {assignment.projectCode && (
                                <Typography variant="caption">{assignment.projectCode}</Typography>
                              )}
                              <Typography variant="caption" display="block">
                                {assignment.startDate} - {assignment.endDate}
                              </Typography>
                              <Typography variant="caption" display="block">
                                占用率: {assignment.allocation}%
                              </Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: left + 2,
                              width: width - 4,
                              height: 32,
                              bgcolor: assignment.color || '#2196f3',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              px: 1,
                              cursor: 'pointer',
                              opacity: 0.9,
                              border: assignment.hasConflict ? '2px solid #f44336' : 'none',
                              '&:hover': { opacity: 1, boxShadow: 2 },
                            }}
                            onClick={() => onAssignmentClick?.(assignment)}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'white',
                                fontWeight: 'medium',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {assignment.projectCode || assignment.projectName}
                            </Typography>
                            {assignment.hasConflict && (
                              <WarningIcon
                                sx={{
                                  fontSize: 14,
                                  color: 'white',
                                  ml: 0.5,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
