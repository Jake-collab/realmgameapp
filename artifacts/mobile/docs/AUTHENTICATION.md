# Authentication — Worlds Mobile

This document covers the full authentication architecture for the Worlds mobile app: startup state machine, session management, error handling, and account lifecycle.

---

## State Ownership

| Layer | Owns | Examples |
|---|---|---|
| Supabase Auth | Session identity | `access_token`, `refresh_token`, `email_confirmed_at`, `user_id` |
| `AuthProvider` | Startup state, profile in context | `startupState`, `user`, `profile`, auth actions |
| React Query | Server-cached data | profile settings, interests (invalidated on logout) |
| Zustand | Navigation UI prefs | `activeMode`, `lastQuestTab`, persisted to AsyncStorage |

Never mix these layers. Components read `useAuth()` or `useAuthContext()` — never raw Supabase calls.

---

## Startup State Machine

`AuthStartupState` is a deterministic sequence of checks run on app launch and on every `onAuthStateChange` event.

```
initializing
  │
  ├─► configuration_missing   (Supabase credentials absent — dev mode)
  │
  ├─► unauthenticated          (no valid session → (auth) group)
  │
  ├─► authenticated_needs_verification
  │      (session exists, email_confirmed_at is null)
  │
  ├─► authenticated_needs_onboarding
  │      (verified, profile.onboarding_status ≠ 'completed')
  │
  ├─► authenticated_suspended
  │      (account_status = 'suspended' | 'deactivated')
  │
  ├─► authenticated_ready      (all checks pass → (main) group)
  │
  └─► error                    (startup timed out or unrecoverable failure)
```

**Timeout**: If startup takes longer than 8 seconds, the state transitions to `error`. Users can tap "retry" to re-run the sequence.

**Splash screen**: The native splash is held via `SplashScreen.preventAutoHideAsync()`. `NavigationGuard` hides it exactly once after the first non-`initializing` transition — preventing any flash of incorrect content.

---

## NavigationGuard Routing

`NavigationGuard` (inside `app/_layout.tsx`) watches `startupState` and redirects:

| State | Target route |
|---|---|
| `configuration_missing` / `unauthenticated` | `/(auth)/welcome` |
| `authenticated_needs_verification` | `/(auth)/verify-email` |
| `authenticated_needs_onboarding` | `/(onboarding)/welcome` |
| `authenticated_suspended` | `/(auth)/welcome` (suspended notice) |
| `authenticated_ready` | `/(main)/quest` or `/(main)/hunt` (based on `activeMode`) |
| `error` | `/(auth)/welcome` (retry available) |

---

## Sign-up Flow

```
signup.tsx (form)
  │
  ├── client-side Zod validation
  ├── username availability check (debounced 600ms)
  │
  ▼
authService.signUp(email, password, { metadata: { display_name, username } })
  │
  ├── No session (email confirmation required)
  │     → show inline verify-email state
  │     → user taps link in email
  │     → deep link → auth-callback.tsx
  │     → tokens exchanged → SIGNED_IN event
  │     → profile update + legal acceptance recorded
  │     → NavigationGuard → (onboarding)
  │
  └── Session immediate (email confirmation disabled)
        → profile.update(username, display_name, onboarding_status)
        → legal_acceptances.insert(terms, privacy)
        → SIGNED_IN event → NavigationGuard → (onboarding)
```

### Profile Recovery

If a user has a valid session but their `profiles` row is missing (e.g., DB trigger failure during signup), `AuthProvider` attempts recovery:

1. Insert a minimal profile with a generated username (`user_XXXXXXXX`)
2. Set `onboarding_status = 'not_started'`
3. Route to `(onboarding)/welcome` for the user to complete their profile

---

## Login Flow

```
login.tsx
  │
  ├── authService.signIn(email, password)
  ├── Error normalization → user-friendly message
  │     (generic "couldn't sign you in" for both wrong password and unknown email
  │      — avoids account enumeration)
  │
  ▼
onAuthStateChange(SIGNED_IN)
  │
  ▼
AuthProvider.resolveStartupState()
  ├── Check email verified
  ├── Fetch profile
  ├── Check account_status (suspended → blocked)
  └── Check onboarding_status → route accordingly
```

---

## Password Recovery Flow

1. **Forgot password screen**: User enters email → `authService.resetPasswordForEmail(email, redirectTo: getAuthRedirectUrl())`
   - Always shows neutral success message (does not confirm registration)
   - 60-second resend cooldown

2. **Email link**: Supabase redirects to the native `worlds://auth-callback` or web `https://matterrealm.com/auth/callback` callback with a recovery session.

3. **Auth callback screen**: Parses tokens, detects `type=recovery`, exchanges session, redirects to `/(auth)/reset-password`

4. **Reset password screen**: Verifies the session originated from a recovery callback, calls `authService.updatePassword(newPassword)`, redirects to login

---

## Account Status Enforcement

| `account_status` | Behaviour |
|---|---|
| `active` | Normal access |
| `restricted` | Login permitted, some features blocked (UI notices) |
| `suspended` | Blocked from main app. `authenticated_suspended` state shows message. Logout offered. |
| `deactivated` | Blocked from main app. Same as suspended at the client level. |

`account_status` changes require a server-side admin RPC — clients can only read the status, never write it.

---

## Session Persistence

The Supabase client is configured with:
```typescript
auth: {
  storage: AsyncStorage,        // persists session to device storage
  autoRefreshToken: true,       // silently refresh on expiry
  persistSession: true,
  detectSessionInUrl: false,    // deep links handled manually
}
```

**On logout**: `queryClient.clear()` is called before `signOut()` to prevent cross-user data leakage. Zustand transient UI state is cleared; navigation prefs are retained.

---

## Error Normalization

All auth errors pass through `lib/auth/errorNormalizer.ts` before being shown to users.

Rules:
- Never expose SQL, policy names, table names, or stack traces
- Generic "couldn't sign you in" wording for credential failures (avoids enumeration)
- Network errors get "Check your internet connection" with `canRetry: true`
- Rate-limit errors suppress the retry button for 60 seconds

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` must never be bundled in the mobile app
- `quest_geofences` and `hunt_stop_geofences` are never returned to clients (RLS)
- No guest/anonymous auth (to be evaluated per feature, not granted globally)
- Social auth providers (Apple, Google) are stubbed as disabled buttons — not functional until explicitly approved and tested
- Production builds suppress all `__DEV__` messages about Supabase configuration
