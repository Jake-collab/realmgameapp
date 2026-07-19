# Hunt State Machines — Worlds

## Participant Status Machine

```
          ┌──────────┐
          │ invited  │◄─── hunt_invitations.status = pending
          └────┬─────┘
               │ accept          ┌──────────┐
               ├────────────────►│ accepted │ (joined, not started)
               │                 └────┬─────┘
               │ decline               │ ready
               │                       │ (host signals ready)
               ▼                       ▼
          ┌──────────┐          ┌──────────┐
          │ declined │          │   ready  │ (waiting for start)
          └──────────┘          └────┬─────┘
         (TERMINAL)                  │ start
                                     ▼
                               ┌──────────┐
                           ┌──►│  active  │◄───────┐
                           │   └────┬─────┘         │
                           │        │ pause           │ unpause
                           │        ▼                 │
                           │   ┌──────────┐          │
                           │   │  paused  ├──────────┘
                           │   └────┬─────┘
                           │        │
                           │  ┌─────┴──────────┐
                           │  │                │
                           ▼  ▼                ▼
                      ┌─────────┐        ┌─────────┐
                      │completed│        │  left   │
                      └─────────┘        └─────────┘
                      (TERMINAL)         (TERMINAL)
                    TRUSTED ONLY
                         │
                         │ removed (trusted only)
                         ▼
                    ┌─────────┐     ┌─────────┐
                    │ removed │     │ expired │
                    └─────────┘     └─────────┘
                    (TERMINAL)      (TERMINAL)
```

**Trusted-only transitions** (server only, client may not request):
- `completed` — only via `complete_hunt` RPC
- `removed` — only via `remove_hunt_participant` RPC
- `expired` — only via scheduled expiration logic

## Stop Progress Status Machine

```
 ┌────────────┐
 │   locked   │ (ordered hunt, stop not yet unlocked)
 └──────┬─────┘
        │ previous stop completed → unlock
        ▼
 ┌────────────┐         ┌─────────────────┐
 │  available │────────►│   in_progress   │
 └────────────┘         └────────┬────────┘
        │                        │
        │ (auto-complete)         │ submit proof
        ▼                        ▼
 ┌────────────┐         ┌─────────────────┐
 │ completed  │◄────────│ awaiting_proof  │
 └────────────┘         └────────┬────────┘
   (TERMINAL)                    │
 TRUSTED ONLY                    ▼
                         ┌─────────────────┐
                         │  under_review   │ ──► needs_resubmission
                         └────────┬────────┘         │
                                  │                   │
                          ┌───────┴──────┐       ◄───┘
                          │              │
                     completed      rejected
                    (TERMINAL)     (TERMINAL)
                   TRUSTED ONLY  TRUSTED ONLY
```

**Trusted-only stop transitions:**
- `completed` — only via `complete_hunt_stop` RPC (or proof approval)
- `rejected` — only via proof review (trusted reviewer)
- `under_review` — only after server receives proof submission
- `needs_resubmission` — only via trusted reviewer

## Hunt Content Status Machine

```
draft → pending_review → ready → scheduled → active → completed
                              ↘                    ↘
                           rejected              paused ⇆ active
                                                        ↓
                                                   cancelled
                                                        ↓
                                                   archived (terminal)
```

## Invitation Status Machine

```
pending → accepted (TERMINAL)
        → declined (TERMINAL)
        → revoked  (TERMINAL — inviter action)
        → expired  (TERMINAL — time-based)
```

Note: A user who has **accepted** an invitation and then wants to leave must use `withdraw_from_hunt`, not decline. Changing `accepted` → `declined` is not allowed.

## Stop Ordering and Reveal Sequence

### Ordered Hunts
1. `join_hunt` creates progress record for **first stop only** (status: `not_started`).
2. `start_hunt` marks first stop as `available`. All other stops initialized as `not_started`.
3. `complete_hunt_stop` marks the stop `completed` and unlocks the **next stop** (sets its status to `available`).
4. Process repeats until the final stop is completed.
5. When all required stops are `completed`, `complete_hunt` may be called.

### Unordered Hunts
1. `join_hunt` creates progress records for **all required stops** (status: `not_started`).
2. `start_hunt` marks **all stops** as `available` simultaneously.
3. `complete_hunt_stop` marks the individual stop `completed`. No sequential unlock.
4. When all required stops are `completed`, `complete_hunt` may be called.

## Capacity Counting

Statuses that **count toward capacity**:
```
invited, accepted, ready, active, paused, completed
```

Statuses that **release a slot** (do not count):
```
declined, removed, left, expired
```

Pending invitations count toward capacity in Build 1 (to prevent over-invitation).
