# Hunt Completion Detail (Prompt 14)

## Overview

Full detail view for a single completed Hunt participation. Accessed from Completed history row.

**Route:** `/hunt-completion-detail/:participationId`

## Data Shown

- Hunt title and summary
- Completion date and start date
- Points awarded (with reversal warning if applicable)
- Stop progress (required / optional)
- Group info (member count if group hunt)
- Hunt ordering (ordered / free-roam)
- Occurrence label

## Stop History Section

All non-locked stops are listed with:
- Stop number and title
- Completion status
- Proof type indicators (image / text / location)
- Proof approved date

Locked stops are completely excluded via the RPC `WHERE hsp.status <> 'locked'`.

## Links

- Proof Submission History → `/hunt-submission-history/:participationId`
- Hunt Point History → `/hunt-point-history`

## Reversal Notice

If `hasReversal = true`, a warning banner appears explaining that a reward adjustment was made. The banner links to Hunt Point History for details. No reversal amount is shown in the detail — the full ledger breakdown is in Point History.

## RPCs

- `get_hunt_completion_detail` — main detail
- `get_hunt_stop_history` — stop list

## Privacy

- No validation geometry
- No reviewer identity
- No raw review_notes
- Locked clues excluded
