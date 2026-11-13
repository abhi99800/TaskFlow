import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { roleService } from './roleService';
import { Role } from '../types';

const STORAGE_KEY_ROLES = 'taskflow_project_roles_v2';

function loadPersistedRoles(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROLES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePersistedRoles(data: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(data));
  } catch {
    // ignore
  }
}

const inMemoryProjectRoles: Record<string, string[]> = loadPersistedRoles();

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('Error notifying project roles listener', e);
    }
  });
}

export const projectRolesService = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async fetchProjectRoles(projectId: string): Promise<{
    success: boolean;
    roles: Role[];
    error?: string;
  }> {
    if (!projectId || projectId === 'all') {
      return { success: true, roles: [] };
    }

    const allRoles = roleService.getRoles();
    const persisted = loadPersistedRoles();
    let roleIds: string[] = Array.from(
      new Set([...(persisted[projectId] || []), ...(inMemoryProjectRoles[projectId] || [])])
    );

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('project_roles')
          .select('role_id')
          .eq('project_id', projectId);

        if (!error && data && data.length > 0) {
          const dbRoleIds = data.map((d: any) => d.role_id);
          roleIds = Array.from(new Set([...roleIds, ...dbRoleIds]));
        }
      } catch (err) {
        // Handled gracefully if table does not exist
      }
    }

    // Sync back
    inMemoryProjectRoles[projectId] = roleIds;
    persisted[projectId] = roleIds;
    savePersistedRoles(persisted);

    const roles = allRoles.filter((r) => roleIds.includes(r.id));
    return { success: true, roles };
  },

  async addProjectRoles(
    projectId: string,
    roleIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId || projectId === 'all') {
      return { success: false, error: 'Please select a valid project.' };
    }
    if (!roleIds || roleIds.length === 0) {
      return { success: false, error: 'Please select at least one role to add.' };
    }

    if (!inMemoryProjectRoles[projectId]) {
      inMemoryProjectRoles[projectId] = [];
    }

    const current = inMemoryProjectRoles[projectId] || [];
    const newIds = roleIds.filter((id) => !current.includes(id));
    const updated = [...current, ...newIds];
    inMemoryProjectRoles[projectId] = updated;

    const persisted = loadPersistedRoles();
    persisted[projectId] = updated;
    savePersistedRoles(persisted);

    if (isSupabaseConfigured) {
      try {
        const rows = newIds.map((roleId) => ({
          project_id: projectId,
          role_id: roleId,
        }));
        const { error } = await supabase.from('project_roles').insert(rows);
        if (
          error &&
          error.code !== 'PGRST205' &&
          error.code !== 'PGRST204' &&
          !error.message.includes('project_roles')
        ) {
          console.error('projectRolesService.addProjectRoles error:', error);
        }
      } catch (err) {
        // Handled gracefully if table does not exist
      }
    }

    notify();
    return { success: true };
  },

  async removeProjectRole(
    projectId: string,
    roleId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !roleId) {
      return { success: false, error: 'Invalid project or role ID.' };
    }

    if (inMemoryProjectRoles[projectId]) {
      inMemoryProjectRoles[projectId] = inMemoryProjectRoles[projectId].filter(
        (id) => id !== roleId
      );
    }

    const persisted = loadPersistedRoles();
    if (persisted[projectId]) {
      persisted[projectId] = persisted[projectId].filter((id) => id !== roleId);
      savePersistedRoles(persisted);
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('project_roles')
          .delete()
          .eq('project_id', projectId)
          .eq('role_id', roleId);

        if (
          error &&
          error.code !== 'PGRST205' &&
          error.code !== 'PGRST204' &&
          !error.message.includes('project_roles')
        ) {
          console.error('projectRolesService.removeProjectRole error:', error);
        }
      } catch (err) {
        // Handled gracefully if table does not exist
      }
    }

    notify();
    return { success: true };
  },
};
