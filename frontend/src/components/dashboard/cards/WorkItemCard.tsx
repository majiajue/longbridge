import { useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Typography,
  Tabs,
  Tab,
  Tooltip,
  Button,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { WorkItem, WorkItemListResponse, CardState, WorkItemType } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface WorkItemCardProps {
  data?: WorkItemListResponse;
  state: CardState;
  onRetry?: () => void;
  onItemClick?: (item: WorkItem) => void;
  onTabChange?: (type: WorkItemType | 'all') => void;
  onViewAll?: () => void;
  height?: number;
}

const priorityConfig: Record<string, { color: 'error' | 'warning' | 'info' | 'default'; label: string }> = {
  urgent: { color: 'error', label: '紧急' },
  high: { color: 'warning', label: '高' },
  normal: { color: 'info', label: '普通' },
  low: { color: 'default', label: '低' },
};

const typeConfig: Record<WorkItemType, { label: string; icon: string }> = {
  sampling: { label: '采样任务', icon: '🧪' },
  testing: { label: '检测任务', icon: '🔬' },
  approval: { label: '审批', icon: '✅' },
  review: { label: '复核/签发', icon: '📋' },
};

const tabs: { value: WorkItemType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'sampling', label: '采样' },
  { value: 'testing', label: '检测' },
  { value: 'approval', label: '审批' },
  { value: 'review', label: '复核' },
];

function formatDueDate(dueDate?: string): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: '', isOverdue: false };
  const due = new Date(dueDate);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { text: `逾期${Math.abs(days)}天`, isOverdue: true };
  } else if (days === 0) {
    return { text: '今天到期', isOverdue: false };
  } else if (days === 1) {
    return { text: '明天到期', isOverdue: false };
  } else if (days <= 7) {
    return { text: `${days}天后到期`, isOverdue: false };
  } else {
    return { text: due.toLocaleDateString('zh-CN'), isOverdue: false };
  }
}

export default function WorkItemCard({
  data,
  state,
  onRetry,
  onItemClick,
  onTabChange,
  onViewAll,
  height = 420,
}: WorkItemCardProps) {
  const [activeTab, setActiveTab] = useState<WorkItemType | 'all'>('all');

  const handleTabChange = (_: React.SyntheticEvent, newValue: WorkItemType | 'all') => {
    setActiveTab(newValue);
    onTabChange?.(newValue);
  };

  const filteredItems = data?.items.filter(
    (item) => activeTab === 'all' || item.type === activeTab
  ) || [];

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              我的待办
            </Typography>
            {data && (
              <Chip
                label={data.total}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={onViewAll}
              sx={{ fontSize: 12 }}
            >
              查看全部
            </Button>
            <IconButton size="small">
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{ pb: 0 }}
      />

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ px: 2, minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0 } }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            sx={{ fontSize: 13, minWidth: 60 }}
          />
        ))}
      </Tabs>

      <CardContent sx={{ flex: 1, overflow: 'auto', pt: 1, px: 2 }}>
        {state === 'loading' && <CardSkeleton variant="list" rows={6} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && filteredItems.length === 0 && (
          <EmptyState
            title="暂无待办事项"
            description="当前没有需要处理的任务"
            icon={<span style={{ fontSize: 48 }}>📋</span>}
            actionText="去任务中心"
            onAction={onViewAll}
          />
        )}
        {state === 'success' && filteredItems.length > 0 && (
          <List dense disablePadding>
            {filteredItems.map((item) => {
              const dueInfo = formatDueDate(item.dueDate);
              const typeInfo = typeConfig[item.type];
              const priorityInfo = priorityConfig[item.priority];

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
                    borderColor: item.priority === 'urgent' ? 'error.main' :
                                 item.priority === 'high' ? 'warning.main' : 'transparent',
                  }}
                  onClick={() => onItemClick?.(item)}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <span style={{ fontSize: 14 }}>{typeInfo.icon}</span>
                        <Typography variant="body2" fontWeight="medium" noWrap sx={{ flex: 1 }}>
                          {item.title}
                        </Typography>
                        <Chip
                          label={priorityInfo.label}
                          size="small"
                          color={priorityInfo.color}
                          sx={{ height: 18, fontSize: 10, '& .MuiChip-label': { px: 1 } }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                        {item.projectName && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
                            {item.projectName}
                          </Typography>
                        )}
                        {item.node && (
                          <Chip
                            label={item.node}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        )}
                        {item.dueDate && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                            <AccessTimeIcon sx={{ fontSize: 12, color: dueInfo.isOverdue ? 'error.main' : 'text.secondary' }} />
                            <Typography
                              variant="caption"
                              color={dueInfo.isOverdue ? 'error' : 'text.secondary'}
                            >
                              {dueInfo.text}
                            </Typography>
                          </Box>
                        )}
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
