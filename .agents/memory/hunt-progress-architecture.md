---
name: Hunt Progress Architecture
description: Prompt 14 — complete Hunt Progress feature: leaderboards, In Action, Completed, deep screens, 12 components, 5 screens, 10 hooks, migration 024, 50 tests
---

## Rule
Hunt Progress (Prompt 14) is complete. All infrastructure written; tests pass at 727 total.

## Key locations
- Main screen: `app/(main)/hunt/progress.tsx` — 3-section segmented control
- Deep screens: `app/(main)/hunt-completion-detail/`, `hunt-other-activity/`, `hunt-submission-history/`, `hunt-point-history.tsx`
- Components: `components/hunt-progress/` (13 files)
- Hooks: `features/hunts/hooks/useHunt{InAction,Completed,Leaderboard,MyHuntRank,CompletionDetail,StopHistory,SubmissionHistory,PointHistory,OtherActivity,ProgressSummary}.ts`
- Types: `features/hunts/types/huntProgress.types.ts`
- Keys: `features/hunts/queries/huntProgressKeys.ts`
- Repo: `features/hunts/repositories/huntProgress.repository.ts`
- Migration: `supabase/migrations/024_hunt_progress.sql`
- Tests: `__tests__/huntProgress.test.ts`
- Docs: `docs/HUNT_PROGRESS.md`, `HUNT_LEADERBOARDS.md`, `HUNT_IN_ACTION.md`, `HUNT_COMPLETION_HISTORY.md`, `HUNT_COMPLETION_DETAIL.md`, `HUNT_LEADERBOARD_PRIVACY.md`, `HUNT_PROGRESS_SECURITY.md`, `HUNT_STOP_HISTORY.md`, `HUNT_SUBMISSION_HISTORY.md`, `HUNT_POINT_HISTORY.md`, `HUNT_ARCHIVED_ACTIVITY.md`, `HUNT_PROGRESS_TESTING.md`

## Critical invariants
- Hunt leaderboard uses `transaction_type = 'hunt_reward'` ONLY — never mixes Quest points
- `resolveDefaultHuntProgressSection` priority: resubmission > awaiting_proof > active > under_review > arrivedFromCompletion > lastSection > leaderboards
- Locked clue stops excluded from all history RPCs (`WHERE status <> 'locked'`)
- `review_explanation` (safe column) used — never `review_notes` or `reviewer_id`
- `HuntInActionCard` CTA routes to `/hunt-active/:participationId` (not quest routes)
- No raw geo in any history or progress screen
- All 4 deep screens registered in `app/(main)/_layout.tsx`

**Why:** Quest and Hunt point isolation is load-bearing — mixing would corrupt leaderboards and ledgers.

## Layout registrations added (in _layout.tsx)
hunt-completion-detail/[participationId], hunt-other-activity/[participationId], hunt-submission-history/[participationId], hunt-point-history
