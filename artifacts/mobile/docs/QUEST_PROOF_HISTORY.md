# Quest Proof Submission History (Prompt 8)

## Overview

The Submission History screen (`app/(main)/quest-submission/[participationId].tsx`) shows the complete proof submission trail for a single participation. It is owner-only — RLS on `proof_submissions` enforces this server-side.

## Privacy Rules

| Field                | Exposed?                                              |
|----------------------|-------------------------------------------------------|
| `review_notes`       | **Only** when `status = 'needs_resubmission'` (truncated to 500 chars) |
| `reviewer_id`        | Never                                                 |
| `moderation_status`  | Never (internal field)                                |
| `location_lat/lng`   | Never exposed as coordinates; shown as "Location check-in provided" |
| `text_response`      | Yes — owner's own content                             |
| `submission_type`    | Yes — shown as human label (Photo, Text response, etc.) |
| `has_image`          | Derived from `submission_type IN ('photo', 'video')` — no DB column |

## Submission Number

Submissions are numbered 1, 2, 3 … in ascending `submitted_at` order. The latest submission is marked "Latest". When shown in the screen, submissions are displayed newest-first (reversed), but the timeline is chronological.

## Review Status Timeline

`ReviewStatusTimeline` renders the sequence of events as a vertical timeline:

```
Submission #1   [submitted_at date]
Under Review
Resubmission Requested

Submission #2
Approved
```

Steps are derived from `SubmissionHistoryItem[]` — one submission row becomes multiple timeline steps.

## Screen Navigation

- Entry point: `CompletionHistoryRow` → "View submission history" link in `CompletionDetail`
- Entry point: `QuestProgressCard` (In Action → needs_resubmission status card)
- Back navigation: `router.canGoBack()` → `router.back()` else `router.replace('/quest/progress')`

## Hook

`useSubmissionHistory(participationId)` → `progressKeys.submissionHistory(participationId)` → `fetchSubmissionHistory`

Stale time: 60 seconds (changes after review decisions)
