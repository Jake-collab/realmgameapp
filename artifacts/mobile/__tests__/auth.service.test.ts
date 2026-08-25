/**
 * Auth Service — Unit Tests
 *
 * Tests sign-in, sign-up, sign-out, password recovery, and error normalization.
 * Supabase client is mocked — no network calls are made.
 */

import { authService } from '@/services/auth.service';
import { normalizeAuthError, authErrorMessage } from '@/lib/auth/errorNormalizer';

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockResend = jest.fn();
const mockSetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}));

const mockSupabase = {
  auth: {
    signInWithPassword: mockSignIn,
    signUp: mockSignUp,
    signOut: mockSignOut,
    getSession: mockGetSession,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
    resend: mockResend,
    setSession: mockSetSession,
    exchangeCodeForSession: mockExchangeCodeForSession,
    onAuthStateChange: mockOnAuthStateChange,
  },
};

jest.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  requireSupabase: jest.fn(() => mockSupabase),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  phone: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_metadata: { role: 'registered' },
};

const mockSession = {
  access_token: 'tok_access',
  refresh_token: 'tok_refresh',
  user: mockUser,
};

beforeEach(() => jest.clearAllMocks());

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('authService.signIn', () => {
  it('returns user and session on success', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    const result = await authService.signIn({
      email: 'test@example.com',
      password: 'Password1',
    });

    expect(result.user?.id).toBe('user-123');
    expect(result.session).toBeDefined();
    expect(result.error).toBeNull();
  });

  it('lowercases and trims the email before sending', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    await authService.signIn({ email: '  TEST@Example.COM  ', password: 'pw' });

    expect(mockSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('returns error on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });

    const result = await authService.signIn({
      email: 'bad@example.com',
      password: 'wrong',
    });

    expect(result.user).toBeNull();
    expect(result.error?.code).toBe('invalid_credentials');
  });

  it('returns null user when signIn returns no user', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null, session: null }, error: null });
    const result = await authService.signIn({ email: 'x@x.com', password: 'pw' });
    expect(result.user).toBeNull();
    expect(result.error).toBeNull();
  });
});

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('authService.signUp', () => {
  const payload = {
    email: 'new@example.com',
    password: 'Password1',
    username: 'newuser',
    displayName: 'New User',
    acceptedTermsVersion: 'terms_v1_draft',
    acceptedPrivacyVersion: 'privacy_v1_draft',
  };

  it('returns needsVerification=true when session is null', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    });

    const result = await authService.signUp(payload);

    expect(result.needsVerification).toBe(true);
    expect(result.session).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns needsVerification=false when session is present', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    const result = await authService.signUp(payload);

    expect(result.needsVerification).toBe(false);
    expect(result.session).toBeDefined();
  });

  it('passes display_name and username as metadata', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    });

    await authService.signUp(payload);

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'worlds://auth-callback',
          data: expect.objectContaining({
            display_name: 'New User',
            username: 'newuser',
          }),
        }),
      })
    );
  });

  it('returns error on signUp failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', code: 'email_exists' },
    });

    const result = await authService.signUp(payload);

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('email_exists');
  });

  it('returns error when user is null and no error', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    const result = await authService.signUp(payload);
    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('unknown');
  });
});

// ─── callback session exchange ───────────────────────────────────────────────

describe('authService callback exchange', () => {
  it('exchanges a PKCE authorization code for a session', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const result = await authService.exchangeCodeForSession('pkce-code');

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(result.session?.access_token).toBe('tok_access');
  });

  it('only recognizes the session that came from a recovery callback', () => {
    authService.markPasswordRecoverySession(mockSession as any);

    expect(authService.isPasswordRecoverySession(mockSession as any)).toBe(true);
    expect(authService.isPasswordRecoverySession({ ...mockSession, access_token: 'other-token' } as any)).toBe(false);
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('authService.signOut', () => {
  it('calls supabase.auth.signOut and returns no error', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const result = await authService.signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
  });

  it('returns error if signOut fails', async () => {
    mockSignOut.mockResolvedValue({
      error: { message: 'Network error', code: 'network' },
    });

    const result = await authService.signOut();
    expect(result.error).not.toBeNull();
  });
});

// ─── getSession ───────────────────────────────────────────────────────────────

describe('authService.getSession', () => {
  it('returns the current session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const result = await authService.getSession();
    expect(result.session?.access_token).toBe('tok_access');
    expect(result.error).toBeNull();
  });

  it('returns null session when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await authService.getSession();
    expect(result.session).toBeNull();
  });
});

// ─── resetPasswordForEmail ────────────────────────────────────────────────────

describe('authService.resetPasswordForEmail', () => {
  it('calls with lowercased email and redirect URL', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await authService.resetPasswordForEmail('  TEST@Example.COM  ', 'worlds://auth-callback');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.objectContaining({ redirectTo: 'worlds://auth-callback' })
    );
  });

  it('suppresses user-not-found errors to avoid enumeration', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'User not found' },
    });

    const result = await authService.resetPasswordForEmail('unknown@x.com', 'worlds://auth-callback');
    expect(result.error).toBeNull();
  });

  it('returns error for other failure types', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded', code: 'over_request_rate_limit' },
    });

    const result = await authService.resetPasswordForEmail('x@x.com', 'worlds://auth-callback');
    expect(result.error).not.toBeNull();
  });
});

// ─── Error normalization ──────────────────────────────────────────────────────

describe('normalizeAuthError', () => {
  it('maps rate_limit to rate_limited', () => {
    const result = normalizeAuthError({ message: 'for security purposes, you can only request this after 60 seconds.' });
    expect(result.category).toBe('rate_limited');
    expect(result.canRetry).toBe(false);
  });

  it('maps email_exists to email_already_registered', () => {
    const result = normalizeAuthError({ message: 'User already registered', code: 'email_exists' });
    expect(result.category).toBe('email_already_registered');
  });

  it('maps invalid_credentials', () => {
    const result = normalizeAuthError({ message: 'Invalid login credentials', code: 'invalid_credentials' });
    expect(result.category).toBe('invalid_credentials');
    expect(result.canRetry).toBe(true);
  });

  it('maps email_not_confirmed', () => {
    const result = normalizeAuthError({ message: 'Email not confirmed', code: 'email_not_confirmed' });
    expect(result.category).toBe('verification_required');
    expect(result.canRetry).toBe(false);
  });

  it('maps network errors', () => {
    const result = normalizeAuthError(new Error('Failed to fetch'));
    expect(result.category).toBe('network_unavailable');
    expect(result.canRetry).toBe(true);
  });

  it('maps unknown errors to unknown_server_error', () => {
    const result = normalizeAuthError('Something very unusual happened');
    expect(result.category).toBe('unknown_server_error');
    expect(result.canRetry).toBe(true);
  });

  it('handles Error instances', () => {
    const result = normalizeAuthError(new Error('Rate limit exceeded'));
    expect(result.message).toBeTruthy();
  });

  it('authErrorMessage returns the message string', () => {
    const msg = authErrorMessage({ message: 'Invalid login credentials', code: 'invalid_credentials' });
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
