# Blocking — Worlds (Prompt 16)

## Overview

Blocking is a first-class safety feature. It is transactional, permanent from the blocked user's perspective (until unblocked), and never notifies the blocked user.

## When A Blocks B

The `block_user` RPC atomically:
1. Removes any active friendship between A and B.
2. Cancels pending friend requests in **both** directions.
3. Marks the block active (`is_active = TRUE`).
4. No notification is sent to B.

After blocking:
- B is excluded from A's search results.
- A is excluded from B's search results.
- Neither can send friend requests to the other.
- Neither can send Hunt invitations to the other.
- B's profile returns `{unavailable: true}` to A — B does not know they are blocked.
- Hunt and quest historical records are preserved.
- Moderation and audit history is preserved.

## Blocked-by-Other Behavior

When B has blocked A:
- A sees B's profile as `{unavailable: true}` — identical to "not found".
- The UI shows "Profile Unavailable" — it does not say "This user blocked you."
- A cannot search for B, send requests, or invite B to Hunts.

## Data Model

```sql
user_blocks (
  id               UUID PRIMARY KEY,        -- added in migration 026
  blocker_user_id  UUID NOT NULL,
  blocked_user_id  UUID NOT NULL,
  created_at       TIMESTAMPTZ,
  removed_at       TIMESTAMPTZ,             -- NULL = active block
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
)
-- Partial unique index: only one active block per ordered pair
```

Historical block rows (is_active=FALSE) are preserved for audit.

## Unblocking

The `unblock_user` RPC:
1. Sets `is_active = FALSE`, `removed_at = NOW()` on the active block row.
2. Does **NOT** restore friendship.
3. Does **NOT** restore cancelled friend requests.
4. Does **NOT** notify the unblocked user.
5. After `UNBLOCK_COOLDOWN_DAYS`, new friend requests are possible.

## UI Confirmation

Before blocking, the user sees:

> - They will be removed from your friends.
> - Pending friend requests will be cancelled.
> - You will not be able to send each other Hunt invitations.
> - Their profile will no longer appear in your search results.
> - They will not receive a notification that you blocked them.

Buttons: **Cancel** | **Block User**

## Idempotency

Calling `block_user` when a block already exists returns `{ok: true, code: 'already_blocked'}` without error.
