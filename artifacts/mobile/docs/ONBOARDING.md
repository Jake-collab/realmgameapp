# Onboarding — Worlds Mobile

This document covers the onboarding flow: screens, database writes, resumability, and the transition into the main application.

---

## Overview

New users complete a 3-step onboarding immediately after email verification:

| Step | Screen | DB writes |
|---|---|---|
| 1 | Interests | `user_interests` (replace all), `onboarding_progress.interests_saved` |
| 2 | Location | `user_settings.location_sharing_enabled`, `onboarding_progress.location_permission_granted` |
| 3 | Starting mode | `profiles.preferred_game_mode`, `user_settings.last_game_mode`, `onboarding_progress.starting_mode_selected` |
| Final | Complete | `profiles.onboarding_status = 'completed'`, `profiles.onboarding_completed_at` |

**Skippable steps**: Interests and location are skippable — users can update both from Profile settings later. Starting mode is required to proceed.

---

## Route Group

All onboarding screens live in `app/(onboarding)/`:

```
(onboarding)/
├── _layout.tsx       — Stack with slide_from_right animation
├── welcome.tsx       — Greeting + what to expect
├── interests.tsx     — Category selection (DB or dev-fallback)
├── location.tsx      — Permission explanation + request
├── starting-mode.tsx — Quest vs Hunt selection
└── complete.tsx      — Mark complete + enter the app
```

---

## Onboarding Guard

`AuthProvider.resolveStartupState()` checks `profile.onboarding_status`:
- `not_started` | `in_progress` → `authenticated_needs_onboarding`
- `completed` → `authenticated_ready`

`NavigationGuard` redirects to `/(onboarding)/welcome` for `authenticated_needs_onboarding`.

This means any screen can be opened directly via the back button, but the guard will always redirect incomplete onboarding users to the onboarding group on app resume.

---

## Interests (Step 1)

- Loads active interests from `interests` table via `profileService.getAllInterests()`
- Falls back to 15 hardcoded dev categories when Supabase is not configured
- Requires at least 1 selection to persist (can skip entirely)
- Saves via `profileService.setMyInterests(userId, interestIds)` — replaces all existing interests
- `interests_saved` progress flag set in `user_settings.onboarding_progress`

**Dev note**: The dev fallback interests use `id: 'dev-0'` etc. — these are never sent to the DB and are for UI preview only.

---

## Location Permission (Step 2)

Uses `expo-location` `requestForegroundPermissionsAsync()`.

Permission handling:
```
granted   → location_sharing_enabled = true, continue
denied    → location_sharing_enabled = false, continue (non-blocking)
blocked   → Alert + deep link to device Settings, continue
unavailable → skip, continue
```

Important rules:
- Never request `requestBackgroundPermissionsAsync()` — foreground only
- Never request precise continuous location history
- If previously denied on iOS, OS will not show the dialog again — direct user to Settings
- The OS permission state is the source of truth. `user_settings.location_sharing_enabled` reflects the user's consent choice at the time of onboarding, but the actual permission may differ after the user leaves the app and changes Settings.

---

## Starting Mode (Step 3)

User selects Quest or Hunt as their starting world.

Database writes (all non-fatal — failure continues to complete screen):
```typescript
updateMyProfile(userId, { preferred_game_mode: selected, onboarding_status: 'in_progress' })
updateMySettings(userId, { last_game_mode: selected })
updateOnboardingProgress(userId, { starting_mode_selected: true })
```

Zustand is updated immediately via `setActiveMode(selected)` for instant UI feedback regardless of DB result.

---

## Completion (Final)

`(onboarding)/complete.tsx` performs the following on "Enter Worlds" tap:

1. `updateMyProfile(userId, { onboarding_status: 'completed', onboarding_completed_at: now })`
2. `updateMySettings(userId, { last_game_mode: activeMode })`
3. `updateOnboardingProgress(userId, { step: 'complete' })`
4. `setHasOnboarded(true)` in Zustand
5. `refreshProfile()` — reload profile into AuthProvider context
6. `retryStartup()` — re-run the startup state machine

Step 6 causes `resolveStartupState()` to see `onboarding_status = 'completed'` → `authenticated_ready`. `NavigationGuard` then redirects to `/(main)/quest` or `/(main)/hunt`.

If the DB write fails (network error), an error message is shown with a "try again" button.

---

## Resumability

If a user is interrupted mid-onboarding (closes app, loses connection), on next launch:
1. `AuthProvider` finds `onboarding_status ≠ 'completed'`
2. State machine enters `authenticated_needs_onboarding`
3. Guard routes to `/(onboarding)/welcome` — the user restarts from the first onboarding screen

Future enhancement: read `onboarding_progress.step` to resume from the last completed step rather than restarting.

---

## DB Schema References

- `profiles.onboarding_status` — `OnboardingStatus` enum (`not_started` | `in_progress` | `completed`)
- `profiles.onboarding_completed_at` — timestamp when completed
- `profiles.preferred_game_mode` — `GameMode` enum (`quest` | `hunt`)
- `user_settings.onboarding_progress` — `OnboardingProgress` JSONB
- `user_settings.location_sharing_enabled` — boolean consent flag
- `user_interests` — join table (`user_id`, `interest_id`)
