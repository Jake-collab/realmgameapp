# Hunt Stop History (Prompt 14)

## Overview

Stop-by-stop completion history for a Hunt participation. Shown within the Completion Detail screen.

## RPC: `get_hunt_stop_history`

Returns all non-locked stops for a participation, ordered by `stop_number ASC`, `completed_at ASC`.

### Excluded
- Stops with `status = 'locked'` — locked clue content must never be accessible through history

### Included Stop Statuses
`completed`, `in_progress`, `awaiting_proof`, `under_review`, `needs_resubmission`, `rejected`

## Data Per Stop

- Stop title and number
- `is_required` flag
- Completion method (text, image, location, etc.)
- Completed date
- Proof summary (safe fields only):
  - `has_image` — inferred from `submission_type`
  - `has_text_response` — from `text_response IS NOT NULL`
  - `location_verified` — from `location_validated`
  - `proof_approved_at`

## Privacy

- No raw proof media URLs or paths
- No reviewer identity
- No geofence coordinates
- `review_explanation` used instead of `review_notes`

## Client Component

- `HuntStopHistoryRow` — renders one stop entry
- Shown in `HuntCompletionDetailScreen`, grouped into required and optional sections
