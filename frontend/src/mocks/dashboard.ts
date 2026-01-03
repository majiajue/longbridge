import {
  KpiItem,
  WorkItem,
  WorkItemListResponse,
  AlertSummary,
  ScheduleItem,
  NoticeItem,
  ProjectProgress,
  ResourceItem,
  RiskSummary,
  PersonalDashboardData,
  LeaderDashboardData,
} from '../types/dashboard';

// ==================== 模拟延迟 ====================

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== 个人视角 KPI ====================

export const personalKpis: KpiItem[] = [
  {
    id: 'kpi-1',
    label: '我的待办',
    value: 12,
    unit: '项',
    trend: 'up',
    trendValue: 20,
    icon: '📋',
    color: 'primary',
    clickable: true,
  },
  {
    id: 'kpi-2',
    label: '预警提醒',
    value: 5,
    unit: '条',
    trend: 'down',
    trendValue: 15,
    icon: '⚠️',
    color: 'warning',
    clickable: true,
  },
  {
    id: 'kpi-3',
    label: '进行中项目',
    value: 8,
    unit: '个',
    trend: 'flat',
    trendValue: 0,
    icon: '🔄',
    color: 'info',
    clickable: true,
  },
  {
    id: 'kpi-4',
    label: '未读消息',
    value: 3,
    unit: '条',
    trend: 'up',
    trendValue: 50,
    icon: '📬',
    color: 'error',
    clickable: true,
  },
];

// ==================== 领导视角 KPI ====================

export const leaderKpis: KpiItem[] = [
  {
    id: 'lkpi-1',
    label: '本月合同',
    value: 45,
    unit: '个',
    trend: 'up',
    trendValue: 12,
    icon: '📝',
    color: 'primary',
    clickable: true,
  },
  {
    id: 'lkpi-2',
    label: '进行中项目',
    value: 28,
    unit: '个',
    trend: 'up',
    trendValue: 8,
    icon: '🔄',
    color: 'info',
    clickable: true,
  },
  {
    id: 'lkpi-3',
    label: '逾期风险',
    value: 3,
    unit: '项',
    trend: 'down',
    trendValue: 25,
    icon: '⏰',
    color: 'error',
    clickable: true,
  },
  {
    id: 'lkpi-4',
    label: '人员利用率',
    value: '85%',
    trend: 'up',
    trendValue: 5,
    icon: '👥',
    color: 'success',
    clickable: true,
  },
  {
    id: 'lkpi-5',
    label: '设备利用率',
    value: '72%',
    trend: 'down',
    trendValue: 3,
    icon: '🔬',
    color: 'warning',
    clickable: true,
  },
  {
    id: 'lkpi-6',
    label: '本月营收',
    value: '¥128万',
    trend: 'up',
    trendValue: 18,
    icon: '💰',
    color: 'success',
    clickable: true,
  },
];

// ==================== 待办事项 ====================

export const workItems: WorkItem[] = [
  {
    id: 'wi-1',
    title: '水质检测样品采集 - 项目A',
    description: '需要在今天完成采样并送回实验室',
    type: 'sampling',
    priority: 'urgent',
    status: 'pending',
    dueDate: '2024-12-29T18:00:00',
    projectId: 'proj-1',
    projectName: '某市饮用水检测项目',
    node: '样品采集',
    createdAt: '2024-12-28T09:00:00',
    updatedAt: '2024-12-28T09:00:00',
  },
  {
    id: 'wi-2',
    title: '土壤重金属检测报告审批',
    description: '等待主任签发',
    type: 'approval',
    priority: 'high',
    status: 'pending',
    dueDate: '2024-12-30T12:00:00',
    projectId: 'proj-2',
    projectName: '工业园区土壤污染调查',
    node: '报告审批',
    createdAt: '2024-12-27T14:00:00',
    updatedAt: '2024-12-28T10:00:00',
  },
  {
    id: 'wi-3',
    title: '空气质量检测数据复核',
    description: 'VOC检测结果需要复核确认',
    type: 'review',
    priority: 'normal',
    status: 'in_progress',
    dueDate: '2024-12-31T17:00:00',
    projectId: 'proj-3',
    projectName: '化工厂环境监测',
    node: '数据复核',
    createdAt: '2024-12-26T11:00:00',
    updatedAt: '2024-12-28T15:00:00',
  },
  {
    id: 'wi-4',
    title: '微生物检测任务 - 批次#2024122801',
    description: '食品样品微生物培养观察',
    type: 'testing',
    priority: 'normal',
    status: 'in_progress',
    dueDate: '2025-01-02T17:00:00',
    projectId: 'proj-4',
    projectName: '食品安全抽检',
    node: '检测中',
    createdAt: '2024-12-25T09:00:00',
    updatedAt: '2024-12-28T08:00:00',
  },
  {
    id: 'wi-5',
    title: '噪声检测现场采样',
    description: '工厂边界噪声监测',
    type: 'sampling',
    priority: 'low',
    status: 'pending',
    dueDate: '2025-01-03T12:00:00',
    projectId: 'proj-5',
    projectName: '工厂噪声达标验收',
    node: '待采样',
    createdAt: '2024-12-27T16:00:00',
    updatedAt: '2024-12-27T16:00:00',
  },
  {
    id: 'wi-6',
    title: '废水检测报告签发',
    description: '已完成审核，等待最终签发',
    type: 'review',
    priority: 'high',
    status: 'pending',
    dueDate: '2024-12-29T17:00:00',
    projectId: 'proj-6',
    projectName: '污水处理厂排放监测',
    node: '待签发',
    createdAt: '2024-12-26T10:00:00',
    updatedAt: '2024-12-28T14:00:00',
  },
];

export const workItemsResponse: WorkItemListResponse = {
  items: workItems,
  total: 12,
  pageSize: 10,
  currentPage: 1,
};

// ==================== 预警提醒 ====================

export const alertSummaries: AlertSummary[] = [
  {
    category: 'inventory_low',
    categoryLabel: '库存不足',
    count: 3,
    criticalCount: 1,
    warningCount: 2,
    items: [
      {
        id: 'alert-1',
        title: 'pH标准溶液库存不足',
        message: '当前库存: 5瓶，低于安全库存(10瓶)',
        level: 'critical',
        category: 'inventory_low',
        timestamp: '2024-12-28T08:00:00',
        isRead: false,
      },
      {
        id: 'alert-2',
        title: '无菌采样袋库存预警',
        message: '当前库存: 50个，建议补充',
        level: 'warning',
        category: 'inventory_low',
        timestamp: '2024-12-28T09:00:00',
        isRead: false,
      },
    ],
  },
  {
    category: 'expiring',
    categoryLabel: '临期预警',
    count: 2,
    criticalCount: 0,
    warningCount: 2,
    items: [
      {
        id: 'alert-3',
        title: '甲醇试剂即将过期',
        message: '有效期至: 2025-01-15，剩余17天',
        level: 'warning',
        category: 'expiring',
        timestamp: '2024-12-28T10:00:00',
        isRead: false,
      },
    ],
  },
  {
    category: 'cert_expiring',
    categoryLabel: '证书到期',
    count: 1,
    criticalCount: 1,
    warningCount: 0,
    items: [
      {
        id: 'alert-4',
        title: '张工检测资质证书即将到期',
        message: '有效期至: 2025-01-20，请尽快安排复审',
        level: 'critical',
        category: 'cert_expiring',
        timestamp: '2024-12-28T07:00:00',
        isRead: false,
      },
    ],
  },
  {
    category: 'maintenance_due',
    categoryLabel: '维保到期',
    count: 2,
    criticalCount: 1,
    warningCount: 1,
    items: [
      {
        id: 'alert-5',
        title: 'GC-MS质谱仪需要维保',
        message: '已超期5天未维护',
        level: 'critical',
        category: 'maintenance_due',
        timestamp: '2024-12-23T09:00:00',
        isRead: true,
      },
    ],
  },
  {
    category: 'task_overdue',
    categoryLabel: '任务逾期',
    count: 1,
    criticalCount: 1,
    warningCount: 0,
    items: [
      {
        id: 'alert-6',
        title: '项目B检测报告逾期未提交',
        message: '原定截止日期: 2024-12-27',
        level: 'critical',
        category: 'task_overdue',
        projectId: 'proj-7',
        projectName: '建材放射性检测',
        timestamp: '2024-12-27T18:00:00',
        isRead: false,
      },
    ],
  },
];

// ==================== 日程安排 ====================

export const schedules: ScheduleItem[] = [
  {
    id: 'sch-1',
    title: '项目启动会议',
    type: 'meeting',
    status: 'upcoming',
    startTime: '2024-12-29T09:00:00',
    endTime: '2024-12-29T10:30:00',
    location: '会议室A',
    participants: ['张工', '李工', '王主任'],
    description: '新项目启动讨论',
  },
  {
    id: 'sch-2',
    title: '现场采样 - 某化工厂',
    type: 'task',
    status: 'upcoming',
    startTime: '2024-12-29T14:00:00',
    endTime: '2024-12-29T17:00:00',
    location: '某化工厂',
    description: '废气排放口采样',
  },
  {
    id: 'sch-3',
    title: '设备校准',
    type: 'task',
    status: 'in_progress',
    startTime: '2024-12-29T08:00:00',
    endTime: '2024-12-29T12:00:00',
    description: '分析天平年度校准',
  },
  {
    id: 'sch-4',
    title: '客户报告交付截止',
    type: 'deadline',
    status: 'upcoming',
    startTime: '2024-12-30T17:00:00',
    description: '某市饮用水检测报告',
    color: '#f44336',
  },
  {
    id: 'sch-5',
    title: '部门周会',
    type: 'meeting',
    status: 'upcoming',
    startTime: '2024-12-30T09:00:00',
    endTime: '2024-12-30T10:00:00',
    location: '线上',
    participants: ['全体检测部'],
  },
  {
    id: 'sch-6',
    title: '里程碑: Q4项目结项',
    type: 'milestone',
    status: 'upcoming',
    startTime: '2024-12-31T17:00:00',
    description: '完成本季度所有项目交付',
    color: '#4caf50',
  },
];

// ==================== 通知公告 ====================

export const notices: NoticeItem[] = [
  {
    id: 'notice-1',
    title: '关于2025年元旦放假安排的通知',
    content: '根据国务院办公厅通知，2025年元旦放假安排如下...',
    type: 'announcement',
    publishTime: '2024-12-28T10:00:00',
    publisher: '行政部',
    isTop: true,
    isRead: false,
  },
  {
    id: 'notice-2',
    title: '实验室安全检查通知',
    content: '定于下周一进行年度安全大检查，请各实验室做好准备...',
    type: 'announcement',
    publishTime: '2024-12-27T14:00:00',
    publisher: '安全管理部',
    isTop: false,
    isRead: false,
  },
  {
    id: 'notice-3',
    title: '新版检测标准培训通知',
    content: 'GB/T XXX-2024标准将于2025年1月1日实施...',
    type: 'policy',
    publishTime: '2024-12-26T09:00:00',
    publisher: '技术部',
    isTop: false,
    isRead: true,
  },
  {
    id: 'notice-4',
    title: '系统维护公告',
    content: '检测管理系统将于今晚22:00-24:00进行升级维护...',
    type: 'system',
    publishTime: '2024-12-25T16:00:00',
    publisher: 'IT部',
    isTop: false,
    isRead: true,
  },
  {
    id: 'notice-5',
    title: '公司获得新资质证书',
    content: '恭喜公司顺利通过CMA扩项评审，新增10项检测能力...',
    type: 'news',
    publishTime: '2024-12-24T11:00:00',
    publisher: '质量部',
    isTop: false,
    isRead: true,
  },
];

// ==================== 项目进度 ====================

export const projectProgressList: ProjectProgress[] = [
  {
    id: 'proj-1',
    name: '某市饮用水检测项目',
    code: 'WQ-2024-001',
    client: '某市自来水公司',
    status: 'in_progress',
    progress: 75,
    startDate: '2024-12-01',
    endDate: '2024-12-30',
    manager: '张工',
    riskLevel: 'low',
    steps: [
      { id: 's1', name: '合同签订', status: 'completed', completedAt: '2024-12-01' },
      { id: 's2', name: '样品采集', status: 'completed', completedAt: '2024-12-15' },
      { id: 's3', name: '检测分析', status: 'current' },
      { id: 's4', name: '报告编制', status: 'pending' },
      { id: 's5', name: '报告审核', status: 'pending' },
      { id: 's6', name: '交付归档', status: 'pending' },
    ],
  },
  {
    id: 'proj-2',
    name: '工业园区土壤污染调查',
    code: 'SO-2024-015',
    client: '某工业园区管委会',
    status: 'delayed',
    progress: 40,
    startDate: '2024-11-15',
    endDate: '2024-12-25',
    expectedEndDate: '2025-01-05',
    delayDays: 11,
    manager: '李工',
    riskLevel: 'high',
    steps: [
      { id: 's1', name: '合同签订', status: 'completed' },
      { id: 's2', name: '现场踏勘', status: 'completed' },
      { id: 's3', name: '样品采集', status: 'current' },
      { id: 's4', name: '检测分析', status: 'pending' },
      { id: 's5', name: '报告编制', status: 'pending' },
    ],
  },
  {
    id: 'proj-3',
    name: '化工厂环境监测',
    code: 'EM-2024-088',
    client: '某化工有限公司',
    status: 'in_progress',
    progress: 60,
    startDate: '2024-12-10',
    endDate: '2025-01-10',
    manager: '王工',
    riskLevel: 'medium',
    steps: [
      { id: 's1', name: '合同签订', status: 'completed' },
      { id: 's2', name: '方案编制', status: 'completed' },
      { id: 's3', name: '现场监测', status: 'current' },
      { id: 's4', name: '数据处理', status: 'pending' },
      { id: 's5', name: '报告编制', status: 'pending' },
    ],
  },
  {
    id: 'proj-4',
    name: '食品安全抽检',
    code: 'FD-2024-102',
    client: '市场监督管理局',
    status: 'in_progress',
    progress: 30,
    startDate: '2024-12-20',
    endDate: '2025-01-20',
    manager: '赵工',
    riskLevel: 'low',
  },
  {
    id: 'proj-5',
    name: '建材放射性检测',
    code: 'RA-2024-033',
    client: '某建材公司',
    status: 'completed',
    progress: 100,
    startDate: '2024-12-01',
    endDate: '2024-12-20',
    manager: '陈工',
    riskLevel: 'low',
  },
];

// ==================== 资源排布 (甘特图) ====================

const today = new Date();
const formatDate = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

export const resources: ResourceItem[] = [
  {
    id: 'res-1',
    name: '张工',
    type: 'person',
    role: '高级检测员',
    department: '水质检测室',
    assignments: [
      {
        id: 'asg-1',
        projectId: 'proj-1',
        projectName: '饮用水检测',
        projectCode: 'WQ-001',
        startDate: formatDate(-3),
        endDate: formatDate(2),
        allocation: 60,
        color: '#2196f3',
      },
      {
        id: 'asg-2',
        projectId: 'proj-3',
        projectName: '环境监测',
        projectCode: 'EM-088',
        startDate: formatDate(1),
        endDate: formatDate(5),
        allocation: 40,
        color: '#4caf50',
        hasConflict: true,
      },
    ],
  },
  {
    id: 'res-2',
    name: '李工',
    type: 'person',
    role: '检测员',
    department: '土壤检测室',
    assignments: [
      {
        id: 'asg-3',
        projectId: 'proj-2',
        projectName: '土壤调查',
        projectCode: 'SO-015',
        startDate: formatDate(-5),
        endDate: formatDate(7),
        allocation: 100,
        color: '#ff9800',
      },
    ],
  },
  {
    id: 'res-3',
    name: '王工',
    type: 'person',
    role: '高级检测员',
    department: '大气检测室',
    assignments: [
      {
        id: 'asg-4',
        projectId: 'proj-3',
        projectName: '环境监测',
        projectCode: 'EM-088',
        startDate: formatDate(0),
        endDate: formatDate(10),
        allocation: 80,
        color: '#4caf50',
      },
    ],
  },
  {
    id: 'res-4',
    name: 'GC-MS 质谱仪',
    type: 'equipment',
    role: '大型仪器',
    department: '仪器室',
    assignments: [
      {
        id: 'asg-5',
        projectId: 'proj-1',
        projectName: '饮用水检测',
        projectCode: 'WQ-001',
        startDate: formatDate(-2),
        endDate: formatDate(1),
        allocation: 100,
        color: '#2196f3',
      },
      {
        id: 'asg-6',
        projectId: 'proj-3',
        projectName: '环境监测',
        projectCode: 'EM-088',
        startDate: formatDate(2),
        endDate: formatDate(6),
        allocation: 100,
        color: '#4caf50',
      },
    ],
  },
  {
    id: 'res-5',
    name: 'ICP-OES 光谱仪',
    type: 'equipment',
    role: '大型仪器',
    department: '仪器室',
    assignments: [
      {
        id: 'asg-7',
        projectId: 'proj-2',
        projectName: '土壤调查',
        projectCode: 'SO-015',
        startDate: formatDate(-3),
        endDate: formatDate(4),
        allocation: 100,
        color: '#ff9800',
      },
    ],
  },
  {
    id: 'res-6',
    name: '赵工',
    type: 'person',
    role: '检测员',
    department: '食品检测室',
    assignments: [
      {
        id: 'asg-8',
        projectId: 'proj-4',
        projectName: '食品抽检',
        projectCode: 'FD-102',
        startDate: formatDate(-1),
        endDate: formatDate(15),
        allocation: 100,
        color: '#9c27b0',
      },
    ],
  },
];

// ==================== 风险预警 ====================

export const riskSummaries: RiskSummary[] = [
  {
    category: 'overdue_contract',
    categoryLabel: '逾期/将逾期合同',
    totalAffected: 3,
    highCount: 1,
    mediumCount: 2,
    items: [
      {
        id: 'risk-1',
        title: '土壤污染调查项目逾期',
        description: '原定12月25日交付，目前预计延期11天',
        category: 'overdue_contract',
        level: 'high',
        status: 'open',
        affectedCount: 1,
        projectId: 'proj-2',
        projectName: '工业园区土壤污染调查',
        owner: '李工',
        identifiedDate: '2024-12-25',
        dueDate: '2025-01-05',
      },
      {
        id: 'risk-2',
        title: '饮用水检测项目风险',
        description: '检测进度较紧，存在延期风险',
        category: 'overdue_contract',
        level: 'medium',
        status: 'mitigating',
        affectedCount: 1,
        projectId: 'proj-1',
        projectName: '某市饮用水检测项目',
        owner: '张工',
        identifiedDate: '2024-12-27',
        dueDate: '2024-12-30',
      },
    ],
  },
  {
    category: 'equipment_impact',
    categoryLabel: '关键设备维保影响',
    totalAffected: 2,
    highCount: 1,
    mediumCount: 1,
    items: [
      {
        id: 'risk-3',
        title: 'GC-MS质谱仪超期未维护',
        description: '已超期5天，可能影响3个在进行项目',
        category: 'equipment_impact',
        level: 'high',
        status: 'open',
        affectedCount: 3,
        owner: '设备管理员',
        identifiedDate: '2024-12-23',
      },
    ],
  },
  {
    category: 'cert_impact',
    categoryLabel: '资质到期影响',
    totalAffected: 5,
    highCount: 0,
    mediumCount: 1,
    items: [
      {
        id: 'risk-4',
        title: '张工检测资质即将到期',
        description: '有效期至2025-01-20，可能影响5个项目',
        category: 'cert_impact',
        level: 'medium',
        status: 'mitigating',
        affectedCount: 5,
        owner: '人力资源部',
        identifiedDate: '2024-12-28',
        dueDate: '2025-01-20',
      },
    ],
  },
  {
    category: 'material_shortage',
    categoryLabel: '耗材短缺影响',
    totalAffected: 2,
    highCount: 1,
    mediumCount: 0,
    items: [
      {
        id: 'risk-5',
        title: 'pH标准溶液库存不足',
        description: '可能影响水质检测项目进度',
        category: 'material_shortage',
        level: 'high',
        status: 'open',
        affectedCount: 2,
        owner: '采购部',
        identifiedDate: '2024-12-28',
      },
    ],
  },
  {
    category: 'pending_review',
    categoryLabel: '待复核/签发',
    totalAffected: 4,
    highCount: 2,
    mediumCount: 2,
    items: [
      {
        id: 'risk-6',
        title: '积压检测报告待签发',
        description: '4份报告等待签发超过3个工作日',
        category: 'pending_review',
        level: 'high',
        status: 'open',
        affectedCount: 4,
        owner: '技术主任',
        identifiedDate: '2024-12-28',
      },
    ],
  },
];

// ==================== 聚合数据 ====================

export const personalDashboardData: PersonalDashboardData = {
  kpis: personalKpis,
  workItems: workItemsResponse,
  alerts: alertSummaries,
  schedules: schedules,
  notices: notices,
  projectProgress: projectProgressList,
};

export const leaderDashboardData: LeaderDashboardData = {
  kpis: leaderKpis,
  projectOverview: projectProgressList,
  resources: resources,
  risks: riskSummaries,
};

// ==================== Mock API 函数 ====================

export async function fetchMockPersonalDashboard(): Promise<PersonalDashboardData> {
  await delay(800);
  return personalDashboardData;
}

export async function fetchMockLeaderDashboard(): Promise<LeaderDashboardData> {
  await delay(800);
  return leaderDashboardData;
}

export async function fetchMockWorkItems(filter?: string): Promise<WorkItemListResponse> {
  await delay(500);
  let filtered = workItems;
  if (filter && filter !== 'all') {
    if (filter === 'overdue') {
      filtered = workItems.filter(w => w.status === 'overdue' ||
        (w.dueDate && new Date(w.dueDate) < new Date() && w.status !== 'completed'));
    } else {
      filtered = workItems.filter(w => w.status === filter || w.type === filter);
    }
  }
  return {
    items: filtered,
    total: filtered.length,
    pageSize: 10,
    currentPage: 1,
  };
}
