/**
 * Authentication Provider — Worlds
 *
 * Implements a deterministic startup state machine and exposes all auth
 * operations via context. This is the single source of truth for auth state.
 *
 * State ownership:
 *   Supabase Auth → session identity (tokens, email, email_confirmed_at)
 *   AuthProvider  → startupState, session, user, profile, actions
 *   React Query   → profile/settings cached data (invalidated on logout)
 *   Zustand       → navigation prefs only (activeMode, tabs)
 *
 * Startup state machine:
 *   initializing                    → splash visible while checking
 *   configuration_missing           → Supabase not configured (dev-only notice)
 *   unauthenticated                 → no valid session → (auth) group
 *   authenticated_needs_verification→ session, email not confirmed → verify-email
 *   authenticated_needs_onboarding  → verified, onboarding incomplete → (onboarding)
 *   authenticated_suspended         → account suspended/deactivated → suspended notice
 *   authenticated_ready             → fully ready → (main) group
 *   error                           → unrecoverable startup failure
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService, type SignUpPayload } from '@/services/auth.service';
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import { authErrorMessage, normalizeAuthError } from '@/lib/auth/errorNormalizer';
import { analytics } from '@/lib/auth/analyticsHooks';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/lib/store';
import { offlineStorage } from '@/features/offline/storage/offlineStorage';
import { getPushInstallationId, unregisterCurrentDevice } from '@/features/notifications/push.service';
import type { AuthUser } from '@/types/auth.types';
import type { ProfileRow } from '@/lib/supabase/database.types';
import { logoutRevenueCat } from '@/features/revenue/services/revenueCat';

// ─── State machine ────────────────────────────────────────────────────────────

export type AuthStartupState =
  | 'initializing'
  | 'configuration_missing'
  | 'unauthenticated'
  | 'authenticated_needs_verification'
  | 'authenticated_needs_onboarding'
  | 'authenticated_suspended'
  | 'authenticated_ready'
  | 'error';

// ─── Context value ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  // ── State machine ───────────────────────────────────────────────────────
  startupState: AuthStartupState;

  // ── Auth identity ───────────────────────────────────────────────────────
  session: Session | null;
  user: AuthUser | null;

  // ── Profile ──────────────────────────────────────────────────────────────
  profile: ProfileRow | null;
  isProfileLoading: boolean;
  refreshProfile: () => Promise<void>;

  // ── Pending email verification ────────────────────────────────────────────
  pendingVerificationEmail: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  signIn: (credentials: { email: string; password: string }) => Promise<{ error: string | null }>;
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null; needsVerification: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string, redirectTo: string) => Promise<{ error: string | null }>;
  retryStartup: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Startup timeout ──────────────────────────────────────────────────────────

const STARTUP_TIMEOUT_MS = 8_000;

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [startupState, setStartupState] = useState<AuthStartupState>('initializing');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const { setHasOnboarded, setActiveMode, clearUnread, clearToasts } = useAppStore.getState();

  const resolveStartupStateRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // ── Core startup function ─────────────────────────────────────────────────

  const resolveStartupState = useCallback(async () => {
    // No Supabase credentials — development disconnected mode
    if (!isSupabaseConfigured()) {
      setStartupState('configuration_missing');
      setUser(null);
      setProfile(null);
      setSession(null);
      analytics.startupStateResolved('configuration_missing');
      return;
    }

    try {
      const { session: currentSession, error: sessionError } = await authService.getSession();

      if (sessionError) {
        setStartupState('error');
        return;
      }

      if (!currentSession?.user) {
        setStartupState('unauthenticated');
        setUser(null);
        setProfile(null);
        setSession(null);
        analytics.startupStateResolved('unauthenticated');
        return;
      }

      const sbUser = currentSession.user;

      const mappedUser: AuthUser = {
        id: sbUser.id,
        email: sbUser.email ?? null,
        phone: sbUser.phone ?? null,
        role: 'registered',
        createdAt: sbUser.created_at,
        updatedAt: sbUser.updated_at ?? sbUser.created_at,
      };

      setSession(currentSession);
      setUser(mappedUser);

      // Email verification check
      if (!sbUser.email_confirmed_at) {
        setPendingVerificationEmail(sbUser.email ?? null);
        setStartupState('authenticated_needs_verification');
        analytics.startupStateResolved('authenticated_needs_verification');
        return;
      }

      // Fetch profile
      setIsProfileLoading(true);
      const client = requireSupabase();
      const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      setIsProfileLoading(false);

      // Unexpected DB error (not "no rows found")
      if (profileError && !profileError.message?.includes('0 rows')) {
        if (__DEV__) console.warn('[AuthProvider] Profile fetch error:', profileError.message);
        setStartupState('error');
        return;
      }

      // Profile missing — attempt recovery
      if (!profileData) {
        analytics.profileRecoveryAttempted(sbUser.id);
        if (__DEV__) console.info('[AuthProvider] Profile missing — attempting recovery for', sbUser.id);

        try {
          const tempUsername = `user_${sbUser.id.replace(/-/g, '').slice(0, 10)}`;
          await client.from('profiles').insert({
            id: sbUser.id,
            username: tempUsername,
            display_name: String(sbUser.user_metadata?.display_name ?? 'Explorer'),
            onboarding_status: 'not_started',
          });

          const { data: recovered } = await client
            .from('profiles')
            .select('*')
            .eq('id', sbUser.id)
            .maybeSingle();

          if (recovered) {
            setProfile(recovered);
            setHasOnboarded(false);
            setStartupState('authenticated_needs_onboarding');
            analytics.startupStateResolved('authenticated_needs_onboarding');
            return;
          }
        } catch (recoveryErr) {
          if (__DEV__) console.warn('[AuthProvider] Profile recovery failed:', recoveryErr);
        }

        setStartupState('error');
        return;
      }

      setProfile(profileData);

      // Account status check
      if (profileData.account_status === 'suspended' || profileData.account_status === 'deactivated') {
        setStartupState('authenticated_suspended');
        analytics.startupStateResolved('authenticated_suspended');
        return;
      }

      // Onboarding check
      if (profileData.onboarding_status !== 'completed') {
        setHasOnboarded(false);
        // Sync preferred game mode from profile
        if (profileData.preferred_game_mode) {
          setActiveMode(profileData.preferred_game_mode as 'quest' | 'hunt');
        }
        setStartupState('authenticated_needs_onboarding');
        analytics.startupStateResolved('authenticated_needs_onboarding');
        return;
      }

      // All checks passed
      setHasOnboarded(true);
      if (profileData.preferred_game_mode) {
        setActiveMode(profileData.preferred_game_mode as 'quest' | 'hunt');
      }
      setStartupState('authenticated_ready');
      analytics.startupStateResolved('authenticated_ready');
    } catch (err) {
      if (__DEV__) console.warn('[AuthProvider] Startup error:', err);
      setStartupState('error');
    }
  }, [setHasOnboarded, setActiveMode]);

  // Store ref for use in effects
  resolveStartupStateRef.current = resolveStartupState;

  // ── Initial startup with timeout ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setStartupState((current) => {
        if (current === 'initializing') {
          if (__DEV__) console.warn('[AuthProvider] Startup timed out after 8s');
          return 'error';
        }
        return current;
      });
    }, STARTUP_TIMEOUT_MS);

    resolveStartupStateRef.current?.().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []); // runs once on mount

  // ── Auth state subscription ───────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = authService.onAuthStateChange((event) => {
      if (__DEV__) console.info('[AuthProvider] Auth event:', event);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        resolveStartupStateRef.current?.();
      } else if (event === 'SIGNED_OUT') {
        setStartupState('unauthenticated');
        setUser(null);
        setProfile(null);
        setSession(null);
        setHasOnboarded(false);
        analytics.startupStateResolved('unauthenticated');
      } else if (event === 'TOKEN_REFRESHED') {
        // Session refreshed automatically — re-fetch session to stay current
        resolveStartupStateRef.current?.();
      }
      // Password recovery routing and its short-lived session marker are handled
      // by the callback screen before it opens reset-password.
    });

    return () => subscription.unsubscribe();
  }, [setHasOnboarded]);

  // ── Profile refresh ───────────────────────────────────────────────────────

  const refreshProfile = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    const client = requireSupabase();
    setIsProfileLoading(true);
    try {
      const { data } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setProfile(data);
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]);

  // ── Sign in ───────────────────────────────────────────────────────────────

  const signIn = useCallback(async (credentials: { email: string; password: string }) => {
    if (!authService.isConfigured()) {
      return {
        error: __DEV__
          ? 'Authentication setup is pending. Account creation and login will be enabled after Supabase is connected.'
          : 'Service is temporarily unavailable. Please try again later.',
      };
    }

    const { error } = await authService.signIn(credentials);
    if (error) {
      const normalized = normalizeAuthError(error);
      analytics.loginFailed(normalized.category);
      return { error: normalized.message };
    }

    // onAuthStateChange SIGNED_IN will fire and call resolveStartupState
    return { error: null };
  }, []);

  // ── Sign up ───────────────────────────────────────────────────────────────

  const signUp = useCallback(async (payload: SignUpPayload) => {
    if (!authService.isConfigured()) {
      return {
        error: __DEV__
          ? 'Authentication setup is pending. Account creation and login will be enabled after Supabase is connected.'
          : 'Service is temporarily unavailable. Please try again later.',
        needsVerification: false,
      };
    }

    const result = await authService.signUp(payload);

    if (result.error) {
      return { error: authErrorMessage(result.error), needsVerification: false };
    }

    if (result.needsVerification) {
      setPendingVerificationEmail(payload.email.toLowerCase().trim());
      analytics.signupVerificationRequired();
      return { error: null, needsVerification: true };
    }

    // Session available immediately — update profile and record legal acceptance
    if (result.user?.id) {
      const client = requireSupabase();
      analytics.signupCompleted(result.user.id);

      // Update profile fields (the DB trigger sets them from metadata, but ensure consistency)
      client
        .from('profiles')
        .update({
          username: payload.username.toLowerCase().trim(),
          display_name: payload.displayName.trim(),
          onboarding_status: 'in_progress',
        })
        .eq('id', result.user.id)
        .then(({ error: updateError }) => {
          if (updateError && __DEV__) {
            console.warn('[AuthProvider] Profile update after signup:', updateError.message);
          }
        });

      // Record legal acceptance (non-fatal if fails)
      client
        .from('legal_acceptances')
        .insert([
          {
            user_id: result.user.id,
            document_type: 'terms',
            document_version: payload.acceptedTermsVersion,
          },
          {
            user_id: result.user.id,
            document_type: 'privacy',
            document_version: payload.acceptedPrivacyVersion,
          },
        ])
        .then(({ error: legalError }) => {
          if (legalError && __DEV__) {
            console.warn('[AuthProvider] Legal acceptance record:', legalError.message);
          }
        });
    }

    // onAuthStateChange will fire and update state
    return { error: null, needsVerification: false };
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    const signedOutUserId = user?.id;
    if (signedOutUserId) {
      // Must happen before the session is cleared: the device RPC is owner-scoped.
      await getPushInstallationId().then(unregisterCurrentDevice).catch(() => undefined);
    }
    await logoutRevenueCat();

    // Clear local state before attempting the network request. This keeps a
    // failed or unavailable remote sign-out from leaving private data visible.
    queryClient.clear();
    clearUnread();
    clearToasts();
    setStartupState('unauthenticated');
    setUser(null);
    setProfile(null);
    setSession(null);
    setHasOnboarded(false);

    // Offline query snapshots, queued mutations, and local proof assets are
    // user-scoped sensitive data. Signing out explicitly discards them.
    if (signedOutUserId) {
      await offlineStorage.clearUser(signedOutUserId).catch((error) => {
        if (__DEV__) console.warn('[AuthProvider] Local sign-out cleanup:', error);
      });
    }

    if (!authService.isConfigured()) {
      analytics.logoutCompleted();
      return;
    }

    try {
      const { error } = await authService.signOut();
      if (error && __DEV__) {
        console.warn('[AuthProvider] signOut error:', error.message);
      }
    } catch (error) {
      // Local state is already cleared, so a network or client failure must
      // not prevent the user from reaching the auth flow.
      if (__DEV__) console.warn('[AuthProvider] signOut request failed:', error);
    }

    analytics.logoutCompleted();
  }, [user?.id, clearUnread, clearToasts, setHasOnboarded]);

  // ── Password recovery ─────────────────────────────────────────────────────

  const requestPasswordReset = useCallback(
    async (email: string, redirectTo: string) => {
      if (!authService.isConfigured()) {
        return { error: 'Service is temporarily unavailable.' };
      }
      const { error } = await authService.resetPasswordForEmail(email, redirectTo);
      if (!error) analytics.passwordResetRequested();
      return { error: error ? authErrorMessage(error) : null };
    },
    []
  );

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!authService.isConfigured()) {
      return { error: 'Service is temporarily unavailable.' };
    }
    const { error } = await authService.updatePassword(newPassword);
    if (!error) analytics.passwordUpdated();
    return { error: error ? authErrorMessage(error) : null };
  }, []);

  // ── Email verification ────────────────────────────────────────────────────

  const resendVerification = useCallback(
    async (email: string, redirectTo: string) => {
      if (!authService.isConfigured()) {
        return { error: 'Service is temporarily unavailable.' };
      }
      const { error } = await authService.resendVerificationEmail(email, redirectTo);
      if (!error) analytics.emailVerificationResent();
      return { error: error ? authErrorMessage(error) : null };
    },
    []
  );

  // ── Retry startup ─────────────────────────────────────────────────────────

  const retryStartup = useCallback(() => {
    setStartupState('initializing');
    resolveStartupStateRef.current?.();
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      startupState,
      session,
      user,
      profile,
      isProfileLoading,
      refreshProfile,
      pendingVerificationEmail,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendVerification,
      retryStartup,
    }),
    [
      startupState, session, user, profile, isProfileLoading, refreshProfile,
      pendingVerificationEmail, signIn, signUp, signOut, requestPasswordReset,
      updatePassword, resendVerification, retryStartup,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}
