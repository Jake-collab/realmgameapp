# Auth Testing Guide — Worlds Mobile

This document describes how to test the authentication and onboarding flows, both manually and with automated tests.

---

## Unit Tests

### Auth Service (`services/auth.service.ts`)

```typescript
// __tests__/auth.service.test.ts

import { authService } from '@/services/auth.service';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  requireSupabase: jest.fn(() => mockSupabaseClient),
}));

describe('authService.signIn', () => {
  it('returns user and session on success', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });
    const result = await authService.signIn({ email: 'test@example.com', password: 'Password1' });
    expect(result.user?.id).toBe(mockUser.id);
    expect(result.error).toBeNull();
  });

  it('returns error on invalid credentials', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });
    const result = await authService.signIn({ email: 'x@x.com', password: 'wrong' });
    expect(result.user).toBeNull();
    expect(result.error?.code).toBe('invalid_credentials');
  });

  it('handles network error gracefully', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(new Error('Failed to fetch'));
    await expect(authService.signIn({ email: 'x@x.com', password: 'pw' })).rejects.toThrow();
  });
});

describe('authService.signUp', () => {
  it('returns needsVerification=true when session is null', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    });
    const result = await authService.signUp({
      email: 'new@example.com',
      password: 'Password1',
      username: 'newuser',
      displayName: 'New User',
      acceptedTermsVersion: 'terms_v1_draft',
      acceptedPrivacyVersion: 'privacy_v1_draft',
    });
    expect(result.needsVerification).toBe(true);
    expect(result.session).toBeNull();
  });

  it('returns needsVerification=false when session is present', async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });
    const result = await authService.signUp({ ... });
    expect(result.needsVerification).toBe(false);
  });
});

describe('authService.signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
    const result = await authService.signOut();
    expect(result.error).toBeNull();
    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
  });
});

describe('authService.resetPasswordForEmail', () => {
  it('suppresses user-not-found errors (avoids enumeration)', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
      data: {}, error: { message: 'User not found' }
    });
    const result = await authService.resetPasswordForEmail('x@x.com', 'worlds://auth-callback');
    expect(result.error).toBeNull(); // suppressed intentionally
  });
});

describe('normalizeAuthError', () => {
  it('maps rate limit to rate_limited category', () => {
    const err = normalizeAuthError({ message: 'For security purposes, you can only request this after 60 seconds.' });
    expect(err.category).toBe('rate_limited');
    expect(err.canRetry).toBe(false);
  });

  it('maps email_already_registered correctly', () => {
    const err = normalizeAuthError({ message: 'User already registered', code: 'email_exists' });
    expect(err.category).toBe('email_already_registered');
  });

  it('uses generic message for unknown errors', () => {
    const err = normalizeAuthError('An unexpected thing happened');
    expect(err.category).toBe('unknown_server_error');
    expect(err.canRetry).toBe(true);
  });
});
```

---

### Signup Form Validation

```typescript
// __tests__/signup.validation.test.ts
import { render, fireEvent, waitFor } from '@testing-library/react-native';

describe('signup form', () => {
  it('shows error for weak password', async () => {
    const { getByPlaceholderText, findByText } = renderSignupForm();
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'weak');
    fireEvent.press(submitButton());
    await findByText('Password must be at least 8 characters');
  });

  it('shows error for mismatched passwords', async () => {
    // Set password and confirm password to different values
    fireEvent.changeText(passwordInput(), 'Password1');
    fireEvent.changeText(confirmInput(), 'Password2');
    fireEvent.press(submitButton());
    await findByText('Passwords do not match');
  });

  it('blocks submit when username is unavailable', async () => {
    // Mock useUsernameAvailability to return 'unavailable'
    // Verify submit shows "Username already taken" error
  });
});
```

---

### Navigation Guard Logic

```typescript
// __tests__/navigationGuard.test.ts
describe('NavigationGuard routing', () => {
  const cases = [
    { state: 'unauthenticated', expectedRoute: '/(auth)/welcome' },
    { state: 'authenticated_needs_verification', expectedRoute: '/(auth)/verify-email' },
    { state: 'authenticated_needs_onboarding', expectedRoute: '/(onboarding)/welcome' },
    { state: 'authenticated_suspended', expectedRoute: '/(auth)/welcome' },
    { state: 'authenticated_ready', activeMode: 'quest', expectedRoute: '/(main)/quest' },
    { state: 'authenticated_ready', activeMode: 'hunt', expectedRoute: '/(main)/hunt' },
    { state: 'error', expectedRoute: '/(auth)/welcome' },
  ];

  cases.forEach(({ state, expectedRoute, activeMode }) => {
    it(`routes ${state} to ${expectedRoute}`, async () => {
      const { replace } = mockRouter();
      renderNavigationGuard({ startupState: state, activeMode: activeMode ?? 'quest' });
      await waitFor(() => expect(replace).toHaveBeenCalledWith(expectedRoute));
    });
  });

  it('does not redirect while initializing', () => {
    const { replace } = mockRouter();
    renderNavigationGuard({ startupState: 'initializing' });
    expect(replace).not.toHaveBeenCalled();
  });

  it('hides splash screen after first non-initializing state', async () => {
    const hideSplash = jest.spyOn(SplashScreen, 'hideAsync');
    renderNavigationGuard({ startupState: 'unauthenticated' });
    await waitFor(() => expect(hideSplash).toHaveBeenCalledTimes(1));
    // Transition again — should NOT call hideAsync a second time
    rerenderWithState('authenticated_ready');
    expect(hideSplash).toHaveBeenCalledTimes(1);
  });
});
```

---

### Onboarding Progress Persistence

```typescript
describe('onboarding progress persistence', () => {
  it('saves interest selection to DB', async () => {
    // Mock profileService.setMyInterests
    // Render interests screen, select 3 interests, tap Continue
    // Verify setMyInterests called with correct IDs
  });

  it('marks onboarding complete on complete screen', async () => {
    // Mock updateMyProfile
    // Render complete screen, tap "Enter Worlds"
    // Verify updateMyProfile called with { onboarding_status: 'completed' }
  });

  it('retries startup state machine after completion', async () => {
    // Verify retryStartup() is called after successful profile update
  });
});
```

---

## Manual Test Scenarios

### Happy Path Sign-up (email confirmation enabled)

1. Open app → Welcome screen
2. Tap "Sign Up" → fill all fields with valid data
3. Tap "Create account" → verify-email inline state shows (email address displayed)
4. Open email → tap verification link → app opens via `worlds://`
5. `auth-callback.tsx` processes token → NavigationGuard redirects to onboarding
6. Complete 3 onboarding steps
7. Tap "Enter Worlds" → main app opens in selected mode

### Happy Path Sign-up (email confirmation disabled)

1. Sign up → immediate redirect to onboarding (no verify-email step)
2. Complete onboarding → main app

### Login with unverified email

1. Sign up (don't verify)
2. Restart app → `authenticated_needs_verification` → verify-email screen
3. Verify → app routes to onboarding

### Suspended account

1. Admin sets `account_status = 'suspended'` in DB
2. User opens app or logs in
3. `authenticated_suspended` state → Welcome screen with suspension notice
4. Logout option available

### Password recovery

1. Tap "Forgot password" on login screen
2. Enter email → success message shown (neutral wording)
3. Open email → tap reset link
4. App opens via `worlds://` → `auth-callback.tsx` → `reset-password.tsx`
5. Enter new password → success → redirect to login
6. Login with new password → success

### Resend verification cooldown

1. Go to verify-email screen
2. Tap "Resend" → success message → button disabled for 60s
3. After 60s → button re-enables
4. Tap again → new email sent

### Malformed deep link

1. Open `worlds://auth-callback#type=signup` (no tokens)
2. `auth-callback.tsx` shows "Invalid link" error
3. "Back to Welcome" button available

### Expired reset link

1. Click an old reset link from email
2. `auth-callback.tsx` shows "Link has expired" error
3. Option to request a new link

### Network failure during startup

1. Disable device network
2. Open app
3. `authService.getSession()` may fail → `error` state → error screen shown
4. Re-enable network → retry → session restored

---

## Environment Setup for Testing

```bash
# Install test dependencies
pnpm add -D jest @testing-library/react-native @testing-library/jest-native

# Run unit tests
pnpm --filter @workspace/mobile test

# Run with coverage
pnpm --filter @workspace/mobile test --coverage
```

### Mock setup for auth tests

```typescript
// __mocks__/@react-native-async-storage/async-storage.ts
export default {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
};
```
