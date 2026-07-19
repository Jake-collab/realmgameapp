# Hunt Completion UI — Worlds (Prompt 13)

## Hunt Completion Flow

```
Active Hunt Screen
  → User taps "Complete Hunt"
  → useHuntCompletionReadiness checked (server-authoritative)
  → If not ready: show reason, no action
  → If ready: useCompleteHunt.mutateAsync()
  → complete_hunt RPC (idempotent, SECURITY DEFINER)
  → Points awarded exactly once via idempotency key
  → router.replace('/(main)/hunt-completion/[participationId]')
  → HuntCompletionSummary displayed
```

## RPC: `complete_hunt`

From migration 021. SECURITY DEFINER. Idempotent.

```typescript
rpcCompleteHunt(participationId)
→ HuntCompletionResult {
  success: boolean
  participationId: string | null
  awardedPoints: number | null
  completedAt: string | null
  reasonCode: CompletionReadinessState | null
  userMessage: string
}
```

## Idempotency

Calling `complete_hunt` twice with the same `participationId`:
- Returns the existing completion result
- Does NOT award points twice
- Points are appended to `points_ledger` exactly once

## Complete Hunt Button State

The "Complete Hunt" button is shown only when:
1. `useHuntCompletionReadiness.data.isReady === true`
2. `participationStatus` is `'active'` or `'paused'`
3. No deadline has passed

Before showing the button, `useHuntCompletionReadiness` must return `state: 'ready'`.

## Completion Readiness States

| State | Meaning |
|-------|---------|
| `ready` | All required stops completed, no pending proof |
| `missing_required_stop` | One or more required stops not completed |
| `proof_pending` | Required stop proof is under review |
| `proof_rejected` | Required stop proof was rejected — resubmission needed |
| `location_validation_required` | Location validation missing for required stop |
| `expired` | Completion deadline passed |
| `already_completed` | Hunt already completed (idempotent) |
| `invalid_state` | Participation not in active/paused status |

## Hunt Completion Screen

Route: `app/(main)/hunt-completion/[participationId].tsx`

Shows `HuntCompletionSummary` with:
- Animated celebration icon (restrained — no confetti)
- Hunt title
- Required stops completed / total
- Optional stops completed (if any)
- Points awarded (only if `awardedPoints > 0`)
- Completion date
- "View My Hunts" and "Explore More Hunts" navigation

## Reward Source

Points come from `reward_snapshot` captured at join/start time. Never re-read from the `hunts` table at completion time. This ensures point stability even if the hunt's point value changes during gameplay.

## Points Not Shown Until Confirmed

`awardedPoints` is only displayed when `result.awardedPoints > 0`. If the server returns `null` (completion in progress or not yet confirmed), no points are shown.
