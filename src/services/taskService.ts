import {
  Task,
  UpcomingDeadlineItem,
  TaskSummaryMetrics,
  TaskPriority,
  TaskStatus,
  UserProfile,
} from '../types';
import { supabase, isSupabaseConfigured, DatabaseTask } from '../lib/supabase';
import { userService } from './userService';
import { projectService } from './projectService';
import { authService } from './authService';

/**
 * Status mapping helpers between Frontend TaskStatus and Database status values.
 * Database allowed values: Pending, In Progress, Completed, Not Completed
 */
export function mapFrontendToDbStatus(status: TaskStatus | string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'not_completed':
      return 'Not Completed';
    default:
      return status;
  }
}

export function mapDbToFrontendStatus(dbStatus: string | null | undefined): TaskStatus {
  if (!dbStatus) return 'pending';
  const norm = dbStatus.trim().toLowerCase();
  if (norm === 'pending') return 'pending';
  if (norm === 'in progress' || norm === 'in_progress') return 'in_progress';
  if (norm === 'completed') return 'completed';
  if (norm === 'not completed' || norm === 'not_completed') return 'not_completed';
  return 'pending';
}

function checkIsRlsError(error: { code?: string; message: string }): boolean {
  return (
    error.code === '42501' ||
    error.message.toLowerCase().includes('row-level security') ||
    error.message.toLowerCase().includes('policy') ||
    error.message.toLowerCase().includes('permission')
  );
}

export const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Implement Client-Side Role Guard in Route Transitions',
    description: 'Audit all client route handlers to ensure regular users cannot access administrative endpoints or components.',
    projectId: 'proj-1',
    projectName: 'Project Alpha - Core RBAC Platform',
    assignedToUserId: 'user-demo',
    assignedToName: 'Alex Morgan (User)',
    assignedToEmail: 'user@demo.com',
    startDate: '2026-10-20T09:00:00Z',
    endDate: '2026-10-24T18:00:00Z',
    deadline: '2026-10-24T18:00:00Z',
    priority: 'high',
    status: 'in_progress',
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-20T09:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Verify Task Completion Flow in My Tasks',
    description: 'Test the confirmation modal and ensure status updates propagate cleanly to Supabase.',
    projectId: 'proj-1',
    projectName: 'Project Alpha - Core RBAC Platform',
    assignedToUserId: 'user-demo',
    assignedToName: 'Alex Morgan (User)',
    assignedToEmail: 'user@demo.com',
    startDate: '2026-10-21T09:00:00Z',
    endDate: '2026-10-25T18:00:00Z',
    deadline: '2026-10-25T18:00:00Z',
    priority: 'medium',
    status: 'pending',
    createdAt: '2026-10-21T09:00:00Z',
    updatedAt: '2026-10-21T09:00:00Z',
  },
  {
    id: 'task-3',
    title: 'Design Database Schema Constraints for Project Membership',
    description: 'Ensure composite unique index on project_id and user_id to prevent duplicate associations.',
    projectId: 'proj-1',
    projectName: 'Project Alpha - Core RBAC Platform',
    assignedToUserId: 'user-2',
    assignedToName: 'Marcus Vance',
    assignedToEmail: 'marcus.vance@taskflow.internal',
    startDate: '2026-10-18T09:00:00Z',
    endDate: '2026-10-22T17:00:00Z',
    deadline: '2026-10-22T17:00:00Z',
    priority: 'medium',
    status: 'completed',
    completedAt: '2026-10-22T16:30:00Z',
    createdAt: '2026-10-18T09:00:00Z',
    updatedAt: '2026-10-22T16:30:00Z',
  },
  {
    id: 'task-4',
    title: 'QA Test Suite for Mobile Push Notifications',
    description: 'Verify service worker background notifications on Android and iOS devices.',
    projectId: 'proj-2',
    projectName: 'Project Beta - Mobile Portal',
    assignedToUserId: 'user-4',
    assignedToName: 'Liam Patel',
    assignedToEmail: 'liam.patel@taskflow.internal',
    startDate: '2026-10-19T09:00:00Z',
    endDate: '2026-10-26T17:00:00Z',
    deadline: '2026-10-26T17:00:00Z',
    priority: 'low',
    status: 'in_progress',
    createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z',
  },
];

// In-memory cache of tasks loaded from Supabase
let tasksCache: Task[] = [...DEFAULT_TASKS];
// In-memory store for incomplete reasons (if column incomplete_reason is not yet in Supabase schema)
const inMemoryReasons: Record<string, { reason: string; submittedAt: string }> = {};

let lastFetchError: string | null = null;
let isFetchingTasks = false;

type TaskListener = () => void;
const listeners = new Set<TaskListener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('Error notifying task listener', e);
    }
  });
}

/**
 * Maps a database task row (with joined projects and app_users relations) to frontend Task model.
 */
function mapDatabaseRowToTask(row: Record<string, any>): Task {
  const frontendStatus = mapDbToFrontendStatus(row.status);
  const now = Date.now();
  const dueDateTime = new Date(row.due_date || row.start_date).getTime();
  const isPastDue = !isNaN(dueDateTime) && dueDateTime < now;

  const incompleteInfo = inMemoryReasons[row.id];
  const incompleteReason = row.incomplete_reason || incompleteInfo?.reason;
  const incompleteSubmittedAt = incompleteInfo?.submittedAt || (frontendStatus === 'not_completed' ? row.updated_at : undefined);

  // Incomplete tasks automatically carry forward to Overdue
  const isCarriedForward =
    frontendStatus === 'not_completed' ||
    (frontendStatus !== 'completed' && isPastDue);

  // Resolve project name
  const projName =
    row.projects?.name ||
    (row.project_id ? projectService.getProjectById(row.project_id)?.name : undefined) ||
    'General Project';

  // Resolve assigned user name and email
  const assignedUser = row.assigned_to ? userService.getUserById(row.assigned_to) : undefined;
  const assignedName =
    row.assignee?.full_name ||
    assignedUser?.fullName ||
    'Unassigned';
  const assignedEmail =
    row.assignee?.email ||
    assignedUser?.email ||
    '';

  return {
    id: String(row.id),
    title: row.title || 'Untitled Task',
    description: row.description || '',
    projectId: row.project_id || undefined,
    projectName: projName,
    assignedToUserId: row.assigned_to || undefined,
    assignedToName: assignedName,
    assignedToEmail: assignedEmail,
    startDate: row.start_date || new Date().toISOString(),
    endDate: row.due_date || row.start_date || new Date().toISOString(),
    deadline: row.due_date || row.start_date || new Date().toISOString(),
    priority: (row.priority as TaskPriority) || 'medium',
    status: frontendStatus,
    incompleteReason: incompleteReason || undefined,
    incompleteReasonSubmittedAt: incompleteSubmittedAt,
    completedAt: frontendStatus === 'completed' ? row.updated_at || row.created_at : undefined,
    isCarriedForward,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Resolves current user's public.app_users.id for foreign key constraints.
 */
async function resolveCurrentAppUserId(): Promise<string | null> {
  const currentUser = authService.getCurrentUser();
  if (currentUser?.id) {
    return currentUser.id;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', session.user.email.toLowerCase().trim())
        .limit(1);

      if (data && data.length > 0) {
        return data[0].id;
      }
    }
  } catch (err) {
    console.warn('Could not resolve current user app_users.id for task operations', err);
  }

  return null;
}

export interface TaskQueryParams {
  status?: string;
  search?: string;
  projectId?: string;
  userId?: string;
  authUserId?: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  assignedToUserId: string;
  startDate: string;
  endDate: string;
  priority: TaskPriority;
  projectId?: string;
  projectName?: string;
}

export interface CategorizedTasks {
  today: Task[];
  upcoming: Task[];
  overdue: Task[];
  completed: Task[];
}

export const taskService = {
  subscribe(listener: TaskListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  clearCache(): void {
    tasksCache = [...DEFAULT_TASKS];
    notify();
  },

  getLastError(): string | null {
    return lastFetchError;
  },

  /**
   * Fetches task records from Supabase public.tasks table.
   * Joins public.projects and public.app_users for full metadata.
   * If joined relations encounter RLS errors, gracefully falls back to direct select('*').
   */
  async fetchTasks(params?: TaskQueryParams): Promise<{
    success: boolean;
    tasks: Task[];
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      lastFetchError = 'Supabase credentials are not configured.';
      return { success: false, tasks: [...tasksCache], error: lastFetchError };
    }

    if (isFetchingTasks) {
      return { success: true, tasks: [...tasksCache] };
    }

    isFetchingTasks = true;
    try {
      // 1. Attempt query with joined relations
      let query = supabase
        .from('tasks')
        .select(
          '*, projects(id, name), assignee:app_users!assigned_to(id, full_name, email), creator:app_users!assigned_by(id, full_name, email)'
        )
        .order('due_date', { ascending: true });

      if (params?.userId) {
        if (params.authUserId && params.authUserId !== params.userId) {
          query = query.or(`assigned_to.eq.${params.userId},assigned_to.eq.${params.authUserId}`);
        } else {
          query = query.eq('assigned_to', params.userId);
        }
      }
      if (params?.projectId && params.projectId !== 'all') {
        query = query.eq('project_id', params.projectId);
      }
      if (params?.status && params.status !== 'all') {
        query = query.eq('status', mapFrontendToDbStatus(params.status));
      }

      let { data, error } = await query;

      // 2. If the query with joined relations failed (e.g. RLS on creator/projects table),
      // retry with a direct select on tasks table
      if (error) {
        console.warn('Joined tasks query error, falling back to direct table select:', error.message);
        let fallbackQuery = supabase
          .from('tasks')
          .select('*')
          .order('due_date', { ascending: true });

        if (params?.userId) {
          if (params.authUserId && params.authUserId !== params.userId) {
            fallbackQuery = fallbackQuery.or(`assigned_to.eq.${params.userId},assigned_to.eq.${params.authUserId}`);
          } else {
            fallbackQuery = fallbackQuery.eq('assigned_to', params.userId);
          }
        }
        if (params?.projectId && params.projectId !== 'all') {
          fallbackQuery = fallbackQuery.eq('project_id', params.projectId);
        }
        if (params?.status && params.status !== 'all') {
          fallbackQuery = fallbackQuery.eq('status', mapFrontendToDbStatus(params.status));
        }

        const fallbackResult = await fallbackQuery;
        if (!fallbackResult.error && fallbackResult.data) {
          data = fallbackResult.data;
          error = null;
        }
      }

      if (error) {
        const isRls = checkIsRlsError(error);
        lastFetchError = isRls
          ? `RLS policy blocked reading public.tasks: ${error.message}`
          : `Failed to load tasks from Supabase: ${error.message}`;
        console.error('taskService.fetchTasks error:', error);
        return { success: false, tasks: [...tasksCache], error: lastFetchError };
      }

      lastFetchError = null;
      if (data && data.length > 0) {
        tasksCache = (data || []).map(mapDatabaseRowToTask);
      } else if (tasksCache.length === 0) {
        tasksCache = [...DEFAULT_TASKS];
      }
      notify();

      return { success: true, tasks: [...tasksCache] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastFetchError = `Unexpected error fetching tasks: ${msg}`;
      console.error('taskService.fetchTasks exception:', err);
      return { success: false, tasks: [...tasksCache], error: lastFetchError };
    } finally {
      isFetchingTasks = false;
    }
  },

  /**
   * Returns current task list filtered by parameters.
   * If cache is empty or new filters provided, triggers fetch.
   */
  async getTasks(params?: TaskQueryParams): Promise<Task[]> {
    if (tasksCache.length === 0) {
      await this.fetchTasks(params);
    }

    let result = [...tasksCache];
    if (params?.status && params.status !== 'all') {
      result = result.filter((t) => t.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.projectName && t.projectName.toLowerCase().includes(q)) ||
          (t.assignedToName && t.assignedToName.toLowerCase().includes(q))
      );
    }
    if (params?.projectId && params.projectId !== 'all') {
      result = result.filter((t) => t.projectId === params.projectId);
    }
    if (params?.userId) {
      result = result.filter(
        (t) =>
          t.assignedToUserId === params.userId ||
          (params.authUserId && t.assignedToUserId === params.authUserId)
      );
    }

    // Sort chronologically ascending by deadline/endDate
    result.sort((a, b) => {
      const dateA = new Date(a.endDate || a.deadline || a.startDate).getTime();
      const dateB = new Date(b.endDate || b.deadline || b.startDate).getTime();
      return dateA - dateB;
    });

    return result;
  },

  /**
   * Retrieves tasks assigned to the given user.
   * Resolves public.app_users.id using Supabase auth session and auth_user_id relationship.
   * Strictly filters tasks to show only those assigned to the authenticated user.
   */
  async getTasksForUser(user: UserProfile | null): Promise<Task[]> {
    if (!user) return [];

    let appUserId = user.id;
    let authUserId: string | undefined = undefined;

    // Resolve exact public.app_users.id and auth_user_id from Supabase Auth session
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          authUserId = session.user.id;
          const userEmail = (user.email || session.user.email || '').toLowerCase().trim();
          const { data: matchedUsers } = await supabase
            .from('app_users')
            .select('id, auth_user_id')
            .or(`auth_user_id.eq.${session.user.id},email.eq.${userEmail}`)
            .limit(1);

          if (matchedUsers && matchedUsers.length > 0) {
            appUserId = matchedUsers[0].id;
            if (matchedUsers[0].auth_user_id) {
              authUserId = matchedUsers[0].auth_user_id;
            }
          }
        }
      } catch (err) {
        console.warn('Could not resolve database app_users ID from auth session:', err);
      }
    }

    const fetchRes = await this.fetchTasks({ userId: appUserId, authUserId });
    const sourceList = fetchRes.success ? fetchRes.tasks : tasksCache;

    const userEmail = (user.email || '').toLowerCase().trim();

    const list = sourceList.filter((t) => {
      if (t.assignedToUserId) {
        if (t.assignedToUserId === appUserId || (authUserId && t.assignedToUserId === authUserId)) {
          return true;
        }
      }
      if (t.assignedToEmail && t.assignedToEmail.toLowerCase().trim() === userEmail) {
        return true;
      }
      return false;
    });

    list.sort((a, b) => {
      const timeA = new Date(a.endDate || a.deadline || a.startDate).getTime();
      const timeB = new Date(b.endDate || b.deadline || b.startDate).getTime();
      return timeA - timeB;
    });

    return list;
  },

  /**
   * Returns current summary metrics computed from loaded tasks.
   */
  async getMetrics(): Promise<TaskSummaryMetrics> {
    if (tasksCache.length === 0) {
      await this.fetchTasks();
    }

    return {
      total: tasksCache.length,
      pending: tasksCache.filter((t) => t.status === 'pending').length,
      inProgress: tasksCache.filter((t) => t.status === 'in_progress').length,
      completed: tasksCache.filter((t) => t.status === 'completed').length,
    };
  },

  /**
   * Categorizes a list of tasks into Today, Upcoming, Overdue, and Completed.
   * Incomplete tasks automatically carry forward to Overdue without changing due date.
   */
  categorizeTasks(tasks: Task[]): CategorizedTasks {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const result: CategorizedTasks = {
      today: [],
      upcoming: [],
      overdue: [],
      completed: [],
    };

    for (const task of tasks) {
      if (task.status === 'completed') {
        result.completed.push(task);
        continue;
      }

      const end = new Date(task.endDate || task.deadline || task.startDate);
      const start = new Date(task.startDate);

      if (task.status === 'not_completed' || end.getTime() < now.getTime()) {
        result.overdue.push({
          ...task,
          isCarriedForward: true,
        });
      } else if (start.getTime() > todayEnd.getTime()) {
        result.upcoming.push(task);
      } else {
        result.today.push(task);
      }
    }

    const sortByDate = (a: Task, b: Task) =>
      new Date(a.endDate || a.deadline || a.startDate).getTime() -
      new Date(b.endDate || b.deadline || b.startDate).getTime();

    result.today.sort(sortByDate);
    result.upcoming.sort(sortByDate);
    result.overdue.sort(sortByDate);
    result.completed.sort(
      (a, b) =>
        new Date(b.completedAt || b.updatedAt).getTime() -
        new Date(a.completedAt || a.updatedAt).getTime()
    );

    return result;
  },

  async getUpcomingDeadlines(): Promise<UpcomingDeadlineItem[]> {
    if (tasksCache.length === 0) {
      await this.fetchTasks();
    }

    return tasksCache
      .filter((t) => !!(t.endDate || t.deadline) && t.status !== 'completed')
      .map((t) => ({
        id: `dl-${t.id}`,
        taskTitle: t.title,
        projectName: t.projectName || 'General Work',
        assignedUserName: t.assignedToName,
        dueAt: t.endDate || t.deadline || '',
        status: t.status,
        priority: t.priority,
      }));
  },

  /**
   * Manager workflow to create and assign tasks.
   * Validates title, description, assigned user, start and end dates.
   * Saves task to Supabase public.tasks using exact column names.
   * Resolves assigned_to and assigned_by using public.app_users.id.
   */
  async createTask(
    data: CreateTaskInput
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    const titleTrimmed = (data.title || '').trim();
    const descriptionTrimmed = (data.description || '').trim();

    if (!titleTrimmed) {
      return { success: false, error: 'Task Title is required.' };
    }
    if (!descriptionTrimmed) {
      return { success: false, error: 'Task Description is required.' };
    }
    if (!data.assignedToUserId) {
      return { success: false, error: 'Please select an eligible active user to assign.' };
    }
    if (!data.startDate) {
      return { success: false, error: 'Start Date and Time is required.' };
    }
    if (!data.endDate) {
      return { success: false, error: 'End Date and Time / Deadline is required.' };
    }

    const startTime = new Date(data.startDate).getTime();
    const endTime = new Date(data.endDate).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      return { success: false, error: 'Invalid start or end date format.' };
    }

    if (endTime <= startTime) {
      return { success: false, error: 'End date and time must be later than start date and time.' };
    }

    // Role check: Only managers can assign tasks
    const currentRole = authService.getAuthenticatedRole();
    if (currentRole && currentRole !== 'manager') {
      return {
        success: false,
        error: 'Permission denied: Only managers are authorized to create and assign tasks.',
      };
    }

    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      // Resolve assigned_by using logged-in user's public.app_users.id
      const assignedByAppUserId = await resolveCurrentAppUserId();
      if (!assignedByAppUserId) {
        return {
          success: false,
          error: 'Could not resolve logged-in manager account in public.app_users. Please ensure you are logged in.',
        };
      }

      // Check duplicate title for same user
      const duplicate = tasksCache.some(
        (t) =>
          t.assignedToUserId === data.assignedToUserId &&
          t.title.trim().toLowerCase() === titleTrimmed.toLowerCase() &&
          t.status !== 'completed'
      );
      if (duplicate) {
        const assignedUser = userService.getUserById(data.assignedToUserId);
        return {
          success: false,
          error: `A task with the title "${titleTrimmed}" is already assigned to ${
            assignedUser?.fullName || 'this user'
          }.`,
        };
      }

      // Insert payload using EXACT database column names
      const insertPayload: Record<string, any> = {
        title: titleTrimmed,
        description: descriptionTrimmed,
        assigned_to: data.assignedToUserId, // public.app_users.id
        assigned_by: assignedByAppUserId, // public.app_users.id
        start_date: data.startDate,
        due_date: data.endDate,
        status: mapFrontendToDbStatus('pending'), // 'Pending'
      };

      if (data.projectId) {
        insertPayload.project_id = data.projectId;
      }

      const { data: insertedRows, error } = await supabase
        .from('tasks')
        .insert([insertPayload])
        .select(
          '*, projects(id, name), assignee:app_users!assigned_to(id, full_name, email), creator:app_users!assigned_by(id, full_name, email)'
        );

      if (error) {
        const isRls = checkIsRlsError(error);
        const errMsg = isRls
          ? `RLS policy blocked inserting into public.tasks: ${error.message}. Only authenticated managers can assign tasks.`
          : `Database error creating task: ${error.message}`;
        console.error('taskService.createTask error:', error);
        return { success: false, error: errMsg };
      }

      if (!insertedRows || insertedRows.length === 0) {
        return { success: false, error: 'No task record returned from database insert.' };
      }

      const createdTask = mapDatabaseRowToTask(insertedRows[0]);

      // Refresh task list from Supabase
      await this.fetchTasks();

      return { success: true, task: createdTask };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('taskService.createTask exception:', err);
      return { success: false, error: `Failed to create task: ${msg}` };
    }
  },

  /**
   * Helper to check if a task is assigned to a specific user profile.
   * Managers are not regular assignees for completing tasks.
   */
  isTaskAssignedToUser(task: Task, user: UserProfile | null): boolean {
    if (!user) return false;
    if (user.role === 'manager') return false;

    const userEmail = (user.email || '').toLowerCase().trim();
    const userName = (user.fullName || '').toLowerCase().trim();

    if (task.assignedToUserId && user.id && task.assignedToUserId === user.id) {
      return true;
    }
    if (task.assignedToEmail && userEmail && task.assignedToEmail.toLowerCase().trim() === userEmail) {
      return true;
    }
    if (task.assignedToName && userName && task.assignedToName.toLowerCase().trim() === userName) {
      return true;
    }
    return false;
  },

  /**
   * Marks a task as completed in Supabase public.tasks.
   * Maps frontend status to database value 'Completed'.
   * Synchronously updates local state and pushes update to Supabase.
   * Enforces that ONLY the assigned user can mark a task as Completed (not managers).
   */
  async markTaskCompleted(
    taskId: string
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    const task = tasksCache.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in records.' };
    }

    if (task.status === 'completed') {
      return { success: true, task };
    }

    // Role check: Only assigned users can mark tasks as completed.
    // Managers create and assign tasks; they cannot mark tasks as completed.
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'manager') {
      return {
        success: false,
        error: 'Only the assigned user can mark a task as Completed. Managers cannot mark tasks as completed.',
      };
    }

    if (currentUser?.role === 'user') {
      const isAssigned = this.isTaskAssignedToUser(task, currentUser);

      if (!isAssigned) {
        return {
          success: false,
          error: 'Permission denied: You can only complete tasks assigned to your account.',
        };
      }
    }

    // Store previous status for rollback if database update fails
    const previousStatus = task.status;
    const previousCompletedAt = task.completedAt;
    const previousUpdatedAt = task.updatedAt;

    const nowIso = new Date().toISOString();

    // Optimistic in-memory update
    task.status = 'completed';
    task.completedAt = nowIso;
    task.updatedAt = nowIso;
    notify();

    try {
      // 1. Attempt update with updated_at timestamp and full select
      let updateError: any = null;
      let updatedData: any = null;

      const firstAttempt = await supabase
        .from('tasks')
        .update({
          status: mapFrontendToDbStatus('completed'), // 'Completed'
          updated_at: nowIso,
        })
        .eq('id', taskId)
        .select(
          '*, projects(id, name), assignee:app_users!assigned_to(id, full_name, email), creator:app_users!assigned_by(id, full_name, email)'
        );

      if (firstAttempt.error) {
        // If updated_at column is not present or joined relations fail, retry with simpler query
        if (
          firstAttempt.error.code === 'PGRST204' ||
          firstAttempt.error.message.includes('updated_at')
        ) {
          const secondAttempt = await supabase
            .from('tasks')
            .update({
              status: mapFrontendToDbStatus('completed'),
            })
            .eq('id', taskId)
            .select('*');
          updateError = secondAttempt.error;
          updatedData = secondAttempt.data;
        } else {
          // Retry direct update without joined relations
          const thirdAttempt = await supabase
            .from('tasks')
            .update({
              status: mapFrontendToDbStatus('completed'),
              updated_at: nowIso,
            })
            .eq('id', taskId)
            .select('*');

          if (thirdAttempt.error) {
            // Last fallback: simple update without select return
            const fourthAttempt = await supabase
              .from('tasks')
              .update({
                status: mapFrontendToDbStatus('completed'),
              })
              .eq('id', taskId);
            updateError = fourthAttempt.error;
          } else {
            updatedData = thirdAttempt.data;
          }
        }
      } else {
        updatedData = firstAttempt.data;
      }

      if (updateError) {
        // Rollback optimistic update
        task.status = previousStatus;
        task.completedAt = previousCompletedAt;
        task.updatedAt = previousUpdatedAt;
        notify();

        const isRls = checkIsRlsError(updateError);
        const errMsg = isRls
          ? `RLS policy restricted updating task in public.tasks: ${updateError.message}. Verify that the user has UPDATE permission on public.tasks.`
          : `Database error updating task: ${updateError.message}`;
        console.error('taskService.markTaskCompleted error:', updateError);
        return { success: false, error: errMsg };
      }

      // Re-fetch full tasks from database to synchronize state
      await this.fetchTasks();

      const updated =
        updatedData && updatedData.length > 0 ? mapDatabaseRowToTask(updatedData[0]) : task;
      return { success: true, task: updated };
    } catch (err: unknown) {
      // Rollback optimistic update
      task.status = previousStatus;
      task.completedAt = previousCompletedAt;
      task.updatedAt = previousUpdatedAt;
      notify();

      const msg = err instanceof Error ? err.message : String(err);
      console.error('taskService.markTaskCompleted exception:', err);
      return { success: false, error: `Failed to complete task: ${msg}` };
    }
  },

  /**
   * Marks a task as incomplete with a required reason.
   * Carries forward the task to overdue without altering the original due date.
   * Maps status to database value 'Not Completed'.
   */
  async markTaskIncomplete(
    taskId: string,
    reason: string
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) {
      return { success: false, error: 'Please provide a reason why this task cannot be completed.' };
    }

    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    const task = tasksCache.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in records.' };
    }

    // Role check: Regular users can only update their own tasks
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'user' && task.assignedToUserId && task.assignedToUserId !== currentUser.id) {
      return { success: false, error: 'Permission denied: You can only update tasks assigned to you.' };
    }

    try {
      const nowIso = new Date().toISOString();

      // Store in memory reason cache
      inMemoryReasons[taskId] = {
        reason: trimmedReason,
        submittedAt: nowIso,
      };

      // 1. Attempt update with incomplete_reason column
      let updateError: any = null;
      let updatedData: any = null;

      const firstAttempt = await supabase
        .from('tasks')
        .update({
          status: mapFrontendToDbStatus('not_completed'), // 'Not Completed'
          incomplete_reason: trimmedReason,
          updated_at: nowIso,
        })
        .eq('id', taskId)
        .select(
          '*, projects(id, name), assignee:app_users!assigned_to(id, full_name, email), creator:app_users!assigned_by(id, full_name, email)'
        );

      if (firstAttempt.error) {
        // If incomplete_reason column does not exist in public.tasks table schema, retry without it
        if (
          firstAttempt.error.code === 'PGRST204' ||
          firstAttempt.error.message.includes('incomplete_reason')
        ) {
          console.warn(
            'public.tasks does not have incomplete_reason column yet; updating status to Not Completed and retaining reason in memory.'
          );
          const retryAttempt = await supabase
            .from('tasks')
            .update({
              status: mapFrontendToDbStatus('not_completed'),
              updated_at: nowIso,
            })
            .eq('id', taskId)
            .select(
              '*, projects(id, name), assignee:app_users!assigned_to(id, full_name, email), creator:app_users!assigned_by(id, full_name, email)'
            );
          updateError = retryAttempt.error;
          updatedData = retryAttempt.data;
        } else {
          updateError = firstAttempt.error;
        }
      } else {
        updatedData = firstAttempt.data;
      }

      if (updateError) {
        const isRls = checkIsRlsError(updateError);
        const errMsg = isRls
          ? `RLS policy restricted updating task in public.tasks: ${updateError.message}`
          : `Database error updating task: ${updateError.message}`;
        console.error('taskService.markTaskIncomplete error:', updateError);
        return { success: false, error: errMsg };
      }

      await this.fetchTasks();
      const updated = updatedData && updatedData.length > 0 ? mapDatabaseRowToTask(updatedData[0]) : task;
      return { success: true, task: updated };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('taskService.markTaskIncomplete exception:', err);
      return { success: false, error: `Failed to record incomplete status: ${msg}` };
    }
  },

  /**
   * Updates task status (e.g. pending -> in_progress).
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('tasks')
        .update({
          status: mapFrontendToDbStatus(newStatus),
          updated_at: nowIso,
        })
        .eq('id', taskId);

      if (error) {
        console.error('taskService.updateTaskStatus error:', error);
        return false;
      }
      await this.fetchTasks();
      return true;
    } catch (err) {
      console.error('taskService.updateTaskStatus exception:', err);
      return false;
    }
  },

  /**
   * Manager-only workflow to edit task details, reassign assignees, or alter deadlines.
   * Strictly validates that the assigned user is an active member of the task's project.
   * Non-managers are strictly blocked.
   */
  async updateTask(
    taskId: string,
    updates: {
      title?: string;
      description?: string;
      assignedToUserId?: string;
      startDate?: string;
      endDate?: string;
      priority?: TaskPriority;
      projectId?: string;
    }
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    const currentRole = authService.getAuthenticatedRole();
    if (currentRole && currentRole !== 'manager') {
      return {
        success: false,
        error: 'Permission denied: Only managers are authorized to edit, reassign, or change deadlines on tasks.',
      };
    }

    const task = tasksCache.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in records.' };
    }

    const targetProjectId = updates.projectId || task.projectId;

    // Validate reassigned user is an active member of the target project
    if (updates.assignedToUserId && updates.assignedToUserId !== task.assignedToUserId) {
      if (targetProjectId) {
        const { teamService } = await import('./teamService');
        const teamRes = await teamService.fetchTeamMembers(targetProjectId);
        const isMember = teamRes.members.some(
          (m) => m.userId === updates.assignedToUserId && m.status.toLowerCase() === 'active'
        );
        if (!isMember) {
          return {
            success: false,
            error: 'The designated assignee must be an active team member associated with this project.',
          };
        }
      }
    }

    // Validate dates if modified
    const effectiveStart = updates.startDate || task.startDate;
    const effectiveEnd = updates.endDate || task.endDate || task.deadline;
    if (effectiveStart && effectiveEnd) {
      const s = new Date(effectiveStart).getTime();
      const e = new Date(effectiveEnd).getTime();
      if (e <= s) {
        return {
          success: false,
          error: 'End date and time must be later than start date and time.',
        };
      }
    }

    // Update in Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.title !== undefined) payload.title = updates.title.trim();
        if (updates.description !== undefined) payload.description = updates.description.trim();
        if (updates.assignedToUserId !== undefined) payload.assigned_to = updates.assignedToUserId;
        if (updates.startDate !== undefined) payload.start_date = updates.startDate;
        if (updates.endDate !== undefined) payload.due_date = updates.endDate;
        if (updates.projectId !== undefined) payload.project_id = updates.projectId;

        const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
        if (error) {
          const isRls = checkIsRlsError(error);
          return {
            success: false,
            error: isRls
              ? `RLS policy blocked task update: ${error.message}. Only managers can modify tasks.`
              : `Database error updating task: ${error.message}`,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to update task: ${msg}` };
      }
    }

    // Update in-memory task
    const assignedUser = updates.assignedToUserId
      ? userService.getUserById(updates.assignedToUserId)
      : undefined;

    if (updates.title !== undefined) task.title = updates.title.trim();
    if (updates.description !== undefined) task.description = updates.description.trim();
    if (updates.assignedToUserId !== undefined) {
      task.assignedToUserId = updates.assignedToUserId;
      task.assignedToName = assignedUser?.fullName || task.assignedToName;
      task.assignedToEmail = assignedUser?.email || task.assignedToEmail;
    }
    if (updates.startDate !== undefined) task.startDate = updates.startDate;
    if (updates.endDate !== undefined) {
      task.endDate = updates.endDate;
      task.deadline = updates.endDate;
    }
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.projectId !== undefined) {
      task.projectId = updates.projectId;
      task.projectName = projectService.getProjectById(updates.projectId)?.name || task.projectName;
    }
    task.updatedAt = new Date().toISOString();

    notify();
    return { success: true, task };
  },

  /**
   * Manager-only workflow to delete tasks whose status is Completed.
   * Users are strictly forbidden from accessing or executing this action.
   */
  async deleteCompletedTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    const currentRole = authService.getAuthenticatedRole();
    if (currentRole && currentRole !== 'manager') {
      return {
        success: false,
        error: 'Permission denied: Only managers are authorized to delete tasks.',
      };
    }

    const task = tasksCache.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in records.' };
    }

    if (task.status !== 'completed') {
      return {
        success: false,
        error: 'Only completed tasks can be deleted.',
      };
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) {
          const isRls = checkIsRlsError(error);
          return {
            success: false,
            error: isRls
              ? `RLS policy blocked deleting task: ${error.message}. Only managers can delete completed tasks.`
              : `Database error deleting task: ${error.message}`,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to delete task: ${msg}` };
      }
    }

    tasksCache = tasksCache.filter((t) => t.id !== taskId);
    notify();
    return { success: true };
  },
};

// Initial background fetch if running in browser and listen for auth state changes
if (typeof window !== 'undefined') {
  authService.subscribe((state) => {
    if (!state.isAuthenticated) {
      taskService.clearCache();
    } else {
      taskService.fetchTasks().catch(() => {});
    }
  });

  taskService.fetchTasks().catch((err) => {
    console.warn('Initial tasks fetch failed', err);
  });

  // Supabase Real-time channel for task table changes
  if (isSupabaseConfigured) {
    try {
      supabase
        .channel('public:tasks:sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload) => {
            console.info('Supabase task real-time change detected:', payload.eventType);
            taskService.fetchTasks().catch(console.error);
          }
        )
        .subscribe();
    } catch (realtimeErr) {
      console.warn('Could not establish Supabase realtime connection for tasks:', realtimeErr);
    }
  }

  // Periodic background polling fallback (every 4 seconds) to ensure synchronization between
  // manager and user views across devices and sessions without requiring a manual refresh.
  setInterval(() => {
    const auth = authService.getAuthState();
    if (auth.isAuthenticated) {
      taskService.fetchTasks().catch(() => {});
    }
  }, 4000);
}
