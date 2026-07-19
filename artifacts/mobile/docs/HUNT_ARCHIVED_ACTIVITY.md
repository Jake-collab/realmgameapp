# Hunt Other Activity / Archived Activity (Prompt 14)

## Overview

The Other Activity section covers Hunt participations that ended without completion: withdrawn, removed, cancelled, or expired.

## Statuses Included

| Status | Meaning |
|---|---|
| `withdrawn` | User voluntarily withdrew |
| `removed` | Host or admin removed the participant |
| `cancelled` | The Hunt occurrence was cancelled |
| `expired` | Participation deadline expired |

## Safe Status Notes

The RPC returns a `safe_status_note` per record — a plain-text, user-facing explanation. **No internal removal reasons** are ever exposed (the `removal_note_internal` column is excluded).

| Status | Safe note |
|---|---|
| `withdrawn` | "You withdrew from this Hunt." |
| `removed` | "Your participation in this Hunt ended." |
| `cancelled` | "This Hunt was cancelled." |
| `expired` | "This Hunt participation expired." |

## Stop Progress

Each record includes `stops_completed` and `stops_required` — the number of required stops the user completed before the participation ended. This gives context without exposing locked stop content.

## Access Pattern

- Shown inline (first 3 items) at the bottom of the Completed section
- Full list accessible via the "Load more" link
- Each row taps to `/hunt-other-activity/:participationId` for detail

## RPC: `get_hunt_other_activity`

SECURITY DEFINER. Validates `auth.uid() = p_user_id`. Returns `finalized_at` as the latest of `removed_at`, `completed_at`, `started_at`, or `joined_at`.
