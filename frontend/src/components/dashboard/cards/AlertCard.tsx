import { useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Badge,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AlertSummary, AlertCategory, CardState } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface AlertCardProps {
  data?: AlertSummary[];
  state: CardState;
  onRetry?: () => void;
  onItemClick?: (category: AlertCategory) => void;
  onViewAll?: () => void;
  onSettings?: () => void;
  height?: number;
}

const categoryConfig: Record<AlertCategory, { icon: string; color: string }> = {
  inventory_low: { icon: '📦', color: '#ff9800' },
  expiring: { icon: '⏳', color: '#f44336' },
  cert_expiring: { icon: '📜', color: '#e91e63' },
  maintenance_due: { icon: '🔧', color: '#9c27b0' },
  task_overdue: { icon: '⏰', color: '#f44336' },
};

export default function AlertCard({
  data,
  state,
  onRetry,
  onItemClick,
  onViewAll,
  onSettings,
  height = 420,
}: AlertCardProps) {
  const [expandedCategory, setExpandedCategory] = useState<AlertCategory | null>(null);

  const toggleExpand = (category: AlertCategory) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const totalCount = data?.reduce((sum, s) => sum + s.count, 0) || 0;

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              预警提醒
            </Typography>
            {totalCount > 0 && (
              <Chip
                label={totalCount}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={onSettings}>
              <SettingsIcon fontSize="small" />
            </IconButton>
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
        {state === 'loading' && <CardSkeleton variant="list" rows={5} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && (!data || data.length === 0) && (
          <EmptyState
            title="暂无预警"
            description="阈值可在设置中配置"
            icon={<span style={{ fontSize: 48 }}>✅</span>}
          />
        )}
        {state === 'success' && data && data.length > 0 && (
          <List disablePadding>
            {data.map((summary) => {
              const config = categoryConfig[summary.category];
              const isExpanded = expandedCategory === summary.category;

              return (
                <Box key={summary.category}>
                  <ListItem
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      px: 1.5,
                      py: 1,
                      bgcolor: 'background.default',
                      '&:hover': { bgcolor: 'action.hover', cursor: 'pointer' },
                    }}
                    onClick={() => toggleExpand(summary.category)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      <span style={{ fontSize: 18 }}>{config.icon}</span>
                      <Typography variant="body2" fontWeight="medium">
                        {summary.categoryLabel}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {summary.criticalCount > 0 && (
                        <Chip
                          label={summary.criticalCount}
                          size="small"
                          color="error"
                          sx={{ height: 20, fontSize: 11, minWidth: 24 }}
                        />
                      )}
                      {summary.warningCount > 0 && (
                        <Chip
                          label={summary.warningCount}
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: 11, minWidth: 24 }}
                        />
                      )}
                      <IconButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  </ListItem>

                  <Collapse in={isExpanded}>
                    <Box sx={{ pl: 4, pr: 1, pb: 1 }}>
                      {summary.items.slice(0, 3).map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            py: 1,
                            px: 1.5,
                            borderRadius: 1,
                            mb: 0.5,
                            bgcolor: item.level === 'critical' ? 'error.50' : 'warning.50',
                            '&:hover': { opacity: 0.9, cursor: 'pointer' },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemClick?.(summary.category);
                          }}
                        >
                          <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.message}
                          </Typography>
                        </Box>
                      ))}
                      {summary.items.length > 3 && (
                        <Button
                          size="small"
                          sx={{ mt: 0.5, fontSize: 12 }}
                          onClick={() => onItemClick?.(summary.category)}
                        >
                          查看更多 ({summary.items.length - 3})
                        </Button>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
