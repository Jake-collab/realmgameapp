# Worlds Progression System (Prompt 15)

## Overview

The Progression system is the shared recognition layer that ties Quest and Hunt together without changing their individual mechanics. It rewards meaningful participation permanently, with prestige and recognition rather than gameplay advantages.

## Guiding Principles

- **Permanent** — achievements cannot be revoked (except by admin)
- **Non-pay-to-win** — no paid achievements, titles, or badges
- **Meaningful** — achievements celebrate real accomplishments, not spam
- **Server-enforced** — all awards happen server-side; client never awards
- **Isolated** — no changes to Quest or Hunt gameplay logic

## Feature Architecture

```
features/progression/
  types/         ← All domain types (progression.types.ts)
  queries/       ← React Query key factory (progressionKeys.ts)
  repositories/  ← Data access via SECURITY DEFINER RPCs
  hooks/         ← 9 React Query hooks
```

## Navigation

```
Profile (Quest or Hunt tab)
  ↓ tap "Achievements"
/profile-achievements  ← hub with 5 sections
  ├── Overview      ← achievement grid with category filter
  ├── History       ← paginated timeline, newest first
  ├── Titles        ← unlock list with active-title selector
  ├── Badges        ← unlocked badge grid
  └── Statistics    ← cross-mode aggregated stats
        ↓ tap achievement
/achievement-detail/:achievementId  ← full detail
```

## Database

| Table | Purpose |
|---|---|
| `achievement_definitions` | Static achievement catalogue (admin-managed) |
| `user_achievements` | Unlocked achievements (one per user/achievement) |
| `titles` | Static title catalogue |
| `user_titles` | Unlocked titles with is_active flag |
| `badges` | Static badge catalogue |
| `user_badges` | Unlocked badges with is_pinned flag |
| `milestones` | Static milestone definitions |
| `user_milestones` | Reached milestones with valueAtAward |
| `achievement_events` | Audit log of all award events |

## RPCs

| RPC | Purpose |
|---|---|
| `get_my_achievements` | Unlocked achievements (optionally filtered by category) |
| `get_achievement_history` | Paginated timeline newest-first |
| `get_my_titles` | Unlocked titles with is_active |
| `set_active_title` | Atomic swap of active title |
| `get_my_badges` | Unlocked badges with is_pinned |
| `get_my_milestones` | Reached milestones |
| `get_combined_statistics` | Cross-mode aggregate stats |
| `get_progress_overview` | Compact profile header summary |

## Future

- Combined leaderboard (interface documented, not implemented — see `CombinedLeaderboardEntry` type)
- Badge pinning UI
- Animated badges
- Streak tracking
- Friends / social (Prompt 16+)
- Creator milestones
- Moderation milestones
