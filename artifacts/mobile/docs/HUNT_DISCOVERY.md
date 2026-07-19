# Hunt Discovery

## Overview

The discovery flow covers how users find Hunts on the map and bottom sheet. It is entirely non-destructive — no state is changed during discovery.

## Discovery Entry Points

1. **Hunt Map markers** — tapping a marker shows `HuntPreviewCard` in medium sheet
2. **Hunt nearby list** — scrollable list in expanded bottom sheet sorted by user preference
3. **Place search** — search-this-area button after navigating to a new location
4. **Featured highlights** — `isFeatured` markers get orange star treatment
5. **Filter sheet** — `HuntFilterSheet` narrows visible results

## Sort Orders (Bottom Sheet)

| Sort Key | Description |
|----------|-------------|
| `nearest` | Straight-line distance from user location (default) |
| `starting_soon` | Hunts with an `starts_at` closest to now |
| `featured` | Featured hunts first |
| `highest_points` | Descending by `pointsReward` |
| `shortest` | Ascending by `estimatedDurationMinutes` |
| `easiest` | Easiest difficulty first |

## Filters Available

| Filter | Type | Description |
|--------|------|-------------|
| Available Now | Boolean | Only hunts with open window |
| Starting Soon | Boolean | Starting within 24 hrs |
| Has Space | Boolean | Not at capacity |
| Participation Mode | Single select | Solo / Group / Either |
| Difficulty | Multi-select | Very Easy to Epic |
| Duration | Single select | ≤30m / 1hr / 2hr / 4hr |
| Environment | Single select | Indoor / Outdoor / Both |
| Accessible | Boolean | Has accessibility note |
| In My Hunts | Boolean | Only hunts user has joined |
| Not Joined | Boolean | Only hunts not joined |

Filter state is preserved while user remains in Hunt mode. Cleared on tab unmount.

## Preview Card (Selected Hunt)

Shown in the medium sheet state after tapping a marker. Contains:
- Type badge (Official / Custom / Community)
- Title + summary (public, not locked content)
- Meta chips: duration, stop count, capacity
- Points reward badge
- Primary action button (driven by action resolver)
- "Details" button → Hunt Detail screen

**Does not contain:** locked clue content, validation geometry, private participant data, invitee list, proof submissions.

## Privacy in Discovery

The RPC `get_hunt_map_viewport` enforces:
```sql
WHERE h.status = 'active'
  AND h.privacy = 'public'
```

No unlisted, invite_only, or private hunts ever appear in discovery results. This is server-enforced and not reliant on client-side filtering.
