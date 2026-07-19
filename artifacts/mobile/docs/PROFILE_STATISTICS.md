# Profile Statistics (Prompt 15)

## Overview

Combined statistics aggregate Quest and Hunt participation into a single view. All values are server-computed via the `get_combined_statistics` RPC. **Never derive statistics client-side.**

## Statistics Fields

| Field | Description |
|---|---|
| `questsCompleted` | Total Quests with status = 'completed' |
| `huntsCompleted` | Total Hunts with status = 'completed' |
| `totalActivities` | questsCompleted + huntsCompleted |
| `questPoints` | Sum of `quest_reward` ledger entries |
| `huntPoints` | Sum of `hunt_reward` ledger entries |
| `combinedPoints` | Sum of all positive ledger entries |
| `achievementsUnlocked` | Count of user_achievements rows |
| `titlesUnlocked` | Count of user_titles rows |
| `badgesUnlocked` | Count of user_badges rows |
| `accountAgeDays` | Days since auth.users.created_at |

## Point Isolation

Quest points (`quest_reward`) and Hunt points (`hunt_reward`) are tracked separately and never merged. Combined points include both plus any admin adjustments.

## Display

Statistics are shown in the **Statistics** section of the Achievements hub under groupings:
- Activities (quests, hunts, total)
- Points (combined, quest, hunt)
- Recognition (achievements, titles, badges)
- Membership (account age)

## Privacy

Users may hide their statistics from public profile view (future). Statistics are always visible to the account owner.

## RPC

`get_combined_statistics(p_user_id)` — SECURITY DEFINER, validates `auth.uid() = p_user_id`. Returns single row.
