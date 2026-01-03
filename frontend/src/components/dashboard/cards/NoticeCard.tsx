import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Badge,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import PushPinIcon from '@mui/icons-material/PushPin';
import { useState } from 'react';
import { NoticeItem, NoticeType, CardState } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface NoticeCardProps {
  data?: NoticeItem[];
  state: CardState;
  onRetry?: () => void;
  onItemClick?: (item: NoticeItem) => void;
  onViewAll?: () => void;
  onMarkAllRead?: () => void;
  height?: number;
}

const typeConfig: Record<NoticeType, { label: string; color: 'primary' | 'warning' | 'success' | 'info' | 'default' }> = {
  announcement: { label: '公告', color: 'primary' },
  policy: { label: '制度', color: 'warning' },
  news: { label: '资讯', color: 'success' },
  update: { label: '更新', color: 'info' },
  system: { label: '系统', color: 'default' },
};

function formatPublishTime(timeStr: string): string {
  const time = new Date(timeStr);
  const now = new Date();
  const diff = now.getTime() - time.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  }
  return time.toLocaleDateString('zh-CN');
}

export default function NoticeCard({
  data,
  state,
  onRetry,
  onItemClick,
  onViewAll,
  onMarkAllRead,
  height = 320,
}: NoticeCardProps) {
  const [typeFilter, setTypeFilter] = useState<NoticeType | 'all'>('all');

  const filteredData = data?.filter(
    (item) => typeFilter === 'all' || item.type === typeFilter
  );

  const unreadCount = data?.filter((item) => !item.isRead).length || 0;

  // 置顶的排前面
  const sortedData = [...(filteredData || [])].sort((a, b) => {
    if (a.isTop && !b.isTop) return -1;
    if (!a.isTop && b.isTop) return 1;
    return new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime();
  });

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              通知公告
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                color="error"
                sx={{ height: 18, fontSize: 10 }}
              />
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FormControl size="small" sx={{ minWidth: 70 }}>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as NoticeType | 'all')}
                sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 12 } }}
              >
                <MenuItem value="all">全部</MenuItem>
                {Object.entries(typeConfig).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {unreadCount > 0 && (
              <IconButton size="small" onClick={onMarkAllRead} title="全部已读">
                <DoneAllIcon fontSize="small" />
              </IconButton>
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

      <CardContent sx={{ flex: 1, overflow: 'auto', pt: 0, px: 2 }}>
        {state === 'loading' && <CardSkeleton variant="list" rows={4} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && (!sortedData || sortedData.length === 0) && (
          <EmptyState
            title="暂无公告"
            description="当前没有新的通知公告"
            icon={<span style={{ fontSize: 48 }}>📢</span>}
          />
        )}
        {state === 'success' && sortedData && sortedData.length > 0 && (
          <List disablePadding>
            {sortedData.map((item) => {
              const typeInfo = typeConfig[item.type];

              return (
                <ListItem
                  key={item.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    px: 1.5,
                    py: 1,
                    bgcolor: item.isRead ? 'background.default' : 'primary.50',
                    '&:hover': { bgcolor: 'action.hover', cursor: 'pointer' },
                  }}
                  onClick={() => onItemClick?.(item)}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        {item.isTop && (
                          <PushPinIcon
                            sx={{ fontSize: 14, color: 'error.main', mt: 0.3 }}
                          />
                        )}
                        {!item.isRead && (
                          <Badge
                            color="error"
                            variant="dot"
                            sx={{ mt: 0.8 }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          fontWeight={item.isRead ? 'normal' : 'medium'}
                          sx={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            color: item.isRead ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {item.title}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, ml: item.isTop || !item.isRead ? 2.5 : 0 }}>
                        <Chip
                          label={typeInfo.label}
                          size="small"
                          color={typeInfo.color}
                          sx={{ height: 16, fontSize: 10, '& .MuiChip-label': { px: 0.5 } }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {item.publisher}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatPublishTime(item.publishTime)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
