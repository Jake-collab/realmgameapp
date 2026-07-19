# Hunt Join Flow

## Overview

The join flow allows an authenticated user to join a public Hunt. It is server-authoritative — no optimistic capacity claims, no client-side point awards.

## Flow Diagram

```
Hunt Detail Screen
  → User taps "Join Hunt"
  → HuntJoinConfirmation modal opens
  → User reviews terms (stops, duration, timing, safety)
  → User taps "Join Hunt" (confirmation)
  → useJoinHunt.mutate() fires
  → Server validates: capacity, authentication, duplicate prevention
  → On success: route to /hunt-ready/[participationId]
  → On failure: dismiss modal, stay on detail screen
```

## Guard Conditions

Before the "Join Hunt" button is enabled:

| Check | Enforced By |
|-------|-------------|
| User authenticated | evaluateHuntAvailability → NOT_AUTHENTICATED reason |
| Hunt status = active | Server RPC + client state |
| Hunt privacy = public | Server RPC enforced |
| Has space (capacity) | evaluateHuntAvailability → HUNT_FULL |
| Not already joined | evaluateHuntAvailability → participation state |
| Hunt not cancelled/expired | evaluateHuntAvailability → HUNT_CANCELLED / HUNT_EXPIRED |

## Join Confirmation Modal

Contents:
- Hunt title and type label
- Participation mode (Solo / Group / Either)
- Stop count and estimated duration
- Timing: start date label
- Location and proof requirements (if relevant)
- Safety notice (if requiresLocation or safetyNote)
- Points reward badge

**Not shown in confirmation:**
- Other participants
- Exact stop locations
- Locked clue content
- Proof method specifics (only "required" vs not)

## Server Validation

`rpcJoinHunt` calls the `join_hunt` SECURITY DEFINER RPC which validates:
- User is authenticated (JWT)
- Hunt exists and is `status = 'active'`
- Hunt privacy allows joining (open join policy)
- Capacity has space (for occurrence-level hunts)
- User hasn't already joined (idempotent)

## Outcomes

| Server Response | Client Action |
|-----------------|---------------|
| `{ success: true, participationId }` | Route to `/hunt-ready/[participationId]` |
| `{ success: false, code: 'FULL' }` | Dismiss modal, remain on detail |
| `{ success: false, code: 'ALREADY_JOINED' }` | Refresh availability, show state |
| Network error | Dismiss modal, show inline error |

## From Map vs. Detail

**From Map (preview card):**
- Unauthenticated users are routed to Hunt Detail (which will prompt sign-in)
- Authenticated users see join confirmation modal
- After confirmation: same server-authoritative join flow

**From Detail:**
- Full join confirmation with all context visible
- Same server-authoritative flow

## Not Implemented In Join Flow

- Waitlists (future prompt)
- Group joins (inviting others at join time — separate invite flow)
- Payment gating
- Create Hunt (separate prompt)
