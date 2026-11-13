import { supabase, isSupabaseConfigured, DatabaseProject } from '../lib/supabase';
import { authService } from './authService';

export interface ProjectRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'active' | 'in_progress' | 'completed' | 'on_hold';
  leadUserId?: string;
  leadUserName?: string;
  deadline?: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const DEFAULT_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha - Core RBAC Platform',
    code: 'PRJ-ALPH',
    description: 'Enterprise authorization engine, team roster controls, and role hierarchy.',
    status: 'active',
    leadUserId: 'user-2',
    leadUserName: 'Marcus Vance',
    deadline: '2026-11-15',
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    id: 'proj-2',
    name: 'Project Beta - Mobile Portal',
    code: 'PRJ-BETA',
    description: 'Responsive client views, offline task synchronization, and push notifications.',
    status: 'in_progress',
    leadUserId: 'user-4',
    leadUserName: 'Liam Patel',
    deadline: '2026-12-01',
    createdAt: '2026-09-10T10:00:00Z',
  },
];

// In-memory cache of projects loaded from Supabase
let projectsCache: ProjectRecord[] = [...DEFAULT_PROJECTS];
let hasFetchedInitially = false;
let lastFetchError: string | null = null;
let isFetchingProjects = false;

type ProjectListener = () => void;
const listeners = new Set<ProjectListener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('Error notifying project listener', e);
    }
  });
}

function checkIsRlsError(error: { code?: string; message: string }): boolean {
  return (
    error.code === '42501' ||
    error.message.toLowerCase().includes('row-level security') ||
    error.message.toLowerCase().includes('policy') ||
    error.message.toLowerCase().includes('permission')
  );
}

/**
 * Maps frontend/input status to the exact capitalization allowed by the public.projects constraint:
 * 'Active' | 'Inactive' | 'Completed'
 */
export function toDatabaseProjectStatus(
  status?: string | null
): 'Active' | 'Inactive' | 'Completed' {
  if (!status) return 'Active';
  const lower = status.trim().toLowerCase();
  if (lower === 'completed') {
    return 'Completed';
  }
  if (lower === 'inactive' || lower === 'on_hold' || lower === 'on hold') {
    return 'Inactive';
  }
  // 'active', 'in_progress', or default fallback
  return 'Active';
}

function mapDatabaseRowToProject(row: Record<string, any>): ProjectRecord {
  const rawStatus = (row.status || 'Active').toLowerCase().trim();
  let normalizedStatus: 'active' | 'in_progress' | 'completed' | 'on_hold' = 'active';
  if (rawStatus === 'in_progress' || rawStatus === 'in progress') {
    normalizedStatus = 'in_progress';
  } else if (rawStatus === 'completed') {
    normalizedStatus = 'completed';
  } else if (rawStatus === 'on_hold' || rawStatus === 'on hold' || rawStatus === 'inactive') {
    normalizedStatus = 'on_hold';
  } else if (rawStatus === 'active') {
    normalizedStatus = 'active';
  }

  // Generate fallback code if code column is not in DB schema
  const fallbackCode =
    row.code ||
    `${(row.name || 'PRJ').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}-${String(
      row.id || ''
    ).slice(0, 4).toUpperCase() || '01'}`;

  return {
    id: String(row.id),
    name: row.name || 'Untitled Project',
    code: fallbackCode,
    description: row.description || '',
    status: normalizedStatus,
    leadUserId: row.lead_user_id || undefined,
    leadUserName: row.lead_user_name || undefined,
    deadline: row.deadline || undefined,
    createdBy: row.created_by || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
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
    console.warn('Could not resolve current user app_users.id', err);
  }

  return null;
}

export const projectService = {
  /**
   * Returns synchronous snapshot of projects loaded from Supabase.
   */
  getProjects(): ProjectRecord[] {
    return [...projectsCache];
  },

  /**
   * Returns only projects to which the user has an explicit project-membership association.
   */
  getProjectsForUser(userProjectIds: string[]): ProjectRecord[] {
    return projectsCache.filter((p) => userProjectIds.includes(p.id));
  },

  /**
   * Returns a single project by ID from cache.
   */
  getProjectById(id: string): ProjectRecord | undefined {
    return projectsCache.find((p) => p.id === id);
  },

  getLastError(): string | null {
    return lastFetchError;
  },

  hasFetched(): boolean {
    return hasFetchedInitially;
  },

  /**
   * Fetches all projects from Supabase public.projects table.
   */
  async fetchProjects(): Promise<{
    success: boolean;
    projects: ProjectRecord[];
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      lastFetchError = 'Supabase credentials are not configured.';
      return { success: false, projects: [...projectsCache], error: lastFetchError };
    }

    if (isFetchingProjects) {
      return { success: true, projects: [...projectsCache] };
    }

    isFetchingProjects = true;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const isRls = checkIsRlsError(error);
        lastFetchError = isRls
          ? `RLS policy blocked reading public.projects: ${error.message}`
          : `Failed to load projects: ${error.message}`;
        console.error('projectService.fetchProjects error:', error);
        return { success: false, projects: [...projectsCache], error: lastFetchError };
      }

      lastFetchError = null;
      hasFetchedInitially = true;
      if (data && data.length > 0) {
        projectsCache = data.map(mapDatabaseRowToProject);
      } else if (projectsCache.length === 0) {
        projectsCache = [...DEFAULT_PROJECTS];
      }
      notify();

      return { success: true, projects: [...projectsCache] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastFetchError = `Unexpected error fetching projects: ${msg}`;
      console.error('projectService.fetchProjects exception:', err);
      return { success: false, projects: [...projectsCache], error: lastFetchError };
    } finally {
      isFetchingProjects = false;
    }
  },

  /**
   * Creates a new project in Supabase public.projects table.
   * Stores created_by using the logged-in user's public.app_users.id.
   * Refreshes the project list from Supabase upon success.
   */
  async createProject(data: {
    name: string;
    code?: string;
    description: string;
    status?: 'active' | 'in_progress' | 'completed' | 'on_hold' | 'Active' | 'Inactive' | 'Completed' | string;
    leadUserName?: string;
    deadline?: string;
  }): Promise<{ success: boolean; project?: ProjectRecord; error?: string }> {
    const trimmedName = (data.name || '').trim();
    if (!trimmedName) {
      return { success: false, error: 'Project Name is required.' };
    }

    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      // 1. Resolve logged-in user's public.app_users.id
      const appUserId = await resolveCurrentAppUserId();

      // 2. Prepare payload matching public.projects schema.
      // Database constraint accepts exact values: 'Active' | 'Inactive' | 'Completed'
      const insertPayload: Record<string, any> = {
        name: trimmedName,
        description: data.description ? data.description.trim() : null,
        status: toDatabaseProjectStatus(data.status),
      };

      if (appUserId) {
        insertPayload.created_by = appUserId;
      }

      // 3. Insert into Supabase public.projects
      const { data: insertedRows, error } = await supabase
        .from('projects')
        .insert([insertPayload])
        .select();

      if (error) {
        const isRls = checkIsRlsError(error);
        const errMsg = isRls
          ? `RLS policy blocked creating project in public.projects: ${error.message}. Only authenticated managers can create projects.`
          : `Database error creating project: ${error.message}`;
        console.error('projectService.createProject error:', error);
        return { success: false, error: errMsg };
      }

      if (!insertedRows || insertedRows.length === 0) {
        return { success: false, error: 'No project record returned from database insert.' };
      }

      const createdRecord = mapDatabaseRowToProject(insertedRows[0]);

      // 4. Refresh project list from Supabase to ensure full sync
      await this.fetchProjects();

      return { success: true, project: createdRecord };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('projectService.createProject exception:', err);
      return { success: false, error: `Failed to create project: ${msg}` };
    }
  },

  /**
   * Updates an existing project in Supabase public.projects table.
   */
  async updateProject(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      status: 'active' | 'in_progress' | 'completed' | 'on_hold' | 'Active' | 'Inactive' | 'Completed' | string;
    }>
  ): Promise<{ success: boolean; project?: ProjectRecord; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.description !== undefined) payload.description = updates.description.trim();
      if (updates.status !== undefined) {
        payload.status = toDatabaseProjectStatus(updates.status);
      }

      const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        return { success: false, error: `Database error updating project: ${error.message}` };
      }

      await this.fetchProjects();
      const updated = data && data.length > 0 ? mapDatabaseRowToProject(data[0]) : undefined;
      return { success: true, project: updated };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to update project: ${msg}` };
    }
  },

  /**
   * Deletes a project from Supabase public.projects table.
   */
  async deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        return { success: false, error: `Database error deleting project: ${error.message}` };
      }

      await this.fetchProjects();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to delete project: ${msg}` };
    }
  },

  subscribe(listener: ProjectListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Initial background fetch if running in browser
if (typeof window !== 'undefined') {
  projectService.fetchProjects().catch((err) => {
    console.warn('Initial project fetch failed', err);
  });
}
