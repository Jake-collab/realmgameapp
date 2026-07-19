# Hunt Progress Security (Prompt 14)

## RPC Authorization Pattern

All Hunt Progress RPCs run as `SECURITY DEFINER` and validate caller identity:

```sql
IF auth.uid() IS DISTINCT FROM p_user_id THEN
  RAISE EXCEPTION 'Unauthorized';
END IF;
```

This means:
- No authenticated user can read another user's In Action, Completed, Submission History, Point History, or Other Activity.
- The only exception is `get_hunt_leaderboard`, which returns only publicly visible, privacy-filtered data (no private per-user breakdown).

## What Is Never Returned

| Field | Why |
|---|---|
| `review_notes` | Internal reviewer notes, never user-facing |
| `reviewer_id` | Reviewer identity is private |
| Geofence coordinates / radius | Validation geometry is backend-only |
| `removal_note_internal` | Internal moderation field |
| Locked clue content | Locked stops excluded with `WHERE status <> 'locked'` |
| Other users' ledger entries | RLS + `auth.uid()` validation |

## Safe Alternatives

| Sensitive field | Safe alternative |
|---|---|
| `review_notes` | `review_explanation` (user-safe column) |
| Geo coordinates | `location_validated BOOLEAN` |
| Image URLs | `has_image BOOLEAN` |

## Leaderboard

- Hidden users (`leaderboard_visibility = FALSE`) are excluded from public rows.
- Suspended accounts (`account_status != 'active'`) are excluded.
- Anonymous entries: `userId`, `username`, `avatarPath` returned as `null`.

## Client-Side Rules

- Never derive points from client-side calculations. Use `awarded_points` from the server.
- Never show raw `review_notes`. Only render `safeReviewNote` / `safeReviewExplanation`.
- Never construct proof URLs client-side. Signed URLs are handled separately.
- Never show reversal amounts in completion detail — link to Point History.
