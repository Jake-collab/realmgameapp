# Hunt Invitations — Worlds

## Invitation Model

An invitation is created by an authorized inviter (creator, co_host, or hunt owner) for a specific invitee. It carries an expiry, an optional personal message, and a status machine.

```
HuntInvitation {
  id, huntId, occurrenceId?,
  inviterUserId, inviteeUserId,
  status: pending | accepted | declined | revoked | expired,
  message?, expiresAt?, respondedAt,
  createdAt
}
```

## Who Can Invite

- Hunt `creator_user_id` (the user who created a custom hunt)
- Participants with `role = 'creator'` or `role = 'co_host'`
- Platform administrators (future prompt)

Ordinary `player` role participants **cannot** invite others in Build 1.

## Invitation Lifecycle

```
created                 → status: pending
  ↓ invitee accepts     → status: accepted  (participation created atomically)
  ↓ invitee declines    → status: declined
  ↓ inviter revokes     → status: revoked
  ↓ expires_at passes   → status: expired   (expires_hunt_invitations() cron)
```

Once `accepted`, the invitation cannot be moved back to `declined` — the invitee must use `withdraw_from_hunt` instead.

## Invitation Idempotency

- Sending a second invitation to the same user for the same hunt returns the existing `pending` invitation.
- Accepting a second time returns the existing participation.
- `accept_hunt_invitation` uses an advisory lock and `ON CONFLICT` clause to ensure atomic participation creation.

## Expiration

Default expiry: **7 days** from creation.

Lazy expiration: `accept_hunt_invitation` and `get_hunt_availability` check and update stale invitations to `expired` on read. A Supabase cron job running `expire_hunt_invitations()` handles batch cleanup (must be scheduled by the operator).

## Capacity and Invitations

Pending invitations (`status = 'pending'`) count toward Hunt capacity in Build 1. This prevents over-invitation beyond `max_participants`.

## Security

- Invitees can only see their own invitations (via RLS on `hunt_invitations`).
- Inviters can see invitations they created.
- Neither party can see the other's private data (blocks, profile details beyond public display name).
- Block relationships are checked bidirectionally before an invitation is created.
- The invitation `message` field is visible to the invitee — treat it as user content (no HTML, length-limited).

## RPCs

| RPC | Auth Required | Notes |
|---|---|---|
| `invite_to_hunt` | Yes | Creator/co_host only. Block check. Capacity check. |
| `accept_hunt_invitation` | Yes (invitee only) | Capacity recheck. Participation created atomically. |
| `decline_hunt_invitation` | Yes (invitee only) | Idempotent. Cannot decline after accepting. |
