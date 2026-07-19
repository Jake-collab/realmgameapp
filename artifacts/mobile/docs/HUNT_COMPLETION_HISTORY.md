# Hunt Completion History (Prompt 14)

## Overview

The Completed section shows all of the user's completed Hunt participations, paginated, with filter and sort options.

## Filter Options

| Field | Options |
|---|---|
| `mode` | `all | solo | group | ordered | unordered` |
| `sortOrder` | `newest | oldest | highest_points | most_stops` |

Default filter: `{ mode: 'all', sortOrder: 'newest' }`.

## Data Per Row

- Hunt title
- Completed date
- Awarded points (confirmed server-side only)
- Stop counts (required completed / total required)
- Optional stops completed
- Group / ordering badges
- Occurrence label

## RPC: `get_hunt_completed`

SECURITY DEFINER. Validates `auth.uid() = p_user_id`. Supports all filter and sort combinations via `p_mode_filter` and `p_sort_order`.

## Route to Detail

Each row taps to `/hunt-completion-detail/:participationId`.

## Other Activity

At the bottom of the Completed section, the first 3 Other Activity items (withdrawn/removed/cancelled/expired) are shown inline. Full list available at `/hunt-other-activity`.

## Pagination

Uses `useInfiniteQuery` with page size `HUNT_PROGRESS_PAGE_SIZE` (20).
