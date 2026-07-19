# Quest Progress (Prompt 8)

## Overview

The Quest Progress screen (`app/(main)/quest/progress.tsx`) provides the primary hub for a user's Quest activity. It uses a **segmented control** (not separate bottom tabs) to switch between three sections:

| Section       | Content                                                    |
|---------------|------------------------------------------------------------|
| Leaderboards  | Global Quest rankings by period + current-user rank        |
| In Action     | All active, proof-pending, and awaiting-decision quests    |
| Completed     | Paginated confirmed completion history + Other Activity    |

## Default Section Selection

On mount, the screen automatically sets the initial section based on urgency:

```
needs_resubmission > 0  →  In Action
awaiting_proof > 0      →  In Action
totalActive > 0         →  In Action
underReview > 0         →  In Action
(none)                  →  Leaderboards
```

The default is applied **once** using a ref flag — subsequent data refreshes do not re-navigate the user away from their current section.

## Architecture Layers

```
Screen (progress.tsx)
  ├── ProgressSegmentedControl         — tab control component
  ├── LeaderboardsSection              — period selector + leaderboard list + current rank
  ├── InActionSection                  — priority-grouped cards
  └── CompletedSection                 — paginated list + Other Activity + Point History link
```

### Data Layer

```
progressKeys.ts                        — React Query key factory
questProgress.repository.ts            — Supabase data access
hooks/
  useProgressInAction.ts               — active/proof-state participations
  useProgressCompleted.ts              — paginated completed (infinite query)
  useProgressOtherActivity.ts          — paginated archived (infinite query)
  useQuestLeaderboard.ts               — paginated leaderboard (infinite query)
  useMyQuestRank.ts                    — private current-user rank
  useSubmissionHistory.ts              — proof submission history
  useQuestPointHistory.ts              — point ledger (infinite query)
  useCompletionDetail.ts               — full completion detail
```

## Segmented Control

`ProgressSegmentedControl` renders three tab buttons in a single `View`. An urgency dot appears on "In Action" when `needs_resubmission + awaiting_proof > 0`. The urgency count is accessible via `accessibilityLabel`.

## Error States

Each section independently handles error and loading states:

- `isLoading` → section-specific skeleton
- `isError` → `ProgressEmptyState` with retry action
- Empty data → `ProgressEmptyState` with contextual CTA (e.g. "Find a Quest")

## Navigation

| From                    | Destination                                                |
|-------------------------|------------------------------------------------------------|
| In Action card (active) | `/quest-active/[participationId]`                          |
| In Action card (proof)  | `/quest-proof/[participationId]`                           |
| Completed row           | `/quest-completion-detail/[participationId]`               |
| Other Activity row      | `/quest-other-activity/[participationId]`                  |
| Submission history link | `/quest-submission/[participationId]`                      |
| Point history link      | `/quest-point-history`                                     |

## Related Files

- [`QUEST_LEADERBOARDS.md`](./QUEST_LEADERBOARDS.md)
- [`QUEST_COMPLETION_HISTORY.md`](./QUEST_COMPLETION_HISTORY.md)
- [`QUEST_PROOF_HISTORY.md`](./QUEST_PROOF_HISTORY.md)
- [`QUEST_POINT_HISTORY.md`](./QUEST_POINT_HISTORY.md)
- [`QUEST_PROGRESS_TESTING.md`](./QUEST_PROGRESS_TESTING.md)
