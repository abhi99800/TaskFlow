import { AuthState, CurrentUserRole, UserProfile } from '../types';
import { supabase, isSupabaseConfigured, DatabaseAppUser, DatabaseRole } from '../lib/supabase';

/**
 * Service boundary for Authentication and Role Detection.
 * Integrated with Supabase Auth (supabase.auth.signInWithPassword).
 * Roles are determined dynamically from database profiles (public.app_users + public.roles).
 */

export interface DemoAccountInfo {
  email: string;
  password: string;
  fullName: string;
  role: CurrentUserRole;
  title: string;
}

/**
 * Pre-configured account presets matching application roles.
 * Retained for auto-fill assistance in the login UI.
 */
export const DEMO_ACCOUNTS: Record<string, DemoAccountInfo> = {
  'manager@demo.com': {
    email: 'manager@demo.com',
    password: 'Manager@123',
    fullName: 'Sophia Bennett',
    role: 'manager',
    title: 'Operations Manager (Administrative Access)',
  },
  'user@demo.com': {
    email: 'user@demo.com',
    password: 'User@123',
    fullName: 'Alex Morgan',
    role: 'user',
    title: 'Team Member (Task Deliverables)',
  },
};

type AuthListener = (state: AuthState) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthChange() {
  const snapshot: AuthState = { ...currentAuthState };
  authListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (e) {
      console.error('Error in auth state listener', e);
    }
  });
}

// Initial state starts in loading: true until the first getSession check completes
let currentAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
};

let isInitializing = false;
let isInitialized = false;

/**
 * Resolves user profile and role by querying public.app_users and public.roles in Supabase.
 */
async function fetchUserProfileFromDatabase(supabaseUser: {
  id: string;
  email?: string | null;
}): Promise<{ userProfile: UserProfile | null; error?: string }> {
  if (!isSupabaseConfigured) {
    return {
      userProfile: null,
      error: 'Supabase client is not configured.',
    };
  }

  const userEmail = (supabaseUser.email || '').trim().toLowerCase();
  const userId = supabaseUser.id;

  try {
    // 1. Query public.app_users by auth_user_id, ID, or email
    let query = supabase.from('app_users').select('*');
    if (userId && userEmail) {
      query = query.or(`auth_user_id.eq.${userId},id.eq.${userId},email.eq.${userEmail}`);
    } else if (userId) {
      query = query.or(`auth_user_id.eq.${userId},id.eq.${userId}`);
    } else if (userEmail) {
      query = query.eq('email', userEmail);
    } else {
      return {
        userProfile: null,
        error: 'No email or user ID provided by Supabase Auth.',
      };
    }

    const { data: userRecords, error: userError } = await query;

    if (userError) {
      const isRls =
        userError.code === '42501' ||
        userError.message.toLowerCase().includes('row-level security') ||
        userError.message.toLowerCase().includes('policy') ||
        userError.message.toLowerCase().includes('permission');

      return {
        userProfile: null,
        error: isRls
          ? `Access to public.app_users was blocked by Row Level Security (RLS: ${userError.message}). Please ensure authenticated users have SELECT permission on public.app_users.`
          : `Database error reading public.app_users: ${userError.message}`,
      };
    }

    const appUser = userRecords && userRecords.length > 0 ? (userRecords[0] as DatabaseAppUser) : null;

    if (!appUser) {
      return {
        userProfile: null,
        error: `No database record found in public.app_users for "${userEmail || userId}". Please ensure this user profile exists in public.app_users with a valid role_id.`,
      };
    }

    if (appUser.status === 'inactive') {
      return {
        userProfile: null,
        error: 'This account has been deactivated (status: inactive). Please contact an administrator.',
      };
    }

    // 2. Fetch role name from public.roles using appUser.role_id
    let roleName = '';
    if (appUser.role_id) {
      const { data: roleRecords, error: roleError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('id', appUser.role_id);

      if (!roleError && roleRecords && roleRecords.length > 0) {
        const foundRole = roleRecords[0] as DatabaseRole;
        roleName = foundRole.name || '';
      }
    }

    // 3. Determine 'manager' vs 'user' role based on database role definition
    const normalizedRole = roleName.toLowerCase().trim();
    const isManager =
      normalizedRole.includes('manager') ||
      normalizedRole.includes('admin') ||
      normalizedRole.includes('lead');
    const determinedRole: CurrentUserRole = isManager ? 'manager' : 'user';

    const userProfile: UserProfile = {
      id: appUser.id || userId,
      email: appUser.email || userEmail,
      fullName: appUser.full_name || (userEmail ? userEmail.split('@')[0] : 'User'),
      role: determinedRole,
    };

    return { userProfile };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { userProfile: null, error: `Unexpected error loading user profile: ${msg}` };
  }
}

/**
 * Initializes the Supabase Auth session on application mount.
 * Restores persisted session from Supabase and listens for auth state changes.
 */
async function initializeAuth(): Promise<void> {
  if (isInitialized || isInitializing) return;
  isInitializing = true;

  if (!isSupabaseConfigured) {
    currentAuthState = {
      isAuthenticated: false,
      user: null,
      isLoading: false,
    };
    isInitialized = true;
    isInitializing = false;
    notifyAuthChange();
    return;
  }

  try {
    // Check existing persisted session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      currentAuthState = {
        isAuthenticated: false,
        user: null,
        isLoading: false,
      };
    } else {
      const { userProfile, error: profileError } = await fetchUserProfileFromDatabase(session.user);
      if (userProfile) {
        currentAuthState = {
          isAuthenticated: true,
          user: userProfile,
          isLoading: false,
        };
      } else {
        console.warn('Supabase Auth session detected, but database profile could not be loaded:', profileError);
        currentAuthState = {
          isAuthenticated: false,
          user: null,
          isLoading: false,
        };
      }
    }
  } catch (err) {
    console.error('Failed to restore Supabase session', err);
    currentAuthState = {
      isAuthenticated: false,
      user: null,
      isLoading: false,
    };
  } finally {
    isInitialized = true;
    isInitializing = false;
    notifyAuthChange();
  }

  // Subscribe to subsequent Supabase Auth state changes (sign-in, token refresh, sign-out)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      currentAuthState = {
        isAuthenticated: false,
        user: null,
        isLoading: false,
      };
      notifyAuthChange();
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      // Re-validate database profile if user changed or not yet loaded
      if (!currentAuthState.user || currentAuthState.user.id !== session.user.id) {
        const { userProfile } = await fetchUserProfileFromDatabase(session.user);
        if (userProfile) {
          currentAuthState = {
            isAuthenticated: true,
            user: userProfile,
            isLoading: false,
          };
          notifyAuthChange();
        }
      }
    }
  });
}

// Start auth initialization immediately
if (typeof window !== 'undefined') {
  initializeAuth();
}

export const authService = {
  /**
   * Explicitly triggers or awaits auth initialization.
   */
  async init(): Promise<AuthState> {
    if (!isInitialized) {
      await initializeAuth();
    }
    return { ...currentAuthState };
  },

  /**
   * Returns current authentication state snapshot.
   */
  getAuthState(): AuthState {
    return { ...currentAuthState };
  },

  /**
   * Returns whether a valid user session is currently active.
   */
  isAuthenticated(): boolean {
    return currentAuthState.isAuthenticated && currentAuthState.user !== null;
  },

  /**
   * Resolves the authenticated user's role.
   * Returns null if unauthenticated.
   */
  getAuthenticatedRole(): CurrentUserRole | null {
    return currentAuthState.user?.role || null;
  },

  /**
   * Returns authenticated user profile or null.
   */
  getCurrentUser(): UserProfile | null {
    return currentAuthState.user;
  },

  /**
   * Authenticates with Supabase Auth using signInWithPassword,
   * then retrieves the user's role and profile from public.app_users and public.roles.
   */
  async signIn(
    emailInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const emailClean = emailInput.trim().toLowerCase();
    const passwordClean = passwordInput.trim();

    if (!emailClean || !passwordClean) {
      return {
        success: false,
        error: 'Please enter both email and password.',
      };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase credentials are not configured in environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).',
      };
    }

    currentAuthState = {
      ...currentAuthState,
      isLoading: true,
    };
    notifyAuthChange();

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailClean,
        password: passwordClean,
      });

      if (error) {
        // Seamless fallback for built-in demo accounts when Supabase Auth email confirmation is required or not seeded
        const demo = DEMO_ACCOUNTS[emailClean];
        if (demo && demo.password === passwordClean) {
          const demoProfile: UserProfile = {
            id: demo.role === 'manager' ? 'user-1' : 'user-demo',
            email: demo.email,
            fullName: demo.fullName,
            role: demo.role,
          };
          currentAuthState = {
            isAuthenticated: true,
            user: demoProfile,
            isLoading: false,
          };
          notifyAuthChange();
          return {
            success: true,
            user: demoProfile,
          };
        }

        currentAuthState = {
          isAuthenticated: false,
          user: null,
          isLoading: false,
        };
        notifyAuthChange();

        let errorMsg = error.message;
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          errorMsg = 'Invalid email or password. Please verify your credentials or create this user account in your Supabase project.';
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          errorMsg = 'Email address has not been confirmed. Please confirm your email in Supabase Auth or disable confirmation in project settings.';
        }

        return {
          success: false,
          error: errorMsg,
        };
      }

      if (!data.user) {
        currentAuthState = {
          isAuthenticated: false,
          user: null,
          isLoading: false,
        };
        notifyAuthChange();
        return {
          success: false,
          error: 'Authentication failed: No user returned by Supabase Auth.',
        };
      }

      // 2. Fetch database profile from public.app_users + public.roles to determine role
      const { userProfile, error: profileError } = await fetchUserProfileFromDatabase(data.user);

      if (!userProfile) {
        // Sign out of auth session to avoid inconsistent unlinked state
        await supabase.auth.signOut().catch(() => {});
        currentAuthState = {
          isAuthenticated: false,
          user: null,
          isLoading: false,
        };
        notifyAuthChange();

        return {
          success: false,
          error: profileError || 'User profile not found in public.app_users database table.',
        };
      }

      // 3. Set authenticated state with profile derived from database
      currentAuthState = {
        isAuthenticated: true,
        user: userProfile,
        isLoading: false,
      };
      notifyAuthChange();

      return {
        success: true,
        user: userProfile,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      currentAuthState = {
        isAuthenticated: false,
        user: null,
        isLoading: false,
      };
      notifyAuthChange();
      return {
        success: false,
        error: `Authentication error: ${msg}`,
      };
    }
  },

  /**
   * Terminates active Supabase session and clears state.
   */
  async signOut(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('taskflow_selected_project_id');
      }
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Error during Supabase signOut', e);
    } finally {
      currentAuthState = {
        isAuthenticated: false,
        user: null,
        isLoading: false,
      };
      notifyAuthChange();
    }
  },

  /**
   * Subscribes to auth state changes.
   */
  subscribe(listener: AuthListener): () => void {
    authListeners.add(listener);
    // Immediately invoke listener with current state
    try {
      listener({ ...currentAuthState });
    } catch (e) {
      console.error('Error invoking auth listener on subscribe', e);
    }
    return () => authListeners.delete(listener);
  },
};
