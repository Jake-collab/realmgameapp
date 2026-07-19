# Hunt Submission History (Prompt 14)

## Overview

Owner-only proof submission history, organized by stop. Accessed from Completion Detail.

**Route:** `/hunt-submission-history/:participationId`

## RPC: `get_hunt_submission_history`

Groups submissions by `hunt_stop_progress_id`. Ordered by `submitted_at ASC` within each stop.

Returns per submission:
- `submission_number` — 1-indexed position within the stop's submission chain
- `status` — current proof status
- `submission_type` — text / image / text_and_image / etc.
- `has_text_response`, `has_image`, `location_verified` — safe boolean flags
- `safe_review_explanation` — the `review_explanation` column, never raw `review_notes`
- `is_latest` — whether this is the most recent submission for the stop
- `previous_submission_id` — links the resubmission chain

## Privacy

- `reviewer_id` never returned
- `review_notes` never returned (use `review_explanation` / `safe_review_explanation`)
- Media paths / signed URLs not returned
- No geofence coordinates

## Display Logic

Each stop is shown as a heading, with its submissions listed below it oldest-to-newest. The `is_latest` flag is used to highlight the current status. The `safe_review_explanation` is shown when the status is `needs_resubmission` or `rejected`.
