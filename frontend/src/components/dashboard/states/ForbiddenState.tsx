import { Box, Typography, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';

interface ForbiddenStateProps {
  message?: string;
  contactText?: string;
  onContact?: () => void;
  height?: number | string;
}

export default function ForbiddenState({
  message = '您没有权限查看此内容',
  contactText = '联系管理员',
  onContact,
  height,
}: ForbiddenStateProps) {
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
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      <LockIcon
        sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }}
      />
      <Typography
        variant="body1"
        color="text.secondary"
        gutterBottom
        sx={{ maxWidth: 280 }}
      >
        {message}
      </Typography>
      {onContact && (
        <Button
          variant="text"
          size="small"
          startIcon={<ContactSupportIcon />}
          onClick={onContact}
          sx={{ mt: 1, color: 'primary.main' }}
        >
          {contactText}
        </Button>
      )}
    </Box>
  );
}
