import { ToggleButton, ToggleButtonGroup, Box, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { DashboardRole } from '../../../types/dashboard';

interface RoleSwitcherProps {
  value: DashboardRole;
  onChange: (role: DashboardRole) => void;
  disabled?: boolean;
  showLeaderView?: boolean;
}

export default function RoleSwitcher({
  value,
  onChange,
  disabled = false,
  showLeaderView = true,
}: RoleSwitcherProps) {
  const handleChange = (
    _: React.MouseEvent<HTMLElement>,
    newRole: DashboardRole | null
  ) => {
    if (newRole !== null) {
      onChange(newRole);
    }
  };

  if (!showLeaderView) {
    return null;
  }

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      size="small"
      disabled={disabled}
      sx={{
        bgcolor: 'background.paper',
        '& .MuiToggleButton-root': {
          px: 2,
          py: 0.5,
          border: '1px solid',
          borderColor: 'divider',
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          },
        },
      }}
    >
      <ToggleButton value="personal">
        <PersonIcon sx={{ fontSize: 18, mr: 0.5 }} />
        <Typography variant="body2">个人视角</Typography>
      </ToggleButton>
      <ToggleButton value="leader">
        <SupervisorAccountIcon sx={{ fontSize: 18, mr: 0.5 }} />
        <Typography variant="body2">领导视角</Typography>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
