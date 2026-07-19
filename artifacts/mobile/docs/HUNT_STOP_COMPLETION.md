# Hunt Stop Completion — Worlds (Prompt 13)

## Server Authority

Stop completion is ALWAYS server-authoritative. The client:
- Never marks a stop complete without a successful RPC response
- Never awards points at the stop level
- Never optimistically updates `progressStatus` to `completed`

## RPC: `complete_hunt_stop`

From migration 021. Called by `rpcCompleteHuntStop` in `hunt.repository.ts`.

```typescript
rpcCompleteHuntStop(participationId, stopId, validationMethod)
→ HuntStopCompletionResult {
  success: boolean
  stopId: string
  newStatus: StopProgressStatus
  nextStops: ActiveHuntStop[]
  huntCompletionReady: boolean
  reasonCode: string | null
  userMessage: string
}
```

## Stop Completion Invalidation

After successful `completeHuntStop`:
1. `huntKeys.activeHunt(participationId, userId)` — refresh current state
2. `huntKeys.stopProgress(participationId, userId)` — refresh progress list
3. `huntKeys.active(userId)` — refresh My Hunts summary
4. `huntKeys.mySummary(userId)` — update my hunts panel

## `huntCompletionReady` Flag

When the server returns `huntCompletionReady: true`, the client:
1. Calls `refetchReadiness()` to update `useHuntCompletionReadiness`
2. If readiness returns `state: 'ready'`, the "Complete Hunt" button appears

## Completion Method Validation

The `complete_hunt_stop` RPC validates the `validationMethod` parameter against the stop's configured `completion_method`. Mismatches return `success: false` with an appropriate reasonCode.

## Ordered Hunt Progression

After a stop is completed in an ordered hunt, the next stop becomes `available`. The server updates `hunt_stop_progress` records for subsequent stops. The client refetches `useActiveHunt` to discover the new current stop.

## Concurrency Safety

If two devices attempt to complete the same stop simultaneously:
- First call succeeds
- Second call returns `success: false, reasonCode: 'STOP_ALREADY_COMPLETED'`
- No double-completion possible

## Completion Method Constraints

| Method | RPC validates |
|--------|--------------|
| `manual_confirmation` | Participation status + stop status only |
| `location` | Participation + stop + geofence proximity (server-side) |
| `text` | Proof submission status (awaiting_proof → completed) |
| `image` | Proof submission status |
| `text_and_image` | Proof submission status |
| `image_and_location` | Proof submission + location validation record |
| `trusted_code` | Proof submission (code verified by moderator) |

Note: For proof-based methods, `complete_hunt_stop` is called by the review system (not directly by the participant after submission). The participant calls `submit_hunt_stop_proof` instead.
