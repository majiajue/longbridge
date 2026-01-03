import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  List,
  ListItem,
  Chip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useState } from 'react';
import { ScheduleItem, ScheduleType, ScheduleStatus, CardState } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface ScheduleCardProps {
  data?: ScheduleItem[];
  state: CardState;
  onRetry?: () => void;
  onItemClick?: (item: ScheduleItem) => void;
  onViewAll?: () => void;
  height?: number;
}

const typeConfig: Record<ScheduleType, { icon: string; color: string }> = {
  meeting: { icon: '👥', color: '#2196f3' },
  deadline: { icon: '⏰', color: '#f44336' },
  milestone: { icon: '🎯', color: '#4caf50' },
  task: { icon: '📋', color: '#ff9800' },
  event: { icon: '📅', color: '#9c27b0' },
};

const statusConfig: Record<ScheduleStatus, { label: string; color: 'default' | 'primary' | 'success' | 'error' }> = {
  upcoming: { label: '即将开始', color: 'primary' },
  in_progress: { label: '进行中', color: 'success' },
  completed: { label: '已完成', color: 'default' },
  overdue: { label: '已过期', color: 'error' },
};

function formatTime(startTime: string, endTime?: string): string {
  const start = new Date(startTime);
  const startStr = start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (endTime) {
    const end = new Date(endTime);
    const endStr = end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return `${startStr} - ${endStr}`;
  }
  return startStr;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return '今天';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return '明天';
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function ScheduleCard({
  data,
  state,
  onRetry,
  onItemClick,
  onViewAll,
  height = 320,
}: ScheduleCardProps) {
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');

  // 按日期分组
  const groupedSchedules = data?.reduce((acc, item) => {
    const dateKey = new Date(item.startTime).toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ScheduleItem[]>) || {};

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography variant="h6" fontWeight="bold">
            日程安排
          </Typography>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="small"
            >
              <ToggleButton value="agenda" sx={{ px: 1, py: 0.5 }}>
                <ViewAgendaIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
              <ToggleButton value="calendar" sx={{ px: 1, py: 0.5 }}>
                <CalendarMonthIcon sx={{ fontSize: 16 }} />
              </ToggleButton>
            </ToggleButtonGroup>
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

      <CardContent sx={{ flex: 1, overflow: 'auto', pt: 0, px: 2 }}>
        {state === 'loading' && <CardSkeleton variant="list" rows={4} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && (!data || data.length === 0) && (
          <EmptyState
            title="暂无日程"
            description="本时间范围内没有日程安排"
            icon={<span style={{ fontSize: 48 }}>📅</span>}
            actionText="去排期"
            onAction={onViewAll}
          />
        )}
        {state === 'success' && data && data.length > 0 && viewMode === 'agenda' && (
          <Box>
            {Object.entries(groupedSchedules).map(([dateKey, items]) => (
              <Box key={dateKey} sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="medium" sx={{ mb: 1, display: 'block' }}>
                  {formatDate(items[0].startTime)}
                </Typography>
                <List disablePadding>
                  {items.map((item) => {
                    const typeInfo = typeConfig[item.type];
                    const statusInfo = statusConfig[item.status];

                    return (
                      <ListItem
                        key={item.id}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          px: 1.5,
                          py: 1,
                          bgcolor: 'background.default',
                          '&:hover': { bgcolor: 'action.hover', cursor: 'pointer' },
                          borderLeft: 3,
                          borderColor: item.color || typeInfo.color,
                        }}
                        onClick={() => onItemClick?.(item)}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <span style={{ fontSize: 14 }}>{typeInfo.icon}</span>
                            <Typography variant="body2" fontWeight="medium" noWrap sx={{ flex: 1 }}>
                              {item.title}
                            </Typography>
                            <Chip
                              label={statusInfo.label}
                              size="small"
                              color={statusInfo.color}
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 3 }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(item.startTime, item.endTime)}
                            </Typography>
                            {item.location && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationOnIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 100 }}>
                                  {item.location}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Box>
        )}
        {state === 'success' && data && data.length > 0 && viewMode === 'calendar' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              日历视图开发中...
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
