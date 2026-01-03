import { Box, Skeleton } from '@mui/material';

interface CardSkeletonProps {
  variant?: 'kpi' | 'list' | 'table' | 'chart' | 'gantt';
  height?: number | string;
  rows?: number;
}

export default function CardSkeleton({
  variant = 'list',
  height = 200,
  rows = 5,
}: CardSkeletonProps) {
  if (variant === 'kpi') {
    return (
      <Box sx={{ p: 2, height: '100%' }}>
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="60%" height={40} sx={{ mt: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width="30%" height={16} />
        </Box>
      </Box>
    );
  }

  if (variant === 'list') {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 2,
              '&:last-child': { mb: 0 },
            }}
          >
            <Skeleton
              variant="circular"
              width={36}
              height={36}
              sx={{ mr: 2, flexShrink: 0 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="50%" height={16} />
            </Box>
            <Skeleton
              variant="rounded"
              width={60}
              height={24}
              sx={{ ml: 2, flexShrink: 0 }}
            />
          </Box>
        ))}
      </Box>
    );
  }

  if (variant === 'table') {
    return (
      <Box sx={{ p: 2 }}>
        {/* 表头 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="text" width={`${100 / 5}%`} height={32} />
          ))}
        </Box>
        {/* 表格行 */}
        {Array.from({ length: rows }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, mb: 0.5 }}>
            {[1, 2, 3, 4, 5].map((j) => (
              <Skeleton
                key={j}
                variant="rectangular"
                sx={{ width: `${100 / 5}%`, height: 40 }}
              />
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  if (variant === 'chart') {
    return (
      <Box sx={{ p: 2, height }}>
        <Skeleton variant="text" width="30%" height={24} sx={{ mb: 2 }} />
        <Skeleton
          variant="rectangular"
          sx={{ height: `calc(100% - 40px)`, borderRadius: 1 }}
        />
      </Box>
    );
  }

  if (variant === 'gantt') {
    return (
      <Box sx={{ p: 2, height, display: 'flex', gap: 2 }}>
        {/* 左侧资源列表 */}
        <Box sx={{ width: 160, flexShrink: 0 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} sx={{ mb: 1.5 }}>
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="50%" height={14} />
            </Box>
          ))}
        </Box>
        {/* 右侧甘特图区域 */}
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
        </Box>
      </Box>
    );
  }

  return <Skeleton variant="rectangular" height={height} />;
}
