---
name: Progression Domain Architecture
description: Prompt 15 — Shared Worlds Progression layer (Achievements, Milestones, Titles, Badges, Statistics). Module layout, security invariants, navigation, and test count.
---

## Module Location

`features/progression/` — same level as `features/hunts/` and `features/quests/`.

Sub-directories: `types/`, `queries/`, `repositories/`, `hooks/`

## Database (migration 025_progression.sql)

Tables: `achievement_definitions`, `user_achievements`, `titles`, `user_titles`, `badges`, `user_badges`, `milestones`, `user_milestones`, `achievement_events`

All tables have RLS. All writes via SECURITY DEFINER RPCs only.

RPCs: `get_my_achievements`, `get_achievement_history`, `get_my_titles`, `set_active_title`, `get_my_badges`, `get_my_milestones`, `get_combined_statistics`, `get_progress_overview`

## Types

`features/progression/types/progression.types.ts` — `AchievementCategory`, `UserAchievement`, `AchievementHistoryRow`, `UserTitle`, `UserBadge`, `UserMilestone`, `CombinedStatistics`, `ProgressOverview`, `ProgressionSection`, `CombinedLeaderboardEntry` (interface only, not implemented), `ProgressionPrivacy`

## Security Invariants

- **Awards are server-only.** No client code writes to `user_achievements`.
- UNIQUE(user_id, achievement_id) prevents duplicates; engine uses INSERT ... ON CONFLICT DO NOTHING.
- `rule_key` is never sent to the client. Only `requirementSummary` (human-readable) is exposed.
- `set_active_title` RPC verifies ownership and performs atomic swap.

**Why:** prevents any client from self-awarding achievements, and avoids leaking engine expressions.

## Navigation

```
Profile screen (quest/profile.tsx — shared, hunt/profile.tsx re-exports it)
  → /profile-achievements  (hub: Overview, History, Titles, Badges, Statistics)
      → /achievement-detail/[achievementId]
```

Both screens registered in `app/(main)/_layout.tsx`.

## Hooks (9 total)

`useAchievements`, `useAchievementHistory` (infinite), `useTitles`, `useActiveTitle`, `useSetActiveTitle`, `useBadges`, `useStatistics`, `useCombinedProgress`, `useProgressOverview`

All use `useAuth().user?.id` for userId. All respect `enabled: Boolean(userId)`.

## Components (10 files)

In `components/progression/`: `AchievementIcon`, `AchievementCard`, `AchievementHistoryRow`, `TitleCard`, `BadgeCard`, `BadgeGrid`, `StatisticsCard`, `ProgressOverviewCard`, `ProgressionEmptyState`, `ProgressionSkeleton`

## Accent Color

`#7C3AED` (Worlds Purple) — distinct from quest orange (`#F97316`) and hunt green (`#059669`). The primary blue `#1D4ED8` remains the Worlds system color; purple is the prestige/achievement color.

**Why:** Achievements are a shared layer over both modes, needing a distinct visual identity.

## Tests

`__tests__/progression.test.ts` — 53 tests. Run: `pnpm test progression.test`

Total at completion of Prompt 15: 780 tests (747 passing, 33 skipped).

## Combined Statistics

`combinedPoints` = all positive ledger entries. `questPoints` = `quest_reward` type. `huntPoints` = `hunt_reward` type. These are never mixed in mode-specific displays. `totalActivities` = questsCompleted + huntsCompleted (server-verified).
