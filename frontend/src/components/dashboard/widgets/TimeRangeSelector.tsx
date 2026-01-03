import { useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  Box,
  Popover,
  Button,
  TextField,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { TimeRange } from '../../../types/dashboard';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  customDates?: { start?: string; end?: string };
  onCustomDatesChange?: (dates: { start?: string; end?: string }) => void;
  disabled?: boolean;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季度' },
  { value: 'year', label: '本年' },
  { value: 'custom', label: '自定义' },
];

export default function TimeRangeSelector({
  value,
  onChange,
  customDates,
  onCustomDatesChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tempDates, setTempDates] = useState({
    start: customDates?.start || '',
    end: customDates?.end || '',
  });

  const handleChange = (newValue: TimeRange) => {
    if (newValue === 'custom') {
      // 打开日期选择器
      // 这里简化处理，直接切换
      onChange(newValue);
    } else {
      onChange(newValue);
    }
  };

  const handleCustomClick = (event: React.MouseEvent<HTMLElement>) => {
    if (value === 'custom') {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    onCustomDatesChange?.(tempDates);
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
      <FormControl size="small" disabled={disabled}>
        <Select
          value={value}
          onChange={(e) => handleChange(e.target.value as TimeRange)}
          onClick={handleCustomClick}
          sx={{
            minWidth: 100,
            '& .MuiSelect-select': {
              py: 0.75,
              fontSize: 14,
            },
          }}
        >
          {timeRangeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="开始日期"
            type="date"
            size="small"
            value={tempDates.start}
            onChange={(e) =>
              setTempDates((prev) => ({ ...prev, start: e.target.value }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="结束日期"
            type="date"
            size="small"
            value={tempDates.end}
            onChange={(e) =>
              setTempDates((prev) => ({ ...prev, end: e.target.value }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={handleClose}>
              取消
            </Button>
            <Button size="small" variant="contained" onClick={handleApply}>
              确定
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
