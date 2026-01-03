import { useState, useEffect, useCallback } from 'react';
import { Box, Grid, Container } from '@mui/material';
import {
  DashboardHeader,
  KpiCard,
  WorkItemCard,
  AlertCard,
  ScheduleCard,
  NoticeCard,
  ProgressCard,
  ResourceGanttCard,
  RiskAlertCard,
} from '../components/dashboard';
import {
  DashboardRole,
  TimeRange,
  PersonalDashboardData,
  LeaderDashboardData,
  CardState,
  KpiItem,
} from '../types/dashboard';
import {
  fetchMockPersonalDashboard,
  fetchMockLeaderDashboard,
} from '../mocks/dashboard';

export default function DashboardPage() {
  // 状态管理
  const [role, setRole] = useState<DashboardRole>('personal');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [customDates, setCustomDates] = useState<{ start?: string; end?: string }>({});

  // 数据状态
  const [personalData, setPersonalData] = useState<PersonalDashboardData | null>(null);
  const [leaderData, setLeaderData] = useState<LeaderDashboardData | null>(null);

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (role === 'personal') {
        const data = await fetchMockPersonalDashboard();
        setPersonalData(data);
      } else {
        const data = await fetchMockLeaderDashboard();
        setLeaderData(data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err : new Error('加载失败'));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 获取当前状态
  const getCardState = (): CardState => {
    if (loading) return 'loading';
    if (error) return 'error';
    return 'success';
  };

  const cardState = getCardState();

  // 个人 Dashboard 渲染
  const renderPersonalDashboard = () => {
    const data = personalData;
    const kpis = data?.kpis || [];

    return (
      <>
        {/* Row1: KPI 卡片 - 96px */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {(loading ? Array(4).fill(null) : kpis.slice(0, 4)).map((kpi, index) => (
            <Grid item xs={12} sm={6} md={3} key={kpi?.id || `kpi-${index}`}>
              <KpiCard
                data={kpi as KpiItem | undefined}
                state={cardState}
                onRetry={loadData}
                onClick={() => console.log('KPI clicked:', kpi)}
              />
            </Grid>
          ))}
        </Grid>

        {/* Row2: 待办 + 预警 - 420px */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <WorkItemCard
              data={data?.workItems}
              state={cardState}
              onRetry={loadData}
              onItemClick={(item) => console.log('Work item clicked:', item)}
              onViewAll={() => console.log('View all work items')}
              height={420}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <AlertCard
              data={data?.alerts}
              state={cardState}
              onRetry={loadData}
              onItemClick={(category) => console.log('Alert category clicked:', category)}
              onViewAll={() => console.log('View all alerts')}
              onSettings={() => console.log('Open alert settings')}
              height={420}
            />
          </Grid>
        </Grid>

        {/* Row3: 日程 + 公告 - 320px */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <ScheduleCard
              data={data?.schedules}
              state={cardState}
              onRetry={loadData}
              onItemClick={(item) => console.log('Schedule clicked:', item)}
              onViewAll={() => console.log('View all schedules')}
              height={320}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <NoticeCard
              data={data?.notices}
              state={cardState}
              onRetry={loadData}
              onItemClick={(item) => console.log('Notice clicked:', item)}
              onViewAll={() => console.log('View all notices')}
              onMarkAllRead={() => console.log('Mark all as read')}
              height={320}
            />
          </Grid>
        </Grid>

        {/* Row4: 进度 - 260px */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ProgressCard
              data={data?.projectProgress}
              state={cardState}
              onRetry={loadData}
              onItemClick={(item) => console.log('Progress clicked:', item)}
              onViewAll={() => console.log('View all progress')}
              height={260}
              variant="list"
            />
          </Grid>
        </Grid>
      </>
    );
  };

  // 领导 Dashboard 渲染
  const renderLeaderDashboard = () => {
    const data = leaderData;
    const kpis = data?.kpis || [];

    return (
      <>
        {/* Row1: KPI 卡片 - 96px (6张) */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {(loading ? Array(6).fill(null) : kpis.slice(0, 6)).map((kpi, index) => (
            <Grid item xs={6} sm={4} md={2} key={kpi?.id || `kpi-${index}`}>
              <KpiCard
                data={kpi as KpiItem | undefined}
                state={cardState}
                onRetry={loadData}
                onClick={() => console.log('KPI clicked:', kpi)}
              />
            </Grid>
          ))}
        </Grid>

        {/* Row2: 项目总览 - 460px */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <ProgressCard
              data={data?.projectOverview}
              state={cardState}
              onRetry={loadData}
              onItemClick={(item) => console.log('Project clicked:', item)}
              onViewAll={() => console.log('View all projects')}
              onUrge={(item) => console.log('Urge project:', item)}
              height={460}
              variant="table"
            />
          </Grid>
        </Grid>

        {/* Row3: 资源排布 + 风险预警 - 420px */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <ResourceGanttCard
              data={data?.resources}
              state={cardState}
              onRetry={loadData}
              onResourceClick={(resource) => console.log('Resource clicked:', resource)}
              onAssignmentClick={(assignment) => console.log('Assignment clicked:', assignment)}
              onViewAll={() => console.log('View all resources')}
              height={420}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <RiskAlertCard
              data={data?.risks}
              state={cardState}
              onRetry={loadData}
              onItemClick={(category) => console.log('Risk category clicked:', category)}
              onViewAll={() => console.log('View all risks')}
              height={420}
            />
          </Grid>
        </Grid>
      </>
    );
  };

  return (
    <Box className="animate-fade-in" sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header - 56px */}
      <DashboardHeader
        role={role}
        onRoleChange={setRole}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        customDates={customDates}
        onCustomDatesChange={setCustomDates}
        onRefresh={loadData}
        unreadCount={3}
        loading={loading}
      />

      {/* 主内容区 */}
      <Container maxWidth="xl" sx={{ py: 2 }}>
        {role === 'personal' ? renderPersonalDashboard() : renderLeaderDashboard()}
      </Container>
    </Box>
  );
}
