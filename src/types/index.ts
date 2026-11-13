export type RouteId = 
  | 'dashboard'
  | 'projects'
  | 'assign-task'
  | 'team'
  | 'reports'
  | 'user-management'
  | 'my-tasks'
  | 'signin'
  | 'not-found';

export type UserManagementSubTab = 'users' | 'roles';

export type CurrentUserRole = 'manager' | 'user';

export interface NavItemConfig {
  id: RouteId;
  label: string;
  path: string;
  isImplemented: boolean;
  description: string;
  allowedRoles: CurrentUserRole[];
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'not_completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  startDate: string;
  endDate: string;
  deadline?: string;
  priority: TaskPriority;
  status: TaskStatus;
  incompleteReason?: string;
  incompleteReasonSubmittedAt?: string;
  completedAt?: string;
  isCarriedForward?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingDeadlineItem {
  id: string;
  taskTitle: string;
  projectName: string;
  assignedUserName?: string;
  dueAt: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive' | 'active' | 'inactive';
  createdAt: string;
  isSystem?: boolean;
}

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  roleId: string;
  roleName: string;
  status: 'Active' | 'Inactive' | 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: CurrentUserRole;
  avatarUrl?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
}

export interface TaskSummaryMetrics {
  total: number | null;
  pending: number | null;
  inProgress: number | null;
  completed: number | null;
}

export type ViewStateMode = 'empty' | 'loading' | 'error';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}
