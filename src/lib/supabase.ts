import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to normalize Supabase Project URL (strips /rest/v1 if inadvertently pasted)
export function normalizeSupabaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (url.endsWith('/rest/v1/')) {
    url = url.slice(0, -9);
  } else if (url.endsWith('/rest/v1')) {
    url = url.slice(0, -8);
  }
  return url.replace(/\/+$/, '');
}

// Helper to safely read env variables in both Vite browser runtime and Node/test environments
function getEnvVar(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
      return import.meta.env[key];
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
      return process.env[key]!;
    }
  } catch {
    // ignore
  }
  return '';
}

// Read configuration from Vite environment variables
const rawSupabaseUrl = getEnvVar('VITE_SUPABASE_URL').trim();
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY').trim();

/**
 * Checks whether valid Supabase credentials have been configured in environment variables.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey !== 'your-anon-publishable-key' &&
    !supabaseUrl.includes('placeholder')
);

/**
 * Database schema type definitions for public tables
 * based on the current database setup:
 * - public.roles
 * - public.app_users
 */
export interface DatabaseRole {
  id: string;
  name: string;
  description: string | null;
  status: 'Active' | 'Inactive' | string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseAppUser {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: string;
  status: 'Active' | 'Inactive' | 'active' | 'inactive' | string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseProject {
  id: string;
  name: string;
  description: string | null;
  status: 'Active' | 'Inactive' | 'Completed' | string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseTask {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  start_date: string;
  due_date: string;
  status: string;
  incomplete_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: DatabaseRole;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: 'Active' | 'Inactive' | string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: 'Active' | 'Inactive' | string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_users: {
        Row: DatabaseAppUser;
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          full_name: string;
          email: string;
          phone?: string | null;
          role_id: string;
          status?: 'Active' | 'Inactive' | 'active' | 'inactive' | string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          full_name?: string;
          email?: string;
          phone?: string | null;
          role_id?: string;
          status?: 'Active' | 'Inactive' | 'active' | 'inactive' | string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: string;
            columns: string[];
            isOneToOne: boolean;
            referencedRelation: string;
            referencedColumns: string[];
          }
        ];
      };
      projects: {
        Row: DatabaseProject;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: string;
            columns: string[];
            isOneToOne: boolean;
            referencedRelation: string;
            referencedColumns: string[];
          }
        ];
      };
      tasks: {
        Row: DatabaseTask;
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          project_id?: string | null;
          assigned_to?: string | null;
          assigned_by?: string | null;
          start_date: string;
          due_date: string;
          status?: string;
          incomplete_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          project_id?: string | null;
          assigned_to?: string | null;
          assigned_by?: string | null;
          start_date?: string;
          due_date?: string;
          status?: string;
          incomplete_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: string;
            columns: string[];
            isOneToOne: boolean;
            referencedRelation: string;
            referencedColumns: string[];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/**
 * Reusable Supabase client instance.
 * Uses placeholder values when environment variables are not yet configured
 * to prevent module import or startup crashes.
 */
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export type SupabaseConnectionStatus =
  | 'connected'
  | 'rls_restricted'
  | 'auth_error'
  | 'network_error'
  | 'missing_config';

export interface SupabaseConnectionTestResult {
  isConfigured: boolean;
  canConnect: boolean;
  status: SupabaseConnectionStatus;
  message: string;
  httpStatus?: number;
  details?: unknown;
}

/**
 * Tests communication with the Supabase project.
 * Uses a minimal query against 'public.roles' to verify API reachability
 * without violating or modifying Row Level Security (RLS) policies.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionTestResult> {
  if (!isSupabaseConfigured) {
    return {
      isConfigured: false,
      canConnect: false,
      status: 'missing_config',
      message:
        'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing or set to placeholders.',
    };
  }

  try {
    // Perform a lightweight query against the 'roles' table.
    // count: 'exact' with head: true issues a HEAD request which tests reachability
    // and returns headers/status without transferring full row payloads.
    const { data, error, status, statusText } = await supabase
      .from('roles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // 401 Unauthorized indicates invalid API key / anon key
      if (status === 401) {
        return {
          isConfigured: true,
          canConnect: false,
          status: 'auth_error',
          httpStatus: status,
          message: `Supabase authentication failed (${status}): ${error.message}. Please verify VITE_SUPABASE_ANON_KEY.`,
          details: error,
        };
      }

      // Check if blocked by Row Level Security (Postgres error code 42501 or message indicating permission/policy)
      const isRlsError =
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission') ||
        error.message.toLowerCase().includes('policy') ||
        error.message.toLowerCase().includes('row-level security');

      if (isRlsError) {
        return {
          isConfigured: true,
          canConnect: true,
          status: 'rls_restricted',
          httpStatus: status,
          message: `Connected to Supabase project successfully! Note: Query access is blocked by Row Level Security (RLS) policies (${error.message}).`,
          details: error,
        };
      }

      return {
        isConfigured: true,
        canConnect: false,
        status: 'network_error',
        httpStatus: status,
        message: `Supabase returned error status ${status} (${error.message}).`,
        details: error,
      };
    }

    return {
      isConfigured: true,
      canConnect: true,
      status: 'connected',
      httpStatus: status,
      message: `Successfully connected to Supabase project! (HTTP ${status} ${statusText || 'OK'})`,
      details: { data },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isConfigured: true,
      canConnect: false,
      status: 'network_error',
      message: `Failed to connect to Supabase: ${errorMsg}`,
      details: err,
    };
  }
}

// Expose connection test helper on window for developer verification in browser console
if (typeof window !== 'undefined') {
  (window as unknown as { __testSupabaseConnection: typeof testSupabaseConnection }).__testSupabaseConnection =
    testSupabaseConnection;
}
