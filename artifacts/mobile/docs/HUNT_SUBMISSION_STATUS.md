# Hunt Submission Status — Worlds (Prompt 13)

## Overview

`HuntSubmissionStatus` displays the current proof submission state for a stop that has been submitted. Shown inline on the Active Hunt screen when the stop's `progressStatus` is `under_review`, `awaiting_proof`, `needs_resubmission`, or `rejected`.

## Component Props

```typescript
interface HuntSubmissionStatusProps {
  submission: HuntProofSubmissionDetail
  stopTitle: string
  onResubmit: () => void
  onViewDetails?: () => void
}
```

## Status → Visual Config

| Status | Icon | Color | Action |
|--------|------|-------|--------|
| `draft` | edit-3 | muted | — |
| `submitted` | send | gray | — |
| `under_review` | clock | amber | — (waiting) |
| `needs_resubmission` | alert-circle | amber | Resubmit |
| `approved` | check-circle | green | — |
| `rejected` | x-circle | red | Resubmit |

## Review Explanation

The `reviewExplanation` field is a user-safe string set by the reviewer for `needs_resubmission` and `rejected` statuses. It is displayed in a muted explanation box below the status row.

Rules:
- Only shown for `needs_resubmission` / `rejected`
- Maximum one paragraph — no HTML or markdown
- Set by the reviewer in moderation tooling
- Never contains: reviewer identity, moderation scores, internal rule names

## Resubmit Flow

When user taps "Resubmit Proof":
1. `onResubmit()` called → `setShowProofDraft(true)` in Active Hunt screen
2. `useHuntProofDraft` initialized with `previousSubmissionId` from `submissionDetail.submissionId`
3. New proof submission created, linked via `previous_submission_id` FK
4. Stop progress updated to `under_review` again

## Data Source

`HuntProofSubmissionDetail` comes from `useHuntSubmissionDetail` hook:
- Calls `get_hunt_stop_submission` RPC
- Returns safe subset (no reviewer identity, no internal fields)
- Refreshed every 15 seconds during `under_review` state
- Invalidated on successful proof submission

## `mediaItems` Display

The `mediaItems` array contains `{ mediaId, sortOrder }` objects. To display proof images, the client must fetch signed URLs from Supabase Storage using the media service. This step is not implemented in Prompt 13 but the data structure is ready for it.
