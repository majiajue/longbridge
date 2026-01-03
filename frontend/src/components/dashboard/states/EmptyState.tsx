import { Box, Typography, Button } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  height?: number | string;
}

export default function EmptyState({
  title = '暂无数据',
  description = '当前没有可显示的内容',
  actionText,
  onAction,
  icon,
  height,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
        height: height || 'auto',
        textAlign: 'center',
        color: 'text.secondary',
      }}
    >
      <Box
        sx={{
          mb: 2,
          opacity: 0.5,
          '& > svg': { fontSize: 64 },
        }}
      >
        {icon || <InboxIcon sx={{ fontSize: 64 }} />}
      </Box>
      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, maxWidth: 280 }}
      >
        {description}
      </Typography>
      {actionText && onAction && (
        <Button
          variant="outlined"
          size="small"
          onClick={onAction}
          sx={{ mt: 1 }}
        >
          {actionText}
        </Button>
      )}
    </Box>
  );
}
