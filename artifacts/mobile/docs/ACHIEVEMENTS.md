# Achievements — Worlds (Prompt 15)

## Overview

Achievements are permanent recognition for meaningful participation. They are awarded exactly once per user per achievement definition, server-side only. They cannot be purchased. They do not affect gameplay.

## Categories

| Category | Description |
|---|---|
| `quest` | Quest-specific completions and milestones |
| `hunt` | Hunt-specific completions and milestones |
| `worlds` | Cross-mode accomplishments |
| `community` | Social and community participation (future) |
| `exploration` | Geographic and discovery milestones (future) |
| `consistency` | Streaks and habitual participation |
| `special` | Admin/manual only — rare recognition |

## Types

| Type | Description |
|---|---|
| Automatic | Awarded by engine on trigger event |
| Manual | Admin-awarded only (`is_manual = TRUE`) |
| Hidden | Shows as "???" until unlocked, then fully revealed |
| Secret | Requirements never revealed even after unlock |
| Limited-time | Available during a specific window (future) |
| Permanent | Always awardable (default) |
| Retired | No longer awardable (`is_retired = TRUE`) |

## Award Engine

Achievement evaluation is triggered by server-side events:

- Quest completion
- Hunt completion
- Point milestone reached
- Combined milestone reached
- Profile update
- Account age milestone
- Admin action

**Never award from client code. All awards go through the achievement engine.**

## Atomic Award Flow

1. Event triggers evaluation
2. Engine checks eligibility (`rule_key` + `rule_threshold`)
3. `INSERT INTO user_achievements ... ON CONFLICT DO NOTHING` — idempotent
4. Progress snapshot stored as JSONB
5. `achievement_events` audit row created
6. Notification queued (`notification_sent = FALSE → TRUE`)

## Seeded Achievements

| Slug | Name | Category | Rule |
|---|---|---|---|
| `first_quest` | First Quest | quest | quests_completed ≥ 1 |
| `quest_veteran` | Quest Veteran | quest | quests_completed ≥ 25 |
| `quest_champion` | Quest Champion | quest | quests_completed ≥ 100 |
| `first_hunt` | First Hunt | hunt | hunts_completed ≥ 1 |
| `hunt_veteran` | Hunt Veteran | hunt | hunts_completed ≥ 25 |
| `perfect_hunter` | Perfect Hunter | hunt | perfect_hunt ≥ 1 |
| `first_activity` | First Activity | worlds | total_activities ≥ 1 |
| `worlds_explorer` | Worlds Explorer | worlds | both_modes_completed ≥ 1 |
| `points_1000` | 1,000 Points | worlds | combined_points ≥ 1000 |
| `points_10000` | 10,000 Points | worlds | combined_points ≥ 10000 |
| `consistency_week` | Consistent | consistency | daily_streak ≥ 7 |
| `community_founder` | Community Founder | special | manual |
| `beta_tester` | Beta Tester | special | manual |

## Privacy

- Hidden achievements show as "???" in achievement lists when NOT yet unlocked
- Secret achievements never reveal their requirements
- Users may hide their achievement list from public profile (future)

## RPC

`get_my_achievements(p_user_id, p_category)` — SECURITY DEFINER, validates `auth.uid() = p_user_id`

`get_achievement_history(p_user_id, p_limit, p_offset)` — paginated timeline
