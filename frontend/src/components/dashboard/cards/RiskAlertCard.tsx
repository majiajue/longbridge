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
  Chip,
  Button,
  Avatar,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { RiskSummary, RiskCategory, CardState } from '../../../types/dashboard';
import { CardSkeleton, EmptyState, ErrorState, ForbiddenState } from '../states';

interface RiskAlertCardProps {
  data?: RiskSummary[];
  state: CardState;
  onRetry?: () => void;
  onItemClick?: (category: RiskCategory) => void;
  onViewAll?: () => void;
  height?: number;
}

const categoryConfig: Record<RiskCategory, { icon: string; color: string }> = {
  overdue_contract: { icon: '📅', color: '#f44336' },
  equipment_impact: { icon: '🔧', color: '#ff9800' },
  cert_impact: { icon: '📜', color: '#e91e63' },
  material_shortage: { icon: '📦', color: '#9c27b0' },
  pending_review: { icon: '✍️', color: '#2196f3' },
};

export default function RiskAlertCard({
  data,
  state,
  onRetry,
  onItemClick,
  onViewAll,
  height = 420,
}: RiskAlertCardProps) {
  const [expandedCategory, setExpandedCategory] = useState<RiskCategory | null>(null);

  const toggleExpand = (category: RiskCategory) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const totalAffected = data?.reduce((sum, s) => sum + s.totalAffected, 0) || 0;
  const totalHigh = data?.reduce((sum, s) => sum + s.highCount, 0) || 0;

  return (
    <Card sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              风险与预警
            </Typography>
            {totalHigh > 0 && (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                label={`${totalHigh}高风险`}
                size="small"
                color="error"
                sx={{ height: 22, fontSize: 11 }}
              />
            )}
          </Box>
        }
        action={
          <Button
            size="small"
            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            onClick={onViewAll}
            sx={{ fontSize: 12 }}
          >
            全部
          </Button>
        }
        sx={{ pb: 1 }}
      />

      <CardContent sx={{ flex: 1, overflow: 'auto', pt: 0, px: 2 }}>
        {state === 'loading' && <CardSkeleton variant="list" rows={5} />}
        {state === 'error' && <ErrorState onRetry={onRetry} />}
        {state === 'forbidden' && <ForbiddenState />}
        {state === 'success' && (!data || data.length === 0) && (
          <EmptyState
            title="暂无风险预警"
            description="当前没有需要关注的风险"
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
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: `${config.color}20`,
                          fontSize: 16,
                        }}
                      >
                        {config.icon}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {summary.categoryLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          影响 {summary.totalAffected} 个项目/任务
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {summary.highCount > 0 && (
                        <Chip
                          label={`高${summary.highCount}`}
                          size="small"
                          color="error"
                          sx={{ height: 20, fontSize: 10, minWidth: 36 }}
                        />
                      )}
                      {summary.mediumCount > 0 && (
                        <Chip
                          label={`中${summary.mediumCount}`}
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: 10, minWidth: 36 }}
                        />
                      )}
                      <IconButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  </ListItem>

                  <Collapse in={isExpanded}>
                    <Box sx={{ pl: 6, pr: 1, pb: 1 }}>
                      {summary.items.slice(0, 3).map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            py: 1,
                            px: 1.5,
                            borderRadius: 1,
                            mb: 0.5,
                            bgcolor: item.level === 'high' ? 'error.50' :
                                     item.level === 'medium' ? 'warning.50' : 'grey.100',
                            borderLeft: 3,
                            borderColor: item.level === 'high' ? 'error.main' :
                                         item.level === 'medium' ? 'warning.main' : 'grey.400',
                            '&:hover': { opacity: 0.9, cursor: 'pointer' },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemClick?.(summary.category);
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {item.title}
                            </Typography>
                            <Chip
                              label={item.level === 'high' ? '高' : item.level === 'medium' ? '中' : '低'}
                              size="small"
                              color={item.level === 'high' ? 'error' : item.level === 'medium' ? 'warning' : 'default'}
                              sx={{ height: 16, fontSize: 10 }}
                            />
                          </Box>
                          {item.description && (
                            <Typography variant="caption" color="text.secondary">
                              {item.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            {item.owner && (
                              <Typography variant="caption" color="text.secondary">
                                负责: {item.owner}
                              </Typography>
                            )}
                            {item.affectedCount > 0 && (
                              <Chip
                                label={`影响${item.affectedCount}项`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 16, fontSize: 10 }}
                              />
                            )}
                          </Box>
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
