// ==================== 基础类型 ====================

export type DashboardRole = 'personal' | 'leader';

export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export type CardState = 'loading' | 'empty' | 'error' | 'forbidden' | 'success';

// ==================== KPI 相关 ====================

export interface KpiItem {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: number;
  icon?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  clickable?: boolean;
  link?: string;
}

// ==================== 待办事项 ====================

export type WorkItemType = 'sampling' | 'testing' | 'approval' | 'review';
export type WorkItemPriority = 'urgent' | 'high' | 'normal' | 'low';
export type WorkItemStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  status: WorkItemStatus;
  dueDate?: string;
  assignee?: string;
  category?: string;
  projectId?: string;
  projectName?: string;
  node?: string; // 当前节点
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemListResponse {
  items: WorkItem[];
  total: number;
  pageSize: number;
  currentPage: number;
}

// ==================== 预警提醒 ====================

export type AlertLevel = 'critical' | 'warning' | 'info';
export type AlertCategory =
  | 'inventory_low'      // 库存不足
  | 'expiring'           // 临期
  | 'cert_expiring'      // 证书到期
  | 'maintenance_due'    // 维保到期
  | 'task_overdue';      // 任务逾期

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  level: AlertLevel;
  category: AlertCategory;
  source?: string;
  projectId?: string;
  projectName?: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

export interface AlertSummary {
  category: AlertCategory;
  categoryLabel: string;
  count: number;
  criticalCount: number;
  warningCount: number;
  items: AlertItem[];
}

// ==================== 日程安排 ====================

export type ScheduleType = 'meeting' | 'deadline' | 'milestone' | 'task' | 'event';
export type ScheduleStatus = 'upcoming' | 'in_progress' | 'completed' | 'overdue';

export interface ScheduleItem {
  id: string;
  title: string;
  type: ScheduleType;
  status: ScheduleStatus;
  startTime: string;
  endTime?: string;
  location?: string;
  participants?: string[];
  description?: string;
  allDay?: boolean;
  color?: string;
}

// ==================== 通知公告 ====================

export type NoticeType = 'announcement' | 'policy' | 'news' | 'update' | 'system';

export interface NoticeItem {
  id: string;
  title: string;
  content?: string;
  type: NoticeType;
  publishTime: string;
  publisher?: string;
  isTop?: boolean;
  isRead?: boolean;
  attachments?: { name: string; url: string }[];
}

// ==================== 项目进度 ====================

export type ProjectStatus = 'not_started' | 'in_progress' | 'delayed' | 'completed' | 'suspended';

export interface ProjectStep {
  id: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  completedAt?: string;
}

export interface ProjectProgress {
  id: string;
  name: string;
  code?: string;
  client?: string;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  endDate: string;
  expectedEndDate?: string;
  delayDays?: number;
  manager?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  steps?: ProjectStep[];
}

// ==================== 资源排布 (甘特图) ====================

export type ResourceType = 'person' | 'equipment';

export interface ResourceAssignment {
  id: string;
  projectId: string;
  projectName: string;
  projectCode?: string;
  startDate: string;
  endDate: string;
  allocation: number;  // 0-100%
  color?: string;
  hasConflict?: boolean;
}

export interface ResourceItem {
  id: string;
  name: string;
  type: ResourceType;
  role?: string;
  department?: string;
  avatar?: string;
  assignments: ResourceAssignment[];
}

// ==================== 风险预警 ====================

export type RiskCategory =
  | 'overdue_contract'    // 逾期/将逾期合同
  | 'equipment_impact'    // 关键设备维保影响面
  | 'cert_impact'         // 人员资质到期影响面
  | 'material_shortage'   // 耗材短缺影响面
  | 'pending_review';     // 异常结果待复核/签发

export type RiskLevel = 'high' | 'medium' | 'low';
export type RiskStatus = 'open' | 'mitigating' | 'resolved' | 'accepted';

export interface RiskItem {
  id: string;
  title: string;
  description?: string;
  category: RiskCategory;
  level: RiskLevel;
  status: RiskStatus;
  affectedCount: number;  // 影响合同/任务数
  projectId?: string;
  projectName?: string;
  owner?: string;
  identifiedDate: string;
  dueDate?: string;
}

export interface RiskSummary {
  category: RiskCategory;
  categoryLabel: string;
  totalAffected: number;
  highCount: number;
  mediumCount: number;
  items: RiskItem[];
}

// ==================== Dashboard 聚合响应 ====================

export interface PersonalDashboardData {
  kpis: KpiItem[];
  workItems: WorkItemListResponse;
  alerts: AlertSummary[];
  schedules: ScheduleItem[];
  notices: NoticeItem[];
  projectProgress: ProjectProgress[];
}

export interface LeaderDashboardData {
  kpis: KpiItem[];
  projectOverview: ProjectProgress[];
  resources: ResourceItem[];
  risks: RiskSummary[];
}
