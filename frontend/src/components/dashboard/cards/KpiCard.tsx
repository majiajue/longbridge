import { Box, Card, CardContent, Typography, CardActionArea } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { KpiItem, CardState } from '../../../types/dashboard';
import { CardSkeleton, ErrorState } from '../states';

interface KpiCardProps {
  data?: KpiItem;
  state: CardState;
  onRetry?: () => void;
  onClick?: () => void;
}

const colorMap: Record<string, { bg: string; text: string }> = {
  primary: { bg: 'primary.50', text: 'primary.main' },
  success: { bg: 'success.light', text: 'success.dark' },
  warning: { bg: 'warning.light', text: 'warning.dark' },
  error: { bg: 'error.light', text: 'error.dark' },
  info: { bg: 'info.light', text: 'info.dark' },
};

export default function KpiCard({ data, state, onRetry, onClick }: KpiCardProps) {
  if (state === 'loading') {
    return (
      <Card sx={{ height: 96 }}>
        <CardSkeleton variant="kpi" />
      </Card>
    );
  }

  if (state === 'error') {
    return (
      <Card sx={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorState message="加载失败" onRetry={onRetry} height={96} />
      </Card>
    );
  }

  if (!data) return null;

  const colors = colorMap[data.color || 'primary'];
  const TrendIcon =
    data.trend === 'up'
      ? TrendingUpIcon
      : data.trend === 'down'
      ? TrendingDownIcon
      : TrendingFlatIcon;
  const trendColor =
    data.trend === 'up'
      ? 'success.main'
      : data.trend === 'down'
      ? 'error.main'
      : 'text.secondary';

  const content = (
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          height: '100%',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
            {data.label}
          </Typography>
          <Box>
            <Typography
              variant="h4"
              fontWeight="bold"
              sx={{ color: colors.text, lineHeight: 1.2 }}
            >
              {data.value}
              {data.unit && (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ ml: 0.5, fontWeight: 'normal' }}
                >
                  {data.unit}
                </Typography>
              )}
            </Typography>
            {data.trend && data.trendValue !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <TrendIcon sx={{ fontSize: 14, color: trendColor, mr: 0.5 }} />
                <Typography variant="caption" sx={{ color: trendColor, fontSize: 11 }}>
                  {data.trend === 'up' ? '+' : ''}
                  {data.trendValue}%
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, fontSize: 11 }}>
                  较上期
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        {data.icon && (
          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: colors.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.9,
            }}
          >
            <span style={{ fontSize: 22 }}>{data.icon}</span>
          </Box>
        )}
      </Box>
    </CardContent>
  );

  return (
    <Card
      sx={{
        height: 96,
        transition: 'all 0.2s',
        '&:hover': data.clickable
          ? {
              boxShadow: 4,
              transform: 'translateY(-2px)',
            }
          : {},
      }}
    >
      {data.clickable ? (
        <CardActionArea sx={{ height: '100%' }} onClick={onClick}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}
