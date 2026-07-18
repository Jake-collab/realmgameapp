/**
 * Authentication service layer.
 *
 * Wraps Supabase auth methods with typed interfaces.
 * All auth state is managed via the AuthProvider (features/auth/AuthProvider.tsx).
 * Use the useAuth() hook in components — do not import this service directly.
 */

import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import type {
  AuthError,
  AuthUser,
  SignInCredentials,
  SignUpCredentials,
  UserRole,
} from '@/types/auth.types';

function mapRole(supabaseRole?: string): UserRole {
  const allowed: UserRole[] = [
    'anonymous',
    'registered',
    'moderator',
    'creator',
    'administrator',
  ];
  return allowed.includes(supabaseRole as UserRole)
    ? (supabaseRole as UserRole)
    : 'registered';
}

function mapError(error: { message: string; code?: string } | null): AuthError | null {
  if (!error) return null;
  return { code: error.code ?? 'unknown', message: error.message };
}

export const authService = {
  /** Returns true when Supabase credentials are configured */
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  /** Sign in with email and password */
  async signIn(credentials: SignInCredentials): Promise<{
    user: AuthUser | null;
    error: AuthError | null;
  }> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword(credentials);

    if (error || !data.user) {
      return { user: null, error: mapError(error) };
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
      role: mapRole(data.user.role),
      createdAt: data.user.created_at,
      updatedAt: data.user.updated_at ?? data.user.created_at,
    };

    return { user, error: null };
  },

  /** Sign up with email and password */
  async signUp(credentials: SignUpCredentials): Promise<{
    user: AuthUser | null;
    error: AuthError | null;
  }> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: { username: credentials.username },
      },
    });

    if (error || !data.user) {
      return { user: null, error: mapError(error) };
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
      role: 'registered',
      createdAt: data.user.created_at,
      updatedAt: data.user.updated_at ?? data.user.created_at,
    };

    return { user, error: null };
  },

  /** Sign out the current user */
  async signOut(): Promise<{ error: AuthError | null }> {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    return { error: mapError(error) };
  },

  /** Get the current session from storage */
  async getSession() {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    return { session: data.session, error: mapError(error) };
  },

  /** Listen for auth state changes */
  onAuthStateChange(
    callback: Parameters<ReturnType<typeof requireSupabase>['auth']['onAuthStateChange']>[0]
  ) {
    const client = requireSupabase();
    return client.auth.onAuthStateChange(callback);
  },
};
