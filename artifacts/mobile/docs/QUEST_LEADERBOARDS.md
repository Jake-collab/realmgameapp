# Quest Leaderboards (Prompt 8)

## Overview

The Quest Leaderboard ranks users by their net Quest-only points for a selected time period. It is separate from the global/hunt leaderboard and shows only points earned through Quest completions.

## Period Support

| Period   | Definition                          | Boundary Reset         |
|----------|-------------------------------------|------------------------|
| Week     | Monday UTC to now                   | Resets each Monday UTC |
| Month    | 1st of the month UTC to now         | Resets each month UTC  |
| All Time | No start boundary — full ledger     | Never resets           |

## Point Calculation

Only rows in `points_ledger` where `quest_participation_id IS NOT NULL` are counted. This captures:
- `quest_reward` transactions (positive amount)
- `reversal` transactions for quests (negative amount — automatically offsets the original)

The leaderboard shows **net points** — reversals are already reflected in the aggregate.

## Privacy Rules

Users only appear in the public leaderboard if:
1. `profiles.account_status = 'active'`
2. `user_settings.leaderboard_visibility = TRUE` (or NULL, which defaults to TRUE)

Hidden users:
- Do **not** appear in the public list
- Still receive their own personal rank and points via `get_my_quest_rank` RPC
- See a note: "Your leaderboard visibility is set to private"

## RPC Functions (Migration 019)

### `get_quest_leaderboard(p_period, p_limit, p_offset)`

```sql
-- period: 'week' | 'month' | 'all_time'
-- Returns: rank, user_id, display_name, username, avatar_path, points,
--          is_current_user, is_anonymous
```

- Uses `DENSE_RANK()` — ties share a rank, no gaps in sequence
- Tie-breaking: user with the earlier qualifying point `created_at` wins
- Pagination: `p_limit` (max 100) + `p_offset`
- `SECURITY DEFINER` — uses the function caller's auth.uid() for `is_current_user`

### `get_my_quest_rank(p_period)`

```sql
-- period: 'week' | 'month' | 'all_time' (default: 'all_time')
-- Returns: qualifies, rank, points, total_ranked_users, period
```

- Always returns the current user's own stats regardless of visibility setting
- `rank` is `NULL` when the user is hidden or has no qualifying points

## Scale Notes

The current RPC aggregates live from `points_ledger` on each request. This is correct for Build 1.

**At scale (>10,000 DAU):** Replace with a periodically-refreshed materialized view. The RPC signature and response shape are stable — the data layer changes without breaking clients.

## UI Components

| Component                    | Role                                                |
|------------------------------|-----------------------------------------------------|
| `LeaderboardPeriodSelector`  | Week / Month / All Time toggle                      |
| `CurrentUserRankCard`        | Pinned personal rank + points, always at top        |
| `LeaderboardRow`             | Single ranked entry; medal emoji for top 3          |
| `LeaderboardSkeleton`        | Layout-matching loading state                       |

## Accessibility

- Period selector: `accessibilityRole="tab"` + `accessibilityState={{ selected }}`
- Leaderboard rows: full `accessibilityLabel` including rank, name, points, and "(you)" indicator
- CurrentUserRankCard: single `accessibilityLabel` summarizing rank + points
