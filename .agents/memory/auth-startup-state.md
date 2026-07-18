---
name: Auth Startup State Machine
description: How the deterministic startup state machine works and key gotchas for future edits.
---

## Rule
`AuthStartupState` drives all routing in NavigationGuard. Never use ad-hoc boolean flags (`isLoading && isAuthenticated`) — always derive routing from `startupState`.

## States
```
initializing → configuration_missing | unauthenticated | authenticated_needs_verification |
               authenticated_needs_onboarding | authenticated_suspended | authenticated_ready | error
```

## Sequence (resolveStartupState)
1. `isSupabaseConfigured()` → false → `configuration_missing`
2. `auth.getSession()` → no session → `unauthenticated`
3. `user.email_confirmed_at` null → `authenticated_needs_verification`
4. Fetch profile from `profiles` table → missing → recovery attempt
5. `profile.account_status` ∈ {suspended, deactivated} → `authenticated_suspended`
6. `profile.onboarding_status` ≠ `completed` → `authenticated_needs_onboarding`
7. All pass → `authenticated_ready`

## Splash screen
`SplashScreen.preventAutoHideAsync()` at module level. NavigationGuard calls `hideAsync()` exactly once (tracked with `hasHiddenSplash` ref) after first non-`initializing` transition. Never call `hideAsync()` from the font-loading effect — this causes a flash of incorrect content.

## Timeout
8-second timeout in `useEffect` transitions `initializing` → `error` to prevent infinite loading. Users can call `retryStartup()`.

**Why:** Removed the 2-boolean approach (isLoading + isAuthenticated + hasOnboarded) which had race conditions and allowed flash of wrong screen.

**How to apply:** Any future auth state change must go through `resolveStartupState()` or the explicit `setStartupState()` calls in the `onAuthStateChange` handler (SIGNED_OUT sets directly to avoid refetch).
