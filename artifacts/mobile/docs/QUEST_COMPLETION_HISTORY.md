# Quest Completion History (Prompt 8)

## Overview

The Completed section of the Progress screen shows a user's confirmed quest completions, paginated and filterable. It also surfaces the "Other Activity" subsection (archived participations).

## Data Rules

- Only participations with `status = 'completed'` and a non-null `completed_at` appear
- Points shown are `awarded_points` from the participation row — the server-confirmed amount
- `reward_snapshot_points` is shown only when `awarded_points` is null (rare edge case during processing)
- Reversal status is shown only on the Completion Detail screen

## Filter and Sort

| Filter Dimension | Options                                    |
|------------------|--------------------------------------------|
| Quest Type       | All / Daily / Monthly / Geo-Quest          |
| Sort Order       | Most Recent / Oldest First / Highest Points|

Filters are applied via `FilterBottomSheet` and passed to the `useProgressCompleted` hook, which issues a new query for each filter state change.

## Pagination

Uses `useInfiniteQuery` with `PROGRESS_PAGE_SIZE = 20` items per page. The `PaginationFooter` component provides:
- Load-more button when `hasMore = true`
- Spinner when `isFetchingNextPage = true`
- "All completed quests shown" label at end of list

## Other Activity

Archived participations (abandoned, expired, finally rejected) appear below the completed list in a collapsible subsection. Accessible via `ArchivedActivityRow` → `quest-other-activity/[participationId]`.

**"Other Activity" labels these correctly — never as "Completed".**

## Completion Detail Screen

Path: `app/(main)/quest-completion-detail/[participationId].tsx`

Shows:
- Quest title, type badge, difficulty badge
- Points awarded (confirmed only)
- Completion date and time
- Completed objectives (from `quest_step_progress` → `quest_objectives`)
- Proof summary (owner-only: text response, location verified, image submitted)
- Link to submission history

Does NOT show:
- Review notes or reviewer identity
- Other users' data
- Internal moderation status

## Repository Functions

| Function                          | Table(s)                                        |
|-----------------------------------|-------------------------------------------------|
| `fetchCompletedParticipations`    | `quest_participations` + `quests`               |
| `fetchCompletionDetail`           | Above + `quest_step_progress` + `quest_objectives` + `proof_submissions` + `points_ledger` (reversal check) |
| `fetchOtherActivityParticipations`| `quest_participations` + `quests`               |

All functions use `eq('user_id', userId)` with Supabase RLS as the final authority.
