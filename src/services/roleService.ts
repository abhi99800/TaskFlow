import { Role } from '../types';
import { supabase, isSupabaseConfigured, DatabaseRole } from '../lib/supabase';

/**
 * Service boundary for Role Management.
 * Integrated with Supabase (public.roles) with in-memory caching and graceful RLS handling.
 */

/**
 * Maps frontend/input role status to the exact capitalization allowed by the public.roles constraint:
 * 'Active' | 'Inactive'
 */
export function toDatabaseRoleStatus(status?: string | null): 'Active' | 'Inactive' {
  if (!status) return 'Active';
  const trimmed = status.trim().toLowerCase();
  if (trimmed === 'inactive') {
    return 'Inactive';
  }
  return 'Active';
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-1',
    name: 'Manager',
    description: 'Oversees project delivery, task assignment, and team allocation.',
    status: 'Active',
    createdAt: '2026-09-01T09:00:00Z',
    isSystem: true,
  },
  {
    id: 'role-2',
    name: 'Team Lead',
    description: 'Technical guidance, sprint breakdown, and code reviews.',
    status: 'Active',
    createdAt: '2026-09-02T10:30:00Z',
    isSystem: false,
  },
  {
    id: 'role-3',
    name: 'Software Engineer',
    description: 'Feature implementation, unit testing, and technical documentation.',
    status: 'Active',
    createdAt: '2026-09-03T11:15:00Z',
    isSystem: false,
  },
  {
    id: 'role-4',
    name: 'QA Engineer',
    description: 'Test planning, test automation, and release quality verification.',
    status: 'Active',
    createdAt: '2026-09-04T14:20:00Z',
    isSystem: false,
  },
  {
    id: 'role-5',
    name: 'Product Designer',
    description: 'UI/UX wireframing, design system fidelity, and user research.',
    status: 'Active',
    createdAt: '2026-09-05T16:00:00Z',
    isSystem: false,
  },
];

const STORAGE_KEY_ROLES = 'taskflow_roles_v2';

function loadPersistedRoles(): Role[] {
  if (typeof window === 'undefined') return [...DEFAULT_ROLES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROLES);
    if (!raw) {
      savePersistedRoles(DEFAULT_ROLES);
      return [...DEFAULT_ROLES];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      savePersistedRoles(DEFAULT_ROLES);
      return [...DEFAULT_ROLES];
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to load roles from localStorage:', err);
    return [...DEFAULT_ROLES];
  }
}

function savePersistedRoles(roles: Role[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(roles));
  } catch (err) {
    console.warn('Failed to save roles to localStorage:', err);
  }
}

let rolesData: Role[] = loadPersistedRoles();

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

let lastFetchError: string | null = null;
let isRlsRestrictedState: boolean = false;

function checkIsRlsError(error: { code?: string; message: string }): boolean {
  return (
    error.code === '42501' ||
    error.message.toLowerCase().includes('row-level security') ||
    error.message.toLowerCase().includes('policy') ||
    error.message.toLowerCase().includes('permission')
  );
}

export const roleService = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isConfigured(): boolean {
    return isSupabaseConfigured;
  },

  getLastError(): string | null {
    return lastFetchError;
  },

  isRlsRestricted(): boolean {
    return isRlsRestrictedState;
  },

  getRoles(): Role[] {
    return [...rolesData];
  },

  getActiveRoles(): Role[] {
    return rolesData.filter((r) => r.status === 'Active' || r.status === 'active');
  },

  getRoleById(id: string): Role | undefined {
    return rolesData.find((r) => r.id === id);
  },

  /**
   * Fetches roles from Supabase public.roles table.
   * If Supabase returns records, updates the in-memory cache and notifies subscribers.
   */
  async fetchRoles(): Promise<{
    success: boolean;
    roles: Role[];
    error?: string;
    isRlsRestricted?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      lastFetchError = null;
      isRlsRestrictedState = false;
      return { success: true, roles: [...rolesData] };
    }

    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        const isRls = checkIsRlsError(error);
        isRlsRestrictedState = isRls;
        lastFetchError = isRls
          ? `Row-Level Security (RLS) policy restricted reading roles: ${error.message}`
          : `Supabase query error (${error.code || 'unknown'}): ${error.message}`;

        return {
          success: false,
          roles: [...rolesData],
          error: lastFetchError,
          isRlsRestricted: isRls,
        };
      }

      lastFetchError = null;
      isRlsRestrictedState = false;

      if (data && data.length > 0) {
        const mappedRoles: Role[] = data.map((r: DatabaseRole) => ({
          id: r.id,
          name: r.name,
          description: r.description || '',
          status: toDatabaseRoleStatus(r.status),
          createdAt: r.created_at || new Date().toISOString(),
          isSystem: r.name.toLowerCase() === 'manager' || r.name.toLowerCase() === 'user',
        }));

        rolesData = mappedRoles;
        savePersistedRoles(rolesData);
        notify();
      }

      return { success: true, roles: [...rolesData] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastFetchError = `Failed to fetch roles: ${msg}`;
      return { success: false, roles: [...rolesData], error: lastFetchError };
    }
  },

  /**
   * Creates a new role in Supabase public.roles.
   * Performs client validation for required fields and duplicate role names.
   */
  async createRole(data: {
    name: string;
    description: string;
    status?: 'Active' | 'Inactive' | 'active' | 'inactive' | string;
  }): Promise<{ success: boolean; error?: string; role?: Role; isRlsBlocked?: boolean }> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Role name is required.' };
    }

    if (!data.description.trim()) {
      return { success: false, error: 'Role description is required.' };
    }

    // Case-insensitive uniqueness check ignoring leading/trailing spaces
    const exists = rolesData.some(
      (r) => r.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      return { success: false, error: `A role named "${trimmedName}" already exists.` };
    }

    // Ensure every new role is inserted with 'Active' or explicit 'Inactive', never lowercase
    const dbStatus: 'Active' | 'Inactive' = toDatabaseRoleStatus(data.status || 'Active');

    if (isSupabaseConfigured) {
      try {
        const { data: insertedRow, error } = await supabase
          .from('roles')
          .insert([
            {
              name: trimmedName,
              description: data.description.trim(),
              status: dbStatus,
            },
          ])
          .select()
          .single();

        if (error) {
          const isRls = checkIsRlsError(error);
          if (isRls) {
            return {
              success: false,
              error: `Row-Level Security (RLS) policy blocked role creation: ${error.message}. Please configure an INSERT policy on public.roles in your Supabase project.`,
              isRlsBlocked: true,
            };
          }
          if (error.code === '23505') {
            return {
              success: false,
              error: `A role named "${trimmedName}" already exists in the database.`,
            };
          }
          return {
            success: false,
            error: `Database error (${error.code || 'unknown'}): ${error.message}`,
          };
        }

        const newRole: Role = {
          id: insertedRow.id,
          name: insertedRow.name,
          description: insertedRow.description || '',
          status: toDatabaseRoleStatus(insertedRow.status),
          createdAt: insertedRow.created_at || new Date().toISOString(),
          isSystem: false,
        };

        rolesData = [newRole, ...rolesData.filter((r) => r.id !== newRole.id)];
        savePersistedRoles(rolesData);
        notify();
        return { success: true, role: newRole };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to create role in Supabase: ${msg}` };
      }
    }

    // Local fallback when Supabase is not configured
    const newRole: Role = {
      id: `role-${Date.now()}`,
      name: trimmedName,
      description: data.description.trim(),
      status: dbStatus,
      createdAt: new Date().toISOString(),
      isSystem: false,
    };

    rolesData = [newRole, ...rolesData];
    savePersistedRoles(rolesData);
    notify();
    return { success: true, role: newRole };
  },

  /**
   * Updates an existing role in Supabase public.roles.
   */
  async updateRole(
    id: string,
    data: { name: string; description: string; status: 'Active' | 'Inactive' | 'active' | 'inactive' | string },
    assignedCount: number = 0
  ): Promise<{ success: boolean; error?: string; isRlsBlocked?: boolean }> {
    const roleIndex = rolesData.findIndex((r) => r.id === id);
    if (roleIndex === -1) {
      return { success: false, error: 'Role not found.' };
    }

    const trimmedName = data.name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Role name is required.' };
    }

    if (!data.description.trim()) {
      return { success: false, error: 'Role description is required.' };
    }

    // Check duplicate name excluding current role
    const duplicate = rolesData.some(
      (r) => r.id !== id && r.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      return { success: false, error: `A role named "${trimmedName}" already exists.` };
    }

    // Ensure role updates use only 'Active' or 'Inactive'
    const dbStatus: 'Active' | 'Inactive' = toDatabaseRoleStatus(data.status);

    // Deactivation validation rule: Cannot deactivate role if users are assigned
    if (dbStatus === 'Inactive' && assignedCount > 0) {
      return {
        success: false,
        error: `Cannot deactivate role "${trimmedName}" while ${assignedCount} user(s) are assigned to it. Reassign those users first.`,
      };
    }

    if (isSupabaseConfigured) {
      try {
        const { data: updatedRow, error } = await supabase
          .from('roles')
          .update({
            name: trimmedName,
            description: data.description.trim(),
            status: dbStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          const isRls = checkIsRlsError(error);
          if (isRls) {
            return {
              success: false,
              error: `Row-Level Security (RLS) policy blocked role update: ${error.message}. Please configure an UPDATE policy on public.roles in your Supabase project.`,
              isRlsBlocked: true,
            };
          }
          if (error.code === '23505') {
            return {
              success: false,
              error: `A role named "${trimmedName}" already exists in the database.`,
            };
          }
          return {
            success: false,
            error: `Database error (${error.code || 'unknown'}): ${error.message}`,
          };
        }

        const updatedRole: Role = {
          id: updatedRow.id,
          name: updatedRow.name,
          description: updatedRow.description || '',
          status: toDatabaseRoleStatus(updatedRow.status),
          createdAt: updatedRow.created_at || rolesData[roleIndex].createdAt,
          isSystem: rolesData[roleIndex].isSystem,
        };

        rolesData[roleIndex] = updatedRole;
        savePersistedRoles(rolesData);
        notify();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to update role in Supabase: ${msg}` };
      }
    }

    // Local fallback
    rolesData[roleIndex] = {
      ...rolesData[roleIndex],
      name: trimmedName,
      description: data.description.trim(),
      status: dbStatus,
    };

    savePersistedRoles(rolesData);
    notify();
    return { success: true };
  },

  /**
   * Toggles role active/inactive status in Supabase public.roles.
   */
  async toggleRoleStatus(
    id: string,
    assignedCount: number = 0
  ): Promise<{ success: boolean; error?: string; isRlsBlocked?: boolean }> {
    const role = rolesData.find((r) => r.id === id);
    if (!role) return { success: false, error: 'Role not found.' };

    const currentIsActive = role.status === 'Active' || role.status === 'active';
    const nextStatus: 'Active' | 'Inactive' = currentIsActive ? 'Inactive' : 'Active';
    if (nextStatus === 'Inactive' && assignedCount > 0) {
      return {
        success: false,
        error: `Cannot deactivate role "${role.name}" while ${assignedCount} user(s) are assigned to it.`,
      };
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('roles')
          .update({
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) {
          const isRls = checkIsRlsError(error);
          if (isRls) {
            return {
              success: false,
              error: `Row-Level Security (RLS) policy blocked role status update: ${error.message}. Please configure an UPDATE policy on public.roles in your Supabase project.`,
              isRlsBlocked: true,
            };
          }
          return {
            success: false,
            error: `Database error (${error.code || 'unknown'}): ${error.message}`,
          };
        }

        role.status = nextStatus;
        savePersistedRoles(rolesData);
        notify();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to toggle role status: ${msg}` };
      }
    }

    role.status = nextStatus;
    savePersistedRoles(rolesData);
    notify();
    return { success: true };
  },

  /**
   * Deletes a role from Supabase public.roles if not assigned to any users.
   */
  async deleteRole(
    id: string,
    assignedCount: number = 0
  ): Promise<{ success: boolean; error?: string; isRlsBlocked?: boolean }> {
    const role = rolesData.find((r) => r.id === id);
    if (!role) return { success: false, error: 'Role not found.' };

    if (role.isSystem || role.name.toLowerCase() === 'manager' || role.name.toLowerCase() === 'user') {
      return { success: false, error: 'System roles cannot be deleted.' };
    }

    if (assignedCount > 0) {
      return {
        success: false,
        error: 'This role cannot be deleted because it is assigned to one or more users. Reassign those users to another role before deleting it.',
      };
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('roles').delete().eq('id', id);
        if (error) {
          const isRls = checkIsRlsError(error);
          if (isRls) {
            return {
              success: false,
              error: `Row-Level Security (RLS) policy blocked role deletion: ${error.message}.`,
              isRlsBlocked: true,
            };
          }
          return {
            success: false,
            error: `Database error (${error.code || 'unknown'}): ${error.message}`,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to delete role in Supabase: ${msg}` };
      }
    }

    rolesData = rolesData.filter((r) => r.id !== id);
    savePersistedRoles(rolesData);
    notify();
    return { success: true };
  },
};
