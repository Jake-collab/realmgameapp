# Hunt Withdrawal UI — Worlds (Prompt 13)

## Overview

Withdrawal allows a participant to leave an active hunt. It is a significant action that must not be accidental. It is accessed only through the "⋯" overflow menu, never as a primary action.

## `WithdrawalConfirmation` Component

A modal dialog (`Modal transparent`) that:
1. Lists consequences clearly and honestly
2. Makes "Keep Playing" the safe default (left/first button)
3. Requires explicit tap on "Withdraw" (red button, right/secondary)
4. Prevents background dismiss while withdrawing (`isWithdrawing` guard)
5. Shows error message if withdrawal fails (without closing modal)

## Withdrawal Consequences Shown to User

- ✓ Your hunt progress will be preserved in your history.
- ✓ Completion points will not be awarded.
- ✓ Rejoining depends on the hunt rules and capacity.
- ✓ Submitted proof may remain under review.

## `useWithdrawFromHunt` Mutation

```typescript
mutateAsync({
  participationId,
  huntId,
  occurrenceId,
  userId,
  reason?: string,
})
→ HuntWithdrawalResult { success, participationId, reasonCode, userMessage }
```

## Server: `withdraw_from_hunt` RPC (Migration 021)

- Idempotent: calling when already withdrawn returns success
- Sets `hunt_participants.status = 'withdrawn'`
- Does NOT delete stop progress records
- Does NOT delete proof submissions
- Not callable for `completed` hunts (those are permanent)

## After Successful Withdrawal

1. Mutation `onSuccess` fires
2. `onParticipantWithdrew` event emitted
3. Query invalidation: `mySummary`, `active`, `participation`
4. `useActiveHunt` refetches
5. `participationStatus` updates to `'withdrawn'`
6. `viewMode` transitions to `'withdrawn'`
7. `HuntStatusState` (mode='withdrawn') shown as terminal state

## Error Handling

If withdrawal RPC fails:
- `withdrawError` state set with user-safe message
- Error shown in modal above buttons
- Modal remains open (user can retry or cancel)
- `isWithdrawing` set back to false to re-enable buttons

## Menu Placement

The withdraw option is in the `ActiveHuntHeader` overflow menu (⋯):
```
[Map] View Hunt Details
[Shield] Safety Information
──────────────────────────
[LogOut] Withdraw from Hunt  ← red text, below divider
```

Never shown as:
- A primary action button on the screen
- An auto-triggered action
- The only visible action on any state
