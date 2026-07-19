# Badges — Worlds (Prompt 15)

## Overview

Badges are cosmetic profile decorations earned through participation. They appear in the Badges section of the user's Achievements hub and optionally pinned to the profile card. Badges have no gameplay effect.

## Seeded Badges

| Slug | Name | Category | Source |
|---|---|---|---|
| `first_quest` | First Quest | quest | achievement |
| `first_hunt` | First Hunt | hunt | achievement |
| `quest_100` | 100 Quests | quest | achievement |
| `hunt_veteran` | Hunt Veteran | hunt | achievement |
| `worlds_explorer` | Worlds Explorer | worlds | achievement |
| `community_founder` | Community Founder | special | admin |
| `beta_tester` | Beta Tester | special | admin |

## Rules

- No paid badges. `unlock_source` may only be: `achievement | milestone | admin | launch | special`
- At most one badge is `is_pinned = TRUE` per user (unique partial index)
- Badges carry no `multiplier`, `pointsBonus`, or any gameplay attribute
- `artwork_url` is optional; falls back to icon-based display

## Pinned Badge

Users may pin one badge for prominent display on their profile card. The pinned badge appears in the Progress Overview alongside the active title.

## Future

- Animated badges (future — `has_animation` flag reserved)
- Badge sharing (Prompt 16+)
- Rarity tier display

## RPC

`get_my_badges(p_user_id)` — returns all unlocked badges with `is_pinned` flag
