# Hunt Leaderboards (Prompt 14)

## Overview

The Hunt leaderboard ranks users by net Hunt points earned within a chosen time period. It is strictly Hunt-only — Quest points are never included.

## RPC: `get_hunt_leaderboard`

**Type:** `SECURITY DEFINER`  
**Visibility:** Public (but privacy-filtered)

### Parameters
- `p_period TEXT` — `'week' | 'month' | 'all_time'`
- `p_limit INT` — max 100 per page
- `p_offset INT` — cursor-based pagination

### Period Boundaries
- **week** — Monday 00:00 UTC (ISO week)
- **month** — 1st of month 00:00 UTC
- **all_time** — no start boundary

### Point Source
Only `points_ledger` rows with `transaction_type = 'hunt_reward'` (plus offsetting reversals). No Quest points. No other transaction types.

### Ranking
`DENSE_RANK` — ties share a rank (1, 2, 2, 3). Secondary tie-break: earliest qualifying `hunt_reward` row by `created_at`.

## Privacy

| Visibility Setting | Public Rank | Name | Avatar | Points |
|---|---|---|---|---|
| `visible` | ✅ | ✅ | ✅ | ✅ |
| `anonymous` | ✅ | "Anonymous Explorer" | ❌ | ✅ |
| `hidden` | ❌ (excluded) | — | — | — |

Suspended/deactivated accounts (`account_status != 'active'`) are excluded from public rankings.

Hidden users receive their private personal rank via `get_my_hunt_rank`.

## RPC: `get_my_hunt_rank`

Returns the current user's private Hunt rank and point total regardless of their visibility setting. A hidden user sees their points but receives `rank = null` with a reason string.

## Client Components

- `HuntLeaderboardPeriodSelector` — week / month / all time toggle
- `HuntCurrentRankCard` — pinned self-rank card
- `HuntLeaderboardRow` — single leaderboard entry
- `useHuntLeaderboard` — infinite query hook
- `useMyHuntRank` — current-user rank hook

## Invalidation

Leaderboard and current-rank caches are invalidated after:
- Hunt completion (point award)
- Reversal applied to a hunt_reward transaction
