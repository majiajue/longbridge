import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Link,
  Chip,
  Stack,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { APIError } from '../api/client';

interface ErrorDialogProps {
  open: boolean;
  error: Error | APIError | null;
  onClose: () => void;
  title?: string;
}

export default function ErrorDialog({ open, error, onClose, title = '操作失败' }: ErrorDialogProps) {
  if (!error) return null;

  const isAPIError = error instanceof APIError;
  const apiError = isAPIError ? error : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <ErrorOutlineIcon color="error" />
          <Typography variant="h6">{title}</Typography>
          {apiError?.errorCode && (
            <Chip label={`错误代码: ${apiError.errorCode}`} size="small" color="error" variant="outlined" />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent>
        {/* 主要错误信息 */}
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body1" fontWeight="bold">
            {error.message}
          </Typography>
        </Alert>

        {/* 解决方案 */}
        {apiError?.solution && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <HelpOutlineIcon color="primary" />
              <Typography variant="subtitle1" fontWeight="bold">
                解决方案
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {apiError.solution}
            </Typography>
          </Box>
        )}

        {/* 操作步骤 */}
        {apiError?.steps && apiError.steps.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              操作步骤：
            </Typography>
            <List dense>
              {apiError.steps.map((step, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemText
                    primary={step}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* 平台链接 */}
        {apiError?.platformUrl && (
          <Box sx={{ mb: 2 }}>
            <Link
              href={apiError.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Typography variant="body2">打开 Longbridge 开放平台</Typography>
              <LaunchIcon fontSize="small" />
            </Link>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* 技术详情 */}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" gutterBottom>
            技术详情（可复制给技术支持）:
          </Typography>
          <Box
            sx={{
              bgcolor: 'grey.100',
              p: 1.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              position: 'relative',
              maxHeight: 200,
              overflow: 'auto'
            }}
          >
            <Button
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={() => copyToClipboard(apiError?.rawError || error.message)}
              sx={{ position: 'absolute', top: 8, right: 8 }}
            >
              复制
            </Button>
            <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {apiError?.rawError || error.message}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          知道了
        </Button>
      </DialogActions>
    </Dialog>
  );
}

