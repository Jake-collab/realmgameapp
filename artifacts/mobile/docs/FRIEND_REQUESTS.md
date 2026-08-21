# Friend Requests — Worlds (Prompt 16)

## States

| Status | Description |
|--------|-------------|
| `pending` | Request sent, awaiting response, not expired |
| `accepted` | Recipient accepted; friendship created |
| `declined` | Recipient declined; record preserved |
| `cancelled` | Requester cancelled before response |
| `expired` | 30 days elapsed without response |

## Lifecycle Rules

- One active `pending` request per ordered pair (unique index).
- Requests are directional until accepted.
- Accepted friendship is mutual.
- Declined and cancelled requests remain backend-auditable.
- Expired requests cannot be accepted (server checks `expires_at`).
- Repeated `send_friend_request` calls are idempotent — returns existing pending request.

## Reverse Request Policy (Build 1)

When A sends a request to B while B already has a valid pending request to A, the server **auto-accepts** the existing request atomically. This creates a friendship without requiring two explicit actions. The response contains `{code: 'auto_accepted', state: 'friends'}`.

Alternative behavior (require explicit acceptance of reverse request) was considered but not chosen for Build 1 simplicity.

## Expiration

- Requests expire after **30 days** (`REQUEST_EXPIRY_DAYS` constant).
- Server time is authoritative for expiry checks.
- Scheduled cleanup may update expired rows; query-time checks protect stale rows.
- Expired requests leave the primary pending view.

## Pending Limit

- Maximum **100 active outgoing pending requests** per user.
- Server-enforced; not configurable from the client.
- Prevents spam accounts from creating unbounded requests.

## Cooldowns

| Event | Cooldown |
|-------|----------|
| Declined request | 7 days before re-requesting |
| Friend removal | 1 day before re-requesting |
| Unblock | 1 day before re-requesting |

## Notifications

| Event | Notification Sent |
|-------|------------------|
| Request received | ✅ `friend_request_received` to recipient |
| Request accepted | ✅ `friend_request_accepted` to requester |
| Request declined | ❌ No notification |
| Request cancelled | ❌ No notification |
| Friend removed | ❌ No notification |

## RPC Ownership

| Operation | Who May Call |
|-----------|-------------|
| `send_friend_request` | Requester only |
| `accept_friend_request` | Recipient only |
| `decline_friend_request` | Recipient only |
| `cancel_friend_request` | Requester only |
| `remove_friend` | Either friend |
