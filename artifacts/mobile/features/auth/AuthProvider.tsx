/**
 * Authentication context provider.
 *
 * Wraps the app and exposes auth state + methods via useAuth().
 * Listens to Supabase auth state changes and keeps the context
 * in sync automatically.
 *
 * When Supabase credentials are not yet configured, the provider
 * starts in a safe "unauthenticated, not loading" state so the
 * app renders normally without crashing.
 *
 * Usage:
 *   Wrap your root layout with <AuthProvider>.
 *   In any component: const { user, isAuthenticated, signIn } = useAuth();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService } from '@/services/auth.service';
import type {
  AuthState,
  AuthUser,
  SignInCredentials,
  SignUpCredentials,
} from '@/types/auth.types';

interface AuthContextValue extends AuthState {
  signIn: (credentials: SignInCredentials) => Promise<{ error: string | null }>;
  signUp: (credentials: SignUpCredentials) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const UNAUTHENTICATED: AuthState = {
  user: null,
  session: null,
  isLoading: false,
  isAuthenticated: false,
  isAnonymous: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...UNAUTHENTICATED, isLoading: true });

  useEffect(() => {
    // If Supabase is not configured, run in offline-safe mode.
    // Authentication setup is pending — account creation will be
    // enabled after Supabase is connected.
    if (!authService.isConfigured()) {
      if (__DEV__) {
        console.info(
          '[Worlds] Authentication setup is pending. Account creation will be enabled after Supabase is connected.'
        );
      }
      setState(UNAUTHENTICATED);
      return;
    }

    // Load initial session on mount
    authService
      .getSession()
      .then(({ session }) => {
        if (session) {
          const user: AuthUser = {
            id: session.user.id,
            email: session.user.email ?? null,
            phone: session.user.phone ?? null,
            role: 'registered',
            createdAt: session.user.created_at,
            updatedAt: session.user.updated_at ?? session.user.created_at,
          };
          setState({
            user,
            session: null,
            isLoading: false,
            isAuthenticated: true,
            isAnonymous: false,
          });
        } else {
          setState(UNAUTHENTICATED);
        }
      })
      .catch(() => {
        setState(UNAUTHENTICATED);
      });

    // Listen to real-time auth changes
    let unsubscribe: (() => void) | null = null;
    try {
      const { data: listener } = authService.onAuthStateChange((_, session) => {
        if (session?.user) {
          const user: AuthUser = {
            id: session.user.id,
            email: session.user.email ?? null,
            phone: session.user.phone ?? null,
            role: 'registered',
            createdAt: session.user.created_at,
            updatedAt: session.user.updated_at ?? session.user.created_at,
          };
          setState({
            user,
            session: null,
            isLoading: false,
            isAuthenticated: true,
            isAnonymous: false,
          });
        } else {
          setState(UNAUTHENTICATED);
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    } catch {
      setState(UNAUTHENTICATED);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (credentials: SignInCredentials) => {
    if (!authService.isConfigured()) {
      return { error: 'Supabase is not configured. Add credentials to .env.' };
    }
    const { error } = await authService.signIn(credentials);
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    if (!authService.isConfigured()) {
      return { error: 'Supabase is not configured. Add credentials to .env.' };
    }
    const { error } = await authService.signUp(credentials);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!authService.isConfigured()) return;
    await authService.signOut();
    setState(UNAUTHENTICATED);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signUp, signOut }),
    [state, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}
