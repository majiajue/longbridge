import { Box, Typography, IconButton, Badge, Avatar, Menu, MenuItem, Button, Divider } from '@mui/material';
import { useState } from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import { DashboardRole, TimeRange } from '../../../types/dashboard';
import { RoleSwitcher, TimeRangeSelector } from '../widgets';

interface DashboardHeaderProps {
  role: DashboardRole;
  onRoleChange: (role: DashboardRole) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  customDates?: { start?: string; end?: string };
  onCustomDatesChange?: (dates: { start?: string; end?: string }) => void;
  onRefresh?: () => void;
  unreadCount?: number;
  showLeaderView?: boolean;
  loading?: boolean;
}

const quickAddOptions = [
  { label: '新建委托', icon: '📝' },
  { label: '新建采样', icon: '🧪' },
  { label: '新建检测', icon: '🔬' },
  { label: '新建审批', icon: '✅' },
];

export default function DashboardHeader({
  role,
  onRoleChange,
  timeRange,
  onTimeRangeChange,
  customDates,
  onCustomDatesChange,
  onRefresh,
  unreadCount = 0,
  showLeaderView = true,
  loading = false,
}: DashboardHeaderProps) {
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <Box
      sx={{
        height: 56,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        position: 'sticky',
        top: 0,
        zIndex: 1100,
      }}
    >
      {/* 左侧：Logo + 面包屑 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'primary.main',
          }}
        >
          <HomeIcon />
          <Typography variant="h6" fontWeight="bold">
            工作台
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          /
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {role === 'personal' ? '个人中心' : '管理概览'}
        </Typography>
      </Box>

      {/* 中间：角色切换 + 时间范围 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <RoleSwitcher
          value={role}
          onChange={onRoleChange}
          showLeaderView={showLeaderView}
        />
        <Divider orientation="vertical" flexItem />
        <TimeRangeSelector
          value={timeRange}
          onChange={onTimeRangeChange}
          customDates={customDates}
          onCustomDatesChange={onCustomDatesChange}
        />
      </Box>

      {/* 右侧：快捷操作 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* 刷新按钮 */}
        <IconButton
          size="small"
          onClick={onRefresh}
          disabled={loading}
          sx={{
            animation: loading ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        >
          <RefreshIcon />
        </IconButton>

        {/* 快捷新建 */}
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={(e) => setAddMenuAnchor(e.currentTarget)}
          sx={{ px: 2 }}
        >
          新建
        </Button>
        <Menu
          anchorEl={addMenuAnchor}
          open={Boolean(addMenuAnchor)}
          onClose={() => setAddMenuAnchor(null)}
        >
          {quickAddOptions.map((option) => (
            <MenuItem
              key={option.label}
              onClick={() => setAddMenuAnchor(null)}
            >
              <span style={{ marginRight: 8 }}>{option.icon}</span>
              {option.label}
            </MenuItem>
          ))}
        </Menu>

        {/* 通知 */}
        <IconButton size="small">
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>

        {/* 用户头像 */}
        <IconButton
          size="small"
          onClick={(e) => setProfileMenuAnchor(e.currentTarget)}
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            U
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={profileMenuAnchor}
          open={Boolean(profileMenuAnchor)}
          onClose={() => setProfileMenuAnchor(null)}
        >
          <MenuItem onClick={() => setProfileMenuAnchor(null)}>
            个人设置
          </MenuItem>
          <MenuItem onClick={() => setProfileMenuAnchor(null)}>
            帮助中心
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => setProfileMenuAnchor(null)}>
            退出登录
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
