# Social Security — Worlds (Prompt 16)

## Security Invariants

### Friendship
- Users cannot forge friendship rows directly (no INSERT on `friendships` for `authenticated` role).
- `accept_friend_request` RPC verifies `recipient_id = auth.uid()`.
- `remove_friend` RPC verifies the caller is one of the two friends.
- Duplicate friendships are prevented by a partial unique index.
- Accepted friendship is created atomically with the request status update.

### Friend Requests
- `cancel_friend_request` verifies `requester_id = auth.uid()`.
- `accept_friend_request` verifies `recipient_id = auth.uid()`.
- `decline_friend_request` verifies `recipient_id = auth.uid()`.
- Expired requests cannot be accepted (server checks `expires_at`).
- Pending limit (100) is server-enforced.
- Duplicate pending requests are prevented by a partial unique index.

### Blocking
- `block_user` verifies `auth.uid()` is the blocker.
- Blocked users cannot read block rows (RLS: `blocker_user_id = auth.uid() AND is_active = TRUE`).
- `are_users_blocked()` checks both directions.
- Block atomically removes friendship and cancels requests.

### Public Profile
- `get_public_profile` enforces visibility rules server-side.
- Blocked-by-other returns generic `{unavailable: true}` — cannot distinguish from not-found.
- Email, phone, exact location never appear in any RPC output.
- Active Hunt/Quest participation never revealed.
- Proof content never revealed.
- `rule_key` from progression never revealed.

### Search
- Authentication required (`auth.uid() IS NULL → 42501`).
- Minimum query length (2 chars) enforced in RPC.
- Blocked users excluded from results.
- Suspended/deactivated accounts excluded.
- Non-discoverable users excluded.
- No email search path exists.

### Progression
- Public progression fields controlled by target's privacy settings.
- Hidden achievements remain hidden (not exposed on public profiles).
- `rule_key` never sent to client (only `requirementSummary`).
- Unearned titles and badges cannot be displayed (server-verified before granting).

### Service Role
- No service-role key is bundled in the mobile app.
- All RPCs use `auth.uid()` for authentication.
- All writes use `SECURITY DEFINER` RPCs.

### Rate Limits
- Friend requests: max 100 active outgoing.
- Reports: max 5 per day.
- Decline cooldown: 7 days.
- Removal cooldown: 1 day.
- Unblock cooldown: 1 day.
- Exact thresholds never exposed to client.

## RLS Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `friend_requests` | requester OR recipient | SECURITY DEFINER only | SECURITY DEFINER only | No |
| `friendships` | either participant | SECURITY DEFINER only | SECURITY DEFINER only | No |
| `user_blocks` | blocker only (active) | SECURITY DEFINER only | SECURITY DEFINER only | No |
| `social_privacy_settings` | owner only | trigger / SECURITY DEFINER | owner (UPDATE) | No |

## Privacy Verification Checklist

- [x] Exact locations never displayed on public profiles
- [x] Active Quest/Hunt participation remains private
- [x] Proof content never displayed
- [x] Invitation history never displayed
- [x] Block relationships private from blocked users
- [x] Reports always private
- [x] Hidden achievements remain hidden
- [x] Private statistics omitted (not null-padded)
- [x] Hidden leaderboard identities remain hidden
- [x] Mutual-friend counts exclude blocked/hidden users
- [x] Search excludes suspended and deactivated accounts
- [x] Deep links revalidate access on every mount
- [x] Notification routes revalidate access before rendering private fields
