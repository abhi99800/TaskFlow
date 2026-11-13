import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { userService } from './userService';
import { taskService } from './taskService';
import { ManagedUser } from '../types';

export interface ProjectTeamMember {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  email: string;
  phoneNumber?: string;
  roleId: string;
  roleName: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  assignedTasksCount: number;
  pendingTasksCount: number;
  completedTasksCount: number;
}

// Storage keys for persistent project membership
const STORAGE_KEY_MEMBERS = 'taskflow_project_members_v2';
const STORAGE_KEY_REMOVED = 'taskflow_project_removed_members_v2';

export const DEFAULT_MEMBERS: Record<string, string[]> = {
  'proj-1': ['user-demo', 'user-2', 'user-3'],
  'proj-2': ['user-4', 'user-5'],
};

function loadPersistedMembers(): Record<string, string[]> {
  if (typeof window === 'undefined') return { ...DEFAULT_MEMBERS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMBERS);
    if (!raw) {
      savePersistedMembers(DEFAULT_MEMBERS);
      return { ...DEFAULT_MEMBERS };
    }
    const parsed = JSON.parse(raw);
    // If empty object, seed defaults
    if (!parsed || Object.keys(parsed).length === 0) {
      savePersistedMembers(DEFAULT_MEMBERS);
      return { ...DEFAULT_MEMBERS };
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to load project members from localStorage:', err);
    return { ...DEFAULT_MEMBERS };
  }
}

function savePersistedMembers(data: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save project members to localStorage:', err);
  }
}

function loadRemovedMembers(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMOVED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRemovedMembers(data: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_REMOVED, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// In-memory cache synced with persistent storage
const inMemoryProjectMembers: Record<string, string[]> = loadPersistedMembers();

type TeamListener = () => void;
const listeners = new Set<TeamListener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('Error notifying team listener', e);
    }
  });
}

export const teamService = {
  subscribe(listener: TeamListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Fetches real team members for a given project ID.
   * Merges multiple persistent sources:
   * 1. Supabase public.tasks (users with assigned deliverables in this project)
   * 2. Explicitly added project members (persisted in localStorage across reloads/rebuilds)
   * 3. Supabase public.project_members (if available in the schema cache)
   *
   * Ensures users added to projects persist permanently and never disappear on refresh.
   */
  async fetchTeamMembers(projectId: string): Promise<{
    success: boolean;
    members: ProjectTeamMember[];
    error?: string;
  }> {
    if (!projectId || projectId === 'all') {
      return { success: true, members: [] };
    }

    // 1. Ensure user directory is loaded in memory
    let allUsers = userService.getUsers();
    if (allUsers.length === 0) {
      await userService.fetchUsers();
      allUsers = userService.getUsers();
    }

    // 2. Fetch project tasks from Supabase / taskService
    const tasks = await taskService.getTasks({ projectId });

    // 3. Extract all users who have assigned tasks in this project
    // These users have real deliverables in Supabase public.tasks
    const taskUserIds = new Set<string>();
    for (const t of tasks) {
      if (t.assignedToUserId) {
        taskUserIds.add(t.assignedToUserId);
      } else if (t.assignedToEmail) {
        const matched = allUsers.find(
          (u) => u.email.toLowerCase() === t.assignedToEmail!.toLowerCase()
        );
        if (matched) taskUserIds.add(matched.id);
      }
    }

    // 4. Retrieve explicitly removed users for this project
    const removedMap = loadRemovedMembers();
    const removedForProject = new Set(removedMap[projectId] || []);

    // 5. Retrieve explicitly added members from persistent storage and in-memory map
    const persistedMap = loadPersistedMembers();
    const explicitIds = new Set<string>([
      ...(persistedMap[projectId] || []),
      ...(inMemoryProjectMembers[projectId] || []),
    ]);

    // 6. Query Supabase public.project_members if configured
    const dbProjectMemberIds = new Set<string>();
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId);

        if (!error && data) {
          data.forEach((m: any) => {
            if (m.user_id) dbProjectMemberIds.add(m.user_id);
          });
        }
      } catch (err) {
        // Table not present in schema cache; handled gracefully
      }
    }

    // 7. Combine all membership sources:
    // - Explicitly added members (from persistent storage and memory)
    // - Supabase public.project_members (if available)
    // - Supabase public.tasks (users with deliverables in this project)
    const finalMemberIds = new Set<string>();

    for (const id of explicitIds) {
      finalMemberIds.add(id);
    }
    for (const id of dbProjectMemberIds) {
      if (!removedForProject.has(id)) {
        finalMemberIds.add(id);
      }
    }
    for (const id of taskUserIds) {
      if (!removedForProject.has(id)) {
        finalMemberIds.add(id);
      }
    }

    // Sync back to persistent storage and in-memory state
    const mergedArray = Array.from(finalMemberIds);
    inMemoryProjectMembers[projectId] = mergedArray;
    persistedMap[projectId] = mergedArray;
    savePersistedMembers(persistedMap);

    // 8. Map to ProjectTeamMember objects with computed task stats
    const members: ProjectTeamMember[] = [];
    for (const userId of mergedArray) {
      // Find matching user profile
      let user = allUsers.find(
        (u) =>
          u.id === userId ||
          (u as any).auth_user_id === userId ||
          (u.email && u.email.toLowerCase() === userId.toLowerCase())
      );

      // If not in cache, try direct lookup from Supabase app_users table
      if (!user && isSupabaseConfigured) {
        try {
          const { data: dbUsers } = await supabase
            .from('app_users')
            .select('*')
            .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
            .limit(1);

          if (dbUsers && dbUsers.length > 0) {
            const raw = dbUsers[0];
            user = {
              id: raw.id,
              fullName: raw.full_name || 'Member',
              email: raw.email || '',
              phoneNumber: raw.phone || '',
              roleId: raw.role_id || '',
              roleName: 'Team Member',
              status: raw.status?.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
              createdAt: raw.created_at || new Date().toISOString(),
            };
          }
        } catch {
          // ignore lookup error
        }
      }

      if (!user) continue;
      if (user.status.toLowerCase() === 'inactive') continue;

      const userProjectTasks = tasks.filter(
        (t) =>
          t.assignedToUserId === user!.id ||
          (user!.email &&
            t.assignedToEmail &&
            t.assignedToEmail.toLowerCase() === user!.email.toLowerCase())
      );
      const assignedTasksCount = userProjectTasks.length;
      const pendingTasksCount = userProjectTasks.filter(
        (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'not_completed'
      ).length;
      const completedTasksCount = userProjectTasks.filter((t) => t.status === 'completed').length;

      members.push({
        id: `pm-${projectId}-${user.id}`,
        userId: user.id,
        projectId,
        name: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        roleId: user.roleId,
        roleName: user.roleName,
        status: (user.status.toLowerCase() === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
        createdAt: user.createdAt,
        assignedTasksCount,
        pendingTasksCount,
        completedTasksCount,
      });
    }

    // Sort alphabetically by member name
    members.sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, members };
  },

  /**
   * Adds multiple users to a project's team.
   * Persists to localStorage and attempts Supabase public.project_members insert.
   */
  async addTeamMembers(
    projectId: string,
    userIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId || projectId === 'all') {
      return { success: false, error: 'Please select a valid project.' };
    }
    if (!userIds || userIds.length === 0) {
      return { success: false, error: 'Please select at least one user to add.' };
    }

    // 1. Update in-memory state
    if (!inMemoryProjectMembers[projectId]) {
      inMemoryProjectMembers[projectId] = [];
    }
    const current = new Set(inMemoryProjectMembers[projectId]);
    userIds.forEach((id) => current.add(id));
    inMemoryProjectMembers[projectId] = Array.from(current);

    // 2. Update persistent storage (localStorage)
    const persisted = loadPersistedMembers();
    const persistedSet = new Set(persisted[projectId] || []);
    userIds.forEach((id) => persistedSet.add(id));
    persisted[projectId] = Array.from(persistedSet);
    savePersistedMembers(persisted);

    // 3. Clear from removed set if previously removed
    const removed = loadRemovedMembers();
    if (removed[projectId]) {
      removed[projectId] = removed[projectId].filter((id) => !userIds.includes(id));
      saveRemovedMembers(removed);
    }

    // 4. Attempt insert into Supabase public.project_members (if table exists)
    if (isSupabaseConfigured) {
      try {
        const rows = userIds.map((userId) => ({
          project_id: projectId,
          user_id: userId,
          status: 'Active',
        }));

        const { error } = await supabase.from('project_members').insert(rows);
        if (
          error &&
          error.code !== 'PGRST205' &&
          error.code !== 'PGRST204' &&
          !error.message.includes('project_members')
        ) {
          console.warn('Notice from project_members insert:', error.message);
        }
      } catch (err) {
        // Handled gracefully if table does not exist
      }
    }

    notify();
    return { success: true };
  },

  /**
   * Removes a team member from a project.
   * Updates persistent storage and attempts delete in Supabase.
   */
  async removeTeamMember(
    projectId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !userId) {
      return { success: false, error: 'Invalid project or user ID.' };
    }

    // 1. Update in-memory state
    if (inMemoryProjectMembers[projectId]) {
      inMemoryProjectMembers[projectId] = inMemoryProjectMembers[projectId].filter(
        (id) => id !== userId
      );
    }

    // 2. Update persistent storage
    const persisted = loadPersistedMembers();
    if (persisted[projectId]) {
      persisted[projectId] = persisted[projectId].filter((id) => id !== userId);
      savePersistedMembers(persisted);
    }

    // 3. Add to explicitly removed set for this project
    const removed = loadRemovedMembers();
    if (!removed[projectId]) {
      removed[projectId] = [];
    }
    if (!removed[projectId].includes(userId)) {
      removed[projectId].push(userId);
      saveRemovedMembers(removed);
    }

    // 4. Attempt delete from Supabase public.project_members (if table exists)
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', userId);

        if (
          error &&
          error.code !== 'PGRST205' &&
          error.code !== 'PGRST204' &&
          !error.message.includes('project_members')
        ) {
          console.warn('Notice from project_members delete:', error.message);
        }
      } catch (err) {
        // ignore
      }
    }

    notify();
    return { success: true };
  },

  /**
   * Retrieves all project IDs where the given user has an explicit project-membership association.
   * Derives access strictly from project membership records.
   */
  async getUserProjectIds(userId: string, userEmail?: string): Promise<string[]> {
    if (!userId) return [];

    const projectIds = new Set<string>();
    const persisted = loadPersistedMembers();
    const allProjectKeys = Array.from(
      new Set([...Object.keys(persisted), ...Object.keys(inMemoryProjectMembers)])
    );

    // Also look up user profile to check matching ID or email
    const allUsers = userService.getUsers();
    const matchedUser = allUsers.find(
      (u) =>
        u.id === userId ||
        (userEmail && u.email.toLowerCase() === userEmail.toLowerCase())
    );
    const targetIds = new Set<string>([userId]);
    if (matchedUser) {
      targetIds.add(matchedUser.id);
      if (matchedUser.email) targetIds.add(matchedUser.email.toLowerCase());
    }
    if (userEmail) targetIds.add(userEmail.toLowerCase());

    for (const pId of allProjectKeys) {
      const removedMap = loadRemovedMembers();
      const removedForProject = new Set(removedMap[pId] || []);

      const members = new Set([
        ...(persisted[pId] || []),
        ...(inMemoryProjectMembers[pId] || []),
      ]);

      for (const tId of targetIds) {
        if (members.has(tId) && !removedForProject.has(tId)) {
          projectIds.add(pId);
          break;
        }
      }
    }

    // Query Supabase public.project_members if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', userId);

        if (!error && data) {
          data.forEach((r: any) => {
            if (r.project_id) projectIds.add(r.project_id);
          });
        }
      } catch {
        // Table not present in schema cache; handled gracefully
      }
    }

    return Array.from(projectIds);
  },

  /**
   * Synchronous check if a user belongs to a project.
   */
  isUserInProject(projectId: string, userId: string): boolean {
    if (!projectId || !userId) return false;
    const persisted = loadPersistedMembers();
    const list = persisted[projectId] || inMemoryProjectMembers[projectId] || [];
    if (list.includes(userId)) return true;

    // Check if user object ID or email matches
    const allUsers = userService.getUsers();
    const matched = allUsers.find((u) => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
    if (matched && list.includes(matched.id)) return true;

    return false;
  },

  /**
   * Removes a user from all projects when the user is deleted.
   */
  async removeUserFromAllProjects(userId: string): Promise<void> {
    if (!userId) return;

    // Clear from inMemoryProjectMembers
    for (const pId of Object.keys(inMemoryProjectMembers)) {
      inMemoryProjectMembers[pId] = (inMemoryProjectMembers[pId] || []).filter((id) => id !== userId);
    }

    // Clear from persisted localStorage
    const persisted = loadPersistedMembers();
    for (const pId of Object.keys(persisted)) {
      persisted[pId] = (persisted[pId] || []).filter((id) => id !== userId);
    }
    savePersistedMembers(persisted);

    // If Supabase is configured, delete from project_members table
    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_members').delete().eq('user_id', userId);
      } catch {
        // ignore
      }
    }

    notify();
  },

  /**
   * Returns only active project members.
   */
  async fetchActiveTeamMembers(projectId: string): Promise<ProjectTeamMember[]> {
    const res = await this.fetchTeamMembers(projectId);
    return res.members.filter((m) => m.status === 'Active');
  },
};

