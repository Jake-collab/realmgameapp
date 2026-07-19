# Titles — Worlds (Prompt 15)

## Overview

Titles are cosmetic display names shown on a user's profile and beside their username in relevant contexts. Users select one active title from their unlocked collection. Only one title can be active at a time.

## Seeded Titles

| Slug | Name | Description |
|---|---|---|
| `explorer` | Explorer | A curious wanderer of the Worlds |
| `trailblazer` | Trailblazer | Blazing new paths for others to follow |
| `adventurer` | Adventurer | Born to explore |
| `pathfinder` | Pathfinder | Always finds the way |
| `pioneer` | Pioneer | First through uncharted territory |
| `master_hunter` | Master Hunter | The hunt always ends with victory |
| `quest_champion` | Quest Champion | Quests are no match for this player |
| `world_traveler` | World Traveler | A citizen of every world |

## Rules

- No paid titles. `unlock_source` may only be: `achievement | milestone | admin | launch | special`
- Only one title is `is_active = TRUE` per user at any time (enforced by unique partial index)
- Users may select any unlocked title or display none
- Title selection is atomic — old active title cleared before new one set (`set_active_title` RPC)

## Selection Flow

1. User taps an unlocked title in the Titles section
2. Client calls `set_active_title(p_user_id, p_title_id)` RPC
3. RPC verifies ownership, clears old active, sets new active
4. React Query cache invalidated: `titles`, `activeTitle`, `overview`

## RPC

`get_my_titles(p_user_id)` — returns all unlocked titles with `is_active` flag

`set_active_title(p_user_id, p_title_id)` — atomic swap. Raises EXCEPTION if title not unlocked.

## Display Locations

- Profile header (beside display name)
- Progress Overview card
- Future: leaderboard rows, friend activity
