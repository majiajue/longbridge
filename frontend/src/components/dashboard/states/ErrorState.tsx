import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  height?: number | string;
}

export default function ErrorState({
  message = '加载失败，请稍后重试',
  onRetry,
  height,
}: ErrorStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        px: 2,
        height: height || 'auto',
        textAlign: 'center',
      }}
    >
      <ErrorOutlineIcon
        sx={{ fontSize: 48, color: 'error.main', mb: 2, opacity: 0.8 }}
      />
      <Typography
        variant="body1"
        color="error.main"
        gutterBottom
        sx={{ maxWidth: 280 }}
      >
        {message}
      </Typography>
      {onRetry && (
        <Button
          variant="contained"
          color="error"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          sx={{ mt: 2 }}
        >
          重试
        </Button>
      )}
    </Box>
  );
}
