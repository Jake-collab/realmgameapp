# Friendships — Worlds (Prompt 16)

## Overview

Friendship in Worlds is **mutual-only**. There are no followers, following, or one-sided connections. A friendship is created only when a friend request is explicitly accepted by the recipient.

## Data Model

```sql
friendships (
  id          UUID PRIMARY KEY,
  user_id_a   UUID   -- canonical lower UUID
  user_id_b   UUID   -- canonical higher UUID
  status      TEXT   -- 'active' | 'removed'
  request_id  UUID   -- originating friend_request.id
  created_at  TIMESTAMPTZ
  ended_at    TIMESTAMPTZ
)
```

### Canonical Pair Ordering
`user_id_a` is always the **lexicographically smaller** UUID, `user_id_b` the larger. This prevents duplicate rows regardless of which user initiates a query. A partial unique index enforces one active friendship per canonical pair.

### History Preservation
Friendship records are **soft-deleted** (`status = 'removed'`), not deleted outright. This preserves audit history and allows cooldown enforcement on re-requests after removal.

## Trust Boundaries

Friendship grants **only** the explicitly configured social visibility and interaction permissions. It does NOT grant:

- Permission to see private proof or submission content
- Permission to see exact Quest/Hunt location
- Permission to see active Hunt participation
- Permission to join private Hunts
- Permission to message
- Permission to edit another user's content
- Permission to see hidden achievements
- Permission to bypass Hunt capacity or eligibility rules

## Removal

Either friend may remove the other. See `FRIEND_REQUESTS.md` for re-request cooldown behavior after removal.

The UI shows a confirmation before removal:
- "Remove this person from your friends?"
- Buttons: **Keep Friend** | **Remove Friend**

No notification is sent to the removed user.

## Blocking

Blocking atomically removes the active friendship. See `BLOCKING.md`.

## Re-friending After Removal

After removing a friend:
1. A `REMOVAL_COOLDOWN_DAYS` period applies before a new request can be sent (server-enforced).
2. A new friend request creates a new friendship row; the removed row remains as history.
