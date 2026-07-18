/**
 * Authentication service layer — Worlds
 *
 * Wraps Supabase auth methods with typed interfaces.
 * Auth state is managed via AuthProvider (features/auth/AuthProvider.tsx).
 * Use useAuth() in components — do not import this service directly in UI.
 *
 * State ownership:
 *   - Supabase Auth: source of truth for session identity and tokens
 *   - This service: provides typed wrappers and error normalization
 *   - AuthProvider: subscribes to state and exposes it via context
 *   - React Query: caches profile and settings data
 *   - Zustand: UI preferences (activeMode, tabs)
 */

import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import type {
  AuthError,
  AuthUser,
  SignInCredentials,
} from '@/types/auth.types';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignUpPayload {
  email: string;
  password: string;
  username: string;
  displayName: string;
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
}

export interface SignUpResult {
  user: AuthUser | null;
  session: Session | null;
  /** True when email confirmation is required before the session is active */
  needsVerification: boolean;
  error: AuthError | null;
}

// ─── Role mapping ─────────────────────────────────────────────────────────────

function mapRole(supabaseRole?: string): AuthUser['role'] {
  const allowed: AuthUser['role'][] = [
    'anonymous',
    'registered',
    'moderator',
    'creator',
    'administrator',
  ];
  return allowed.includes(supabaseRole as AuthUser['role'])
    ? (supabaseRole as AuthUser['role'])
    : 'registered';
}

function mapError(error: { message: string; code?: string } | null): AuthError | null {
  if (!error) return null;
  return { code: error.code ?? 'unknown', message: error.message };
}

function mapUser(sbUser: NonNullable<ReturnType<typeof requireSupabase>['auth']['getUser']> extends Promise<{ data: { user: infer U } }> ? U : never): AuthUser | null {
  if (!sbUser) return null;
  return {
    id: sbUser.id,
    email: sbUser.email ?? null,
    phone: sbUser.phone ?? null,
    role: mapRole(sbUser.user_metadata?.role),
    createdAt: sbUser.created_at,
    updatedAt: sbUser.updated_at ?? sbUser.created_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /** Returns true when Supabase credentials are configured */
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  // ── Sign in ──────────────────────────────────────────────────────────────

  async signIn(credentials: SignInCredentials): Promise<{
    user: AuthUser | null;
    session: Session | null;
    error: AuthError | null;
  }> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: credentials.email.toLowerCase().trim(),
      password: credentials.password,
    });

    if (error || !data.user) {
      return { user: null, session: null, error: mapError(error) };
    }

    return {
      user: mapUser(data.user as any),
      session: data.session,
      error: null,
    };
  },

  // ── Sign up ──────────────────────────────────────────────────────────────

  async signUp(payload: SignUpPayload): Promise<SignUpResult> {
    const client = requireSupabase();

    const { data, error } = await client.auth.signUp({
      email: payload.email.toLowerCase().trim(),
      password: payload.password,
      options: {
        data: {
          display_name: payload.displayName.trim(),
          username: payload.username.toLowerCase().trim(),
        },
      },
    });

    if (error) {
      return { user: null, session: null, needsVerification: false, error: mapError(error) };
    }

    if (!data.user) {
      return {
        user: null,
        session: null,
        needsVerification: false,
        error: { code: 'unknown', message: 'Account creation failed. Please try again.' },
      };
    }

    const needsVerification = !data.session;

    return {
      user: mapUser(data.user as any),
      session: data.session,
      needsVerification,
      error: null,
    };
  },

  // ── Sign out ─────────────────────────────────────────────────────────────

  async signOut(): Promise<{ error: AuthError | null }> {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    return { error: mapError(error) };
  },

  // ── Session management ───────────────────────────────────────────────────

  async getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    return { session: data.session, error: mapError(error) };
  },

  async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    const client = requireSupabase();
    const { data, error } = await client.auth.refreshSession();
    return { session: data.session, error: mapError(error) };
  },

  onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } } {
    const client = requireSupabase();
    return client.auth.onAuthStateChange(callback);
  },

  // ── Password recovery ────────────────────────────────────────────────────

  /**
   * Send a password-reset email.
   * Always returns a neutral response — do not reveal whether the email is registered.
   */
  async resetPasswordForEmail(
    email: string,
    redirectTo: string
  ): Promise<{ error: AuthError | null }> {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      { redirectTo }
    );
    // Suppress "user not found" — intentionally vague response
    if (error && (error.message?.toLowerCase().includes('user not found') ||
        error.message?.toLowerCase().includes('not registered'))) {
      return { error: null };
    }
    return { error: mapError(error) };
  },

  /**
   * Update the authenticated user's password.
   * Requires an active PASSWORD_RECOVERY session.
   */
  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password: newPassword });
    return { error: mapError(error) };
  },

  // ── Email verification ───────────────────────────────────────────────────

  /**
   * Resend the email verification message.
   * Supabase rate-limits this — callers should enforce their own cooldown.
   */
  async resendVerificationEmail(
    email: string,
    redirectTo: string
  ): Promise<{ error: AuthError | null }> {
    const client = requireSupabase();
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: redirectTo },
    });
    return { error: mapError(error) };
  },

  /**
   * Exchange an access token + refresh token for a session.
   * Called from the auth-callback screen when handling deep links.
   */
  async setSessionFromTokens(
    accessToken: string,
    refreshToken: string
  ): Promise<{ session: Session | null; error: AuthError | null }> {
    const client = requireSupabase();
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { session: data.session, error: mapError(error) };
  },

  // ── Profile update ────────────────────────────────────────────────────────

  /**
   * Update metadata on the Supabase Auth user record.
   * Used for display_name / username synchronization.
   */
  async updateUserMetadata(
    metadata: Record<string, string>
  ): Promise<{ error: AuthError | null }> {
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ data: metadata });
    return { error: mapError(error) };
  },
};
