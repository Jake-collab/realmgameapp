---
name: Quest Progress Architecture
description: Prompt 8 — In Action, Leaderboards, Completed, deep screens, migration 019, repository/hooks/components structure.
---

## What Was Built

**Migration:** `019_quest_leaderboard_rpc.sql`
- `get_quest_leaderboard(p_period, p_limit, p_offset)` — quest-only leaderboard with period support
- `get_my_quest_rank(p_period)` — private personal rank
- Filters: `quest_participation_id IS NOT NULL` (nets reversals automatically)
- DENSE_RANK with earliest-qualifying-at tie-break

**Repository:** `features/quests/repositories/questProgress.repository.ts`

**Types:** `features/quests/types/questProgress.types.ts`

**Query keys:** `features/quests/queries/progressKeys.ts`

**Hooks** (all in `features/quests/hooks/`):
- useProgressInAction, useProgressCompleted (infinite), useProgressOtherActivity (infinite)
- useQuestLeaderboard (infinite), useMyQuestRank
- useSubmissionHistory, useQuestPointHistory (infinite), useCompletionDetail

**Screens:**
- `app/(main)/quest/progress.tsx` — full replacement with 3-section segmented control
- `app/(main)/quest-completion-detail/[participationId].tsx`
- `app/(main)/quest-other-activity/[participationId].tsx`
- `app/(main)/quest-submission/[participationId].tsx`
- `app/(main)/quest-point-history.tsx`

**Components** (all in `components/quest/`):
- ProgressSegmentedControl, QuestProgressCard, LeaderboardRow, CurrentUserRankCard
- LeaderboardPeriodSelector, CompletionHistoryRow, ReviewStatusTimeline
- PointTransactionRow, ProgressEmptyState, ProgressSkeleton, ArchivedActivityRow
- PaginationFooter, FilterBottomSheet

## Key Design Decisions

**Why `quest_participation_id IS NOT NULL` for leaderboard:**  
Correctly nets reversals (negative amounts) without needing a join. Handles future non-quest transaction types without mixing.

**Why DENSE_RANK not RANK:**  
Ties share rank with no gaps (1, 2, 2, 3) — better UX.

**Why default section uses a ref flag:**  
Prevents re-navigation when the user manually switches tabs and data refreshes.

**`has_image` doesn't exist on ProofSubmissionRow:**  
Derived from `submission_type IN ('photo', 'video')` instead.

**Safe review note rule:**  
`review_notes` only exposed when `status = 'needs_resubmission'`, truncated to 500 chars. All other statuses get null.

## Scale Note

Migration 019 RPCs aggregate live from `points_ledger`. Correct for Build 1. At >10K DAU, replace with materialized leaderboard snapshot. RPC signature is stable — clients don't change.
