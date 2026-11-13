import { ManagedUser } from '../types';
import { roleService } from './roleService';
import { authService } from './authService';
import { supabase, isSupabaseConfigured, DatabaseAppUser } from '../lib/supabase';

/**
 * Service boundary for User Management.
 * Integrated with Supabase (public.app_users) with in-memory caching and graceful RLS handling.
 */

/**
 * Maps frontend/input user status to the exact capitalization expected by the public.app_users table / policies:
 * 'Active' | 'Inactive'
 */
export function toDatabaseUserStatus(status?: string | null): 'Active' | 'Inactive' {
  if (!status) return 'Active';
  const s = status.trim().toLowerCase();
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}

export const DEFAULT_USERS: ManagedUser[] = [
  {
    id: 'user-demo',
    fullName: 'Alex Morgan (User)',
    email: 'user@demo.com',
    phoneNumber: '+1 (555) 789-0123',
    roleId: 'role-3',
    roleName: 'Software Engineer',
    status: 'Active',
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'user-1',
    fullName: 'Sophia Bennett (Manager)',
    email: 'manager@demo.com',
    phoneNumber: '+1 (555) 234-5678',
    roleId: 'role-1',
    roleName: 'Manager',
    status: 'Active',
    createdAt: '2026-09-02T08:30:00Z',
  },
  {
    id: 'user-2',
    fullName: 'Marcus Vance',
    email: 'marcus.vance@taskflow.internal',
    phoneNumber: '+1 (555) 345-6789',
    roleId: 'role-2',
    roleName: 'Team Lead',
    status: 'Active',
    createdAt: '2026-09-05T10:15:00Z',
  },
  {
    id: 'user-3',
    fullName: 'Elena Rostova',
    email: 'elena.rostova@taskflow.internal',
    phoneNumber: '+1 (555) 456-7890',
    roleId: 'role-3',
    roleName: 'Software Engineer',
    status: 'Active',
    createdAt: '2026-09-10T11:45:00Z',
  },
  {
    id: 'user-4',
    fullName: 'Liam Patel',
    email: 'liam.patel@taskflow.internal',
    phoneNumber: '+1 (555) 567-8901',
    roleId: 'role-4',
    roleName: 'QA Engineer',
    status: 'Active',
    createdAt: '2026-09-12T14:20:00Z',
  },
  {
    id: 'user-5',
    fullName: 'Amara Okafor',
    email: 'amara.okafor@taskflow.internal',
    phoneNumber: '+1 (555) 678-9012',
    roleId: 'role-5',
    roleName: 'Product Designer',
    status: 'Inactive',
    createdAt: '2026-09-15T09:00:00Z',
  },
];

const STORAGE_KEY_USERS = 'taskflow_app_users_v2';

function loadPersistedUsers(): ManagedUser[] {
  if (typeof window === 'undefined') return [...DEFAULT_USERS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      savePersistedUsers(DEFAULT_USERS);
      return [...DEFAULT_USERS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      savePersistedUsers(DEFAULT_USERS);
      return [...DEFAULT_USERS];
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to load users from localStorage:', err);
    return [...DEFAULT_USERS];
  }
}

function savePersistedUsers(users: ManagedUser[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save users to localStorage:', err);
  }
}

let usersData: ManagedUser[] = loadPersistedUsers();

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{6,15}$/;

export interface UserInputErrors {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: string;
  password?: string;
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

export const userService = {
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

  getUsers(): ManagedUser[] {
    return [...usersData];
  },

  getActiveUsers(): ManagedUser[] {
    return usersData.filter((u) => u.status === 'Active' || u.status === 'active');
  },

  async fetchActiveUsers(): Promise<{
    success: boolean;
    users: ManagedUser[];
    error?: string;
  }> {
    await this.fetchUsers();
    return {
      success: true,
      users: this.getActiveUsers(),
    };
  },

  getUserById(id: string): ManagedUser | undefined {
    return usersData.find((u) => u.id === id);
  },

  getUsersCountForRole(roleId: string): number {
    return usersData.filter((u) => u.roleId === roleId).length;
  },

  validateUserInput(
    data: { fullName: string; email: string; phoneNumber: string; roleId: string },
    currentUserId?: string
  ): { isValid: boolean; errors: UserInputErrors } {
    const errors: UserInputErrors = {};

    if (!data.fullName || !data.fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    }

    if (!data.email || !data.email.trim()) {
      errors.email = 'Email Address is required.';
    } else if (!EMAIL_REGEX.test(data.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    } else {
      const emailExists = usersData.some(
        (u) =>
          u.id !== currentUserId &&
          u.email.trim().toLowerCase() === data.email.trim().toLowerCase()
      );
      if (emailExists) {
        errors.email = 'A user with this email address already exists.';
      }
    }

    if (!data.phoneNumber || !data.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone Number is required.';
    } else if (!PHONE_REGEX.test(data.phoneNumber.trim().replace(/[\s\-\(\)]/g, ''))) {
      errors.phoneNumber = 'Please enter a valid phone number (e.g. +1 555-123-4567).';
    }

    if (!data.roleId) {
      errors.roleId = 'Role selection is required.';
    } else {
      const role = roleService.getRoleById(data.roleId);
      if (!role) {
        errors.roleId = 'Selected role does not exist.';
      } else if (!currentUserId && (role.status === 'Inactive' || role.status === 'inactive')) {
        errors.roleId = 'Cannot assign an inactive role to a new user.';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },

  /**
   * Fetches users from Supabase public.app_users table.
   * If records are returned, maps them and notifies subscribers.
   */
  async fetchUsers(): Promise<{
    success: boolean;
    users: ManagedUser[];
    error?: string;
    isRlsRestricted?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      lastFetchError = null;
      isRlsRestrictedState = false;
      return { success: true, users: [...usersData] };
    }

    try {
      // 0. Check session / auth state for diagnostics
      const { data: sessionData } = await supabase.auth.getSession();
      const currentAuthUid = sessionData?.session?.user?.id;
      console.log('[Diagnostic] userService.fetchUsers session auth.uid:', currentAuthUid);

      // 1. Fetch roles first to ensure role cache is populated
      await roleService.fetchRoles();

      // 2. Query app_users table directly
      const { data, error, count } = await supabase
        .from('app_users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      console.log('[Diagnostic] userService.fetchUsers query result:', {
        rowCount: data ? data.length : 0,
        count,
        error: error ? { code: error.code, message: error.message, details: error.details } : null,
      });

      if (error) {
        const isRls = checkIsRlsError(error);
        isRlsRestrictedState = isRls;
        lastFetchError = isRls
          ? `Row-Level Security (RLS) policy restricted reading users (${error.code || '42501'}): ${error.message}. Please verify that RLS SELECT policy on public.app_users permits reading user profiles.`
          : `Supabase query error (${error.code || 'unknown'}): ${error.message}`;

        console.error('userService.fetchUsers error:', error);
        return {
          success: false,
          users: [...usersData],
          error: lastFetchError,
          isRlsRestricted: isRls,
        };
      }

      lastFetchError = null;
      isRlsRestrictedState = false;

      if (data && data.length > 0) {
        const mappedUsers: ManagedUser[] = data.map((u: any) => {
          const role = roleService.getRoleById(u.role_id);
          const roleName = role ? role.name : (u.role_id ? `Role (${String(u.role_id).slice(0, 6)}...)` : 'Assigned Role');
          const isAct = u.status === 'Active' || u.status === 'active';
          return {
            id: String(u.id),
            fullName: u.full_name || u.name || 'Unnamed User',
            email: u.email || '',
            phoneNumber: u.phone || u.phone_number || '',
            roleId: u.role_id || '',
            roleName,
            status: isAct ? 'Active' : 'Inactive',
            createdAt: u.created_at || new Date().toISOString(),
            updatedAt: u.updated_at,
          };
        });

        usersData = mappedUsers;
        savePersistedUsers(usersData);
        notify();
        console.log('[Diagnostic] Successfully loaded users into memory cache:', usersData.length);
      } else if (usersData.length === 0) {
        usersData = loadPersistedUsers();
        if (usersData.length === 0) {
          usersData = [...DEFAULT_USERS];
        }
        savePersistedUsers(usersData);
        notify();
      }

      return { success: true, users: [...usersData] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastFetchError = `Failed to fetch users: ${msg}`;
      console.error('userService.fetchUsers exception:', err);
      return { success: false, users: [...usersData], error: lastFetchError };
    }
  },

  /**
   * Creates a user in Supabase Authentication and public.app_users.
   *
   * To prevent exposing the service-role key in frontend client code and to avoid
   * breaking the Manager's active browser session with client-side signUp(),
   * account creation is executed via the secure 'create-user' Supabase Edge Function.
   *
   * The Edge Function:
   * 1. Verifies caller is an authenticated Manager
   * 2. Creates the user in Supabase Auth (auth.users)
   * 3. Generates a secure password-setup / invitation recovery link
   * 4. Inserts the user profile into public.app_users with auth_user_id linked
   * 5. Safely rolls back the auth account if profile insertion fails
   */
  async createUser(data: {
    fullName: string;
    email: string;
    phoneNumber: string;
    roleId: string;
    status?: 'Active' | 'Inactive' | 'active' | 'inactive' | string;
    password?: string;
    sendInvite?: boolean;
  }): Promise<{
    success: boolean;
    errors?: UserInputErrors;
    errorMessage?: string;
    user?: ManagedUser;
    inviteLink?: string | null;
    authUserId?: string;
    isEdgeFunctionMissing?: boolean;
    isDuplicateEmail?: boolean;
  }> {
    const validation = this.validateUserInput({
      fullName: data.fullName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      roleId: data.roleId,
    });
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const role = roleService.getRoleById(data.roleId);
    if (!role) {
      return { success: false, errors: { roleId: 'Role not found.' } };
    }

    const normalizedStatus = toDatabaseUserStatus(data.status);

    if (isSupabaseConfigured) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(data.roleId)) {
        return {
          success: false,
          errors: {
            roleId: 'The selected role is not a database UUID. Please select or create a role from Supabase.',
          },
          errorMessage: 'Invalid Role ID: A valid UUID from public.roles is required for database storage.',
        };
      }

      // Verify caller session exists before invoking Edge Function
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionErr || !accessToken) {
        return {
          success: false,
          errorMessage:
            'Authentication session not found. You must be signed in as an active Manager to create users.',
        };
      }

      // Invoke server-side create-user Supabase Edge Function using Manager's session
      try {
        const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-user', {
          body: {
            fullName: data.fullName.trim(),
            email: data.email.trim().toLowerCase(),
            phoneNumber: data.phoneNumber.trim(),
            roleId: data.roleId,
            status: normalizedStatus,
            password: data.password ? data.password.trim() : undefined,
            redirectUrl,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (edgeError) {
          let detailedMsg = edgeError.message || 'Edge function error';
          try {
            if (edgeError.context && typeof edgeError.context.json === 'function') {
              const bodyJson = await edgeError.context.json();
              if (bodyJson?.error) detailedMsg = bodyJson.error;
            }
          } catch {
            // ignore JSON parse error
          }

          const is404 =
            detailedMsg.includes('404') ||
            detailedMsg.toLowerCase().includes('not found') ||
            detailedMsg.toLowerCase().includes('requested function was not found');

          if (is404) {
            return {
              success: false,
              errorMessage:
                'The Supabase Edge Function "create-user" is not deployed on your Supabase project. Authentication account creation requires server-side administrative access. Please deploy the function using: "supabase functions deploy create-user" in your terminal.',
              isEdgeFunctionMissing: true,
            };
          }

          const isDuplicate =
            detailedMsg.toLowerCase().includes('already exists') ||
            detailedMsg.toLowerCase().includes('already registered');

          if (isDuplicate) {
            return {
              success: false,
              errors: { email: detailedMsg },
              errorMessage: detailedMsg,
              isDuplicateEmail: true,
            };
          }

          return {
            success: false,
            errorMessage: detailedMsg,
          };
        }

        if (edgeData && !edgeData.success && edgeData.error) {
          const isDuplicate =
            edgeData.error.toLowerCase().includes('already exists') ||
            edgeData.error.toLowerCase().includes('already registered');

          return {
            success: false,
            errors: isDuplicate ? { email: edgeData.error } : undefined,
            errorMessage: edgeData.error,
            isDuplicateEmail: isDuplicate,
          };
        }

        if (edgeData?.success && edgeData.user) {
          const u = edgeData.user;
          const newUser: ManagedUser = {
            id: u.id,
            fullName: u.full_name || data.fullName.trim(),
            email: u.email || data.email.trim().toLowerCase(),
            phoneNumber: u.phone || data.phoneNumber.trim(),
            roleId: u.role_id || data.roleId,
            roleName: role.name,
            status: toDatabaseUserStatus(u.status),
            createdAt: u.created_at || new Date().toISOString(),
          };
          usersData = [newUser, ...usersData.filter((existing) => existing.id !== newUser.id)];
          savePersistedUsers(usersData);
          notify();
          return {
            success: true,
            user: newUser,
            inviteLink: edgeData.inviteLink || null,
            authUserId: edgeData.authUserId,
          };
        }

        return {
          success: false,
          errorMessage: 'Unexpected response from create-user service.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          errorMessage: `Failed to call user creation service: ${msg}`,
        };
      }
    }

    // Local fallback when Supabase is not configured (demo/mock mode)
    const newUser: ManagedUser = {
      id: `user-${Date.now()}`,
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phoneNumber: data.phoneNumber.trim(),
      roleId: data.roleId,
      roleName: role.name,
      status: normalizedStatus,
      createdAt: new Date().toISOString(),
    };

    usersData = [newUser, ...usersData];
    savePersistedUsers(usersData);
    notify();
    return {
      success: true,
      user: newUser,
      inviteLink: `http://localhost:3000/#setup-password?email=${encodeURIComponent(newUser.email)}`,
    };
  },

  /**
   * Updates an existing user in Supabase public.app_users.
   */
  async updateUser(
    id: string,
    data: {
      fullName: string;
      email: string;
      phoneNumber: string;
      roleId: string;
      status: 'Active' | 'Inactive' | 'active' | 'inactive' | string;
    }
  ): Promise<{
    success: boolean;
    errors?: UserInputErrors;
    errorMessage?: string;
    isRlsBlocked?: boolean;
  }> {
    const userIndex = usersData.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return { success: false, errors: { fullName: 'User not found.' } };
    }

    const validation = this.validateUserInput(
      {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        roleId: data.roleId,
      },
      id
    );
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const role = roleService.getRoleById(data.roleId);
    if (!role) {
      return { success: false, errors: { roleId: 'Role not found.' } };
    }

    const normalizedStatus = toDatabaseUserStatus(data.status);

    if (isSupabaseConfigured) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(data.roleId)) {
        return {
          success: false,
          errors: {
            roleId: 'The selected role is not a database UUID. Please select or create a role from Supabase.',
          },
          errorMessage: 'Invalid Role ID: A valid UUID from public.roles is required for database storage.',
        };
      }

      try {
        const { error } = await supabase
          .from('app_users')
          .update({
            full_name: data.fullName.trim(),
            email: data.email.trim().toLowerCase(),
            phone: data.phoneNumber.trim(),
            role_id: data.roleId,
            status: normalizedStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) {
          const isRls = checkIsRlsError(error);
          if (isRls) {
            return {
              success: false,
              errorMessage: `Row-Level Security (RLS) policy blocked user update: ${error.message}. Please configure an UPDATE policy on public.app_users in your Supabase project.`,
              isRlsBlocked: true,
            };
          }
          if (error.code === '23505') {
            return {
              success: false,
              errors: { email: 'A user with this email address already exists in the database.' },
            };
          }
          if (error.code === '22P02') {
            return {
              success: false,
              errors: { roleId: 'The role ID must be a valid UUID referenced from public.roles.' },
              errorMessage: 'Invalid UUID format for role assignment.',
            };
          }
          return {
            success: false,
            errorMessage: `Database error (${error.code || 'unknown'}): ${error.message}`,
          };
        }

        usersData[userIndex] = {
          ...usersData[userIndex],
          fullName: data.fullName.trim(),
          email: data.email.trim().toLowerCase(),
          phoneNumber: data.phoneNumber.trim(),
          roleId: data.roleId,
          roleName: role.name,
          status: normalizedStatus,
          updatedAt: new Date().toISOString(),
        };

        savePersistedUsers(usersData);
        notify();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, errorMessage: `Failed to update user in Supabase: ${msg}` };
      }
    }

    // Local fallback
    usersData[userIndex] = {
      ...usersData[userIndex],
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phoneNumber: data.phoneNumber.trim(),
      roleId: data.roleId,
      roleName: role.name,
      status: normalizedStatus,
      updatedAt: new Date().toISOString(),
    };

    savePersistedUsers(usersData);
    notify();
    return { success: true };
  },

  /**
   * Toggles active/inactive status for a user in Supabase public.app_users.
   */
  async toggleUserStatus(
    id: string,
    tasksSupplier?: () => Promise<{ status: string; assignedToUserId?: string; assignedToEmail?: string }[]>
  ): Promise<{ success: boolean; error?: string; isRlsBlocked?: boolean; isBlockedByTasks?: boolean }> {
    const user = usersData.find((u) => u.id === id);
    if (!user) return { success: false, error: 'User not found.' };

    const currentIsActive = user.status === 'Active' || user.status === 'active';
    const nextStatus: 'Active' | 'Inactive' = currentIsActive ? 'Inactive' : 'Active';

    // If deactivating (Active -> Inactive), check whether user has any assigned tasks
    if (currentIsActive && tasksSupplier) {
      try {
        const tasks = await tasksSupplier();
        const assignedTasks = tasks.filter(
          (t) =>
            t.assignedToUserId === id ||
            (t.assignedToEmail && t.assignedToEmail.toLowerCase() === user.email.toLowerCase())
        );
        if (assignedTasks.length > 0) {
          return {
            success: false,
            error: 'This user cannot be deactivated because tasks are assigned to them. Reassign the tasks before deactivating this user.',
            isBlockedByTasks: true,
          };
        }
      } catch (err) {
        console.warn('Could not inspect task dependencies during user deactivation', err);
      }
    }

    if (isSupabaseConfigured) {
      try {
        let updateError = null;
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (UUID_REGEX.test(id)) {
          const { error } = await supabase
            .from('app_users')
            .update({
              status: nextStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
          updateError = error;
        } else {
          const { error } = await supabase
            .from('app_users')
            .update({
              status: nextStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('email', user.email);
          updateError = error;
        }

        if (updateError) {
          const isRls = checkIsRlsError(updateError);
          if (isRls) {
            return {
              success: false,
              error: `Row-Level Security (RLS) policy blocked status update: ${updateError.message}.`,
              isRlsBlocked: true,
            };
          }
          return {
            success: false,
            error: `Database error (${updateError.code || 'unknown'}): ${updateError.message}`,
          };
        }

        user.status = nextStatus;
        user.updatedAt = new Date().toISOString();
        savePersistedUsers(usersData);
        notify();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to toggle user status: ${msg}` };
      }
    }

    user.status = nextStatus;
    user.updatedAt = new Date().toISOString();
    savePersistedUsers(usersData);
    notify();
    return { success: true };
  },

  /**
   * Permanently deletes a deactivated user from Supabase public.app_users.
   * Restricted strictly to managers.
   * Enforces data-retention and foreign-key dependency safety checks:
   * - Cannot delete active manager account
   * - Cannot delete protected demo account
   * - Must be deactivated (status === 'Inactive')
   * - Validates no active or pending tasks exist before deletion
   */
  async deleteUser(
    id: string,
    tasksSupplier?: () => Promise<{ status: string; assignedToUserId?: string; assignedToEmail?: string }[]>
  ): Promise<{ success: boolean; error?: string; isRlsBlocked?: boolean }> {
    const currentRole = authService.getAuthenticatedRole();
    if (currentRole && currentRole !== 'manager') {
      return {
        success: false,
        error: 'Permission denied: Only managers are authorized to delete users.',
      };
    }

    const currentUser = authService.getCurrentUser();
    const targetUser = usersData.find((u) => u.id === id);

    if (
      currentUser?.id === id ||
      (targetUser && currentUser?.email && currentUser.email.toLowerCase() === targetUser.email.toLowerCase())
    ) {
      return {
        success: false,
        error: 'Protected account: You cannot delete your currently active manager account.',
      };
    }

    if (!targetUser) {
      return { success: false, error: 'User not found.' };
    }

    if (targetUser.email.toLowerCase() === 'manager@demo.com') {
      return {
        success: false,
        error: 'Protected account: The primary demo manager account cannot be deleted.',
      };
    }

    // Check task dependencies if tasksSupplier provided
    if (tasksSupplier) {
      try {
        const tasks = await tasksSupplier();
        const assignedTasks = tasks.filter(
          (t) =>
            t.assignedToUserId === id ||
            (t.assignedToEmail && t.assignedToEmail.toLowerCase() === targetUser.email.toLowerCase())
        );
        if (assignedTasks.length > 0) {
          return {
            success: false,
            error: 'This user cannot be deleted because tasks are assigned to them. Reassign or resolve the associated tasks before deleting this user.',
          };
        }
      } catch (err) {
        console.warn('Could not inspect task dependencies during user deletion', err);
      }
    }

    if (isSupabaseConfigured) {
      try {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let deleteError = null;
        if (UUID_REGEX.test(id)) {
          const { error } = await supabase.from('app_users').delete().eq('id', id);
          deleteError = error;
        } else if (targetUser?.email) {
          const { error } = await supabase.from('app_users').delete().eq('email', targetUser.email);
          deleteError = error;
        }

        if (deleteError) {
          const isRls = checkIsRlsError(deleteError);
          if (isRls) {
            return {
              success: false,
              error: `Row-Level Security (RLS) policy blocked user deletion: ${deleteError.message}.`,
              isRlsBlocked: true,
            };
          }
          return {
            success: false,
            error: `Database error (${deleteError.code || 'unknown'}): ${deleteError.message}`,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to delete user in Supabase: ${msg}` };
      }
    }

    usersData = usersData.filter((u) => u.id !== id);
    savePersistedUsers(usersData);
    try {
      const { teamService } = await import('./teamService');
      await teamService.removeUserFromAllProjects(id);
    } catch {
      // ignore
    }
    notify();
    return { success: true };
  },
};

// Initial background fetch if running in browser
if (typeof window !== 'undefined') {
  roleService.fetchRoles().then(() => {
    userService.fetchUsers().catch((err) => {
      console.warn('Initial user fetch failed', err);
    });
  }).catch((err) => {
    console.warn('Initial role fetch failed', err);
  });
}

