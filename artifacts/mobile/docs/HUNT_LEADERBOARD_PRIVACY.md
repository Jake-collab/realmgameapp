# Hunt Leaderboard Privacy (Prompt 14)

## Three Visibility Modes

Users control their leaderboard presence via their profile's `leaderboard_visibility` and `is_anonymous_on_leaderboard` settings.

### Visible (default)
- Appears in public ranking with display name, username, avatar initial
- Full rank shown

### Anonymous
- Appears in public ranking as "Anonymous Explorer"
- `userId`, `username`, `avatarPath` are all `null` in RPC output
- Ranked normally; rank is shown without identity

### Hidden (`leaderboard_visibility = FALSE`)
- Completely excluded from public leaderboard rows
- Receives private point total and rank estimate via `get_my_hunt_rank`
- `rank` returned as `null` with `no_rank_reason` explaining why

## Account Status Filtering

Only accounts with `account_status = 'active'` appear in public rankings. Suspended, deactivated, or banned accounts are excluded server-side.

## Cross-User Safety

The RPC never returns another user's point breakdown. `get_my_hunt_rank` validates `auth.uid()` and only returns the calling user's private data.

## Client Rendering Rules

`HuntCurrentRankCard` always checks `rank.qualifies` before rendering a rank number. If `rank` is `null`, it shows the `noRankReason` string (e.g., "No qualifying Hunt points" or "Leaderboard visibility is disabled").

`HuntLeaderboardRow` checks `entry.isAnonymous` before rendering name/avatar and shows "Anonymous Explorer" if true.

## Period Boundaries

Period boundaries are calculated server-side in UTC:
- **week** — Monday 00:00 UTC
- **month** — 1st of month 00:00 UTC
- **all_time** — no start boundary

Period labels shown to the user: "This Week", "This Month", "All Time".
