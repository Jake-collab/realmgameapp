# Hunt Stop Flow — Worlds (Prompt 13)

## Stop Lifecycle States

```
locked → available → in_progress → awaiting_proof / under_review → completed
                                 ↘ needs_resubmission → under_review → completed
                                 ↘ rejected (terminal for that attempt)
              ↘ expired (no longer available)
              ↘ skipped (optional stops)
```

## Action Resolution

All stop-level actions are resolved by `resolveStopAction()` in:
`features/active-hunt/services/stopActionResolver.ts`

This is the single source of truth for what the primary action button shows.

### Completion Method → Primary Action Mapping

| `completionMethod` | State | Action |
|-------------------|-------|--------|
| `none` / `manual_confirmation` | available/in_progress | `mark_complete` (with confirmation) |
| `location` | location not validated | `check_location` (opens LocationValidationPanel) |
| `location` | location validated | `complete_stop` (calls completeHuntStop) |
| `text` | draft not ready | `add_proof` (opens proof draft modal) |
| `text` | draft ready | `submit_proof` (opens proof review) |
| `image` | draft not ready | `add_proof` |
| `image` | draft ready | `submit_proof` |
| `text_and_image` | draft not ready | `add_proof` |
| `text_and_image` | draft ready | `submit_proof` |
| `image_and_location` | location not validated | `check_location` first |
| `image_and_location` | location validated, draft not ready | `add_proof` |
| `image_and_location` | location validated, draft ready | `submit_proof` |
| `trusted_code` | any | `add_proof` (Enter Code) |

### Review State Actions

| Status | Action |
|--------|--------|
| `under_review` | None (waiting display only) |
| `awaiting_proof` | None (waiting) |
| `needs_resubmission` | `resubmit_proof` |
| `rejected` | `resubmit_proof` |
| `completed` | None (completed state) |
| `locked` | None (locked display) |
| `expired` | None (expired display) |

## Manual Confirmation Flow

1. User taps "Mark Activity Complete"
2. Confirmation modal appears (`confirmationMessage` from action resolver)
3. User confirms → `useCompleteHuntStop.mutateAsync()`
4. Server validates and returns `HuntStopCompletionResult`
5. On success: cache invalidated → `useActiveHunt` refetches
6. If `huntCompletionReady = true`: completion readiness re-evaluated

## Location Flow

1. User taps "Check Location"
2. `useValidateHuntStopLocation.validate()` called
3. Permission check → GPS acquisition → server RPC
4. `validate_hunt_stop_location` RPC: computes proximity server-side
5. Client receives: `{ validated: true/false, userMessage, reasonCode }`
6. No geofence coordinates or radius returned to client
7. If validated + location-only stop: automatically calls `rpcCompleteHuntStop`
8. If validated + image_and_location: marks location as validated, opens proof modal

## Ordered vs Unordered Hunt UX

**Ordered:** Current stop is auto-selected (first non-completed available stop). Users see only the current stop's clue prominently. Previous stops shown as completed in progress summary.

**Unordered:** `UnorderedStopSelector` shows all available stops. User taps to select active stop. Selected stop's clue shown in `CurrentCluePanel`. All stop statuses visible at once.
