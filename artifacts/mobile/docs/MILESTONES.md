# Milestones — Worlds (Prompt 15)

## Overview

Milestones are threshold-based recognition events that trigger when a user's tracked metric crosses a threshold. They are distinct from achievements — milestones are structural (seeded thresholds) while achievements are design-driven (specific accomplishments).

## Categories

| Category | Metric Key | Description |
|---|---|---|
| `quest` | `quests_completed` | Quest completion counts |
| `hunt` | `hunts_completed` | Hunt completion counts |
| `combined` | `total_activities` | Combined Quest + Hunt completions |
| `points` | `combined_points` | Total Worlds points earned |
| `special` | varies | One-off recognition |

## Seeded Milestones

| Slug | Threshold | Category |
|---|---|---|
| `first_activity` | 1 | combined |
| `first_quest` | 1 | quest |
| `quests_10` | 10 | quest |
| `quests_25` | 25 | quest |
| `quests_100` | 100 | quest |
| `first_hunt` | 1 | hunt |
| `hunts_10` | 10 | hunt |
| `hunts_25` | 25 | hunt |
| `hunts_50` | 50 | hunt |
| `hunts_100` | 100 | hunt |
| `hunts_250` | 250 | hunt |
| `points_1000` | 1,000 | points |
| `points_10000` | 10,000 | points |
| `activities_50` | 50 | combined |
| `activities_100` | 100 | combined |

## Milestone Engine Rules

- Each milestone awards exactly once (`UNIQUE (user_id, milestone_id)`)
- `value_at_award` records the actual metric value when milestone was reached
- Milestones do not grant points. They may unlock achievements, titles, or badges.
- No notification spam — milestone notifications respect the notification system

## RPC

`get_my_milestones(p_user_id)` — SECURITY DEFINER, returns reached milestones newest-first
