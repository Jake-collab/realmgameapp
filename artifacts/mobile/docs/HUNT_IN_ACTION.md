# Hunt In Action (Prompt 14)

## Overview

The In Action section of Hunt Progress shows all of the user's **active** and **paused** Hunt participations, with the most urgent pending stop surfaced for each.

## Statuses Shown

| ParticipantStatus | Shown in In Action |
|---|---|
| `active` | ✅ |
| `paused` | ✅ |
| `ready` | ❌ (shown in My Hunts) |
| `completed` | ❌ (shown in Completed section) |
| `withdrawn` / `removed` / `cancelled` / `expired` | ❌ (shown in Other Activity) |

## Pending Stop Priority (per Hunt card)

The most urgent pending stop is surfaced on each Hunt card, ranked:

1. `needs_resubmission` — resubmit now
2. `awaiting_proof` — ready to submit proof
3. `in_progress` — active stop
4. `under_review` — proof submitted, waiting
5. `rejected` — final rejection

## Summary Header

The summary strip shows aggregate counts at the top of the section:
- Stops needing resubmission (red)
- Stops awaiting proof (yellow)
- Active hunts (green)
- Stops under review (muted)
- Approaching deadline warning

## RPC: `get_hunt_in_action`

Returns active/paused participations with embedded pending stop and proof state. Validates `auth.uid() = p_user_id`.

## Privacy

- `safeReviewNote` is the `review_explanation` column (user-safe text), never raw `review_notes`
- No validation geometry returned
- No reviewer identity returned
- Locked clues not accessible through this route

## Client

- `useHuntInAction` — 30s stale, 60s refetch interval
- `HuntInActionCard` — full-card UI with progress bar and CTA
- Routes to `/hunt-active/:participationId` on CTA tap
