# Hunt Active Privacy — Worlds (Prompt 13)

## Data Minimization Principles

Only the minimum data required for gameplay is transmitted to the client.

## What Is NOT Sent to Client

| Data | Why Not Sent |
|------|-------------|
| Geofence coordinates/radius | Server-side validation only |
| Locked clue text/images | Not yet earned |
| Other participants' proof | Private by default |
| Reviewer identity | Moderator privacy |
| Internal moderation scores | Not user-facing |
| Raw `review_notes` from moderation | Only `review_explanation` (user-safe) sent |
| Other participants' GPS coordinates | Never tracked |
| Hunt creator's exact location | Public meeting info only |

## Location Privacy

- Location is acquired only on explicit user tap of "Check Location"
- Reading is kept in-memory only — never persisted to storage
- Coordinates are sent to the server for proximity check, then discarded
- No location history is maintained on the client
- `ForegroundLocationReading.capturedAt` is not logged to analytics

## Proof Privacy

- Proof images stored in `proof-submissions` Supabase Storage bucket (not public)
- Signed URLs fetched on-demand — not embedded in query cache
- URLs expire (Supabase default TTL applies)
- Other participants never see each other's proof
- Participant can view only their own proof via `get_hunt_stop_submission`

## Group Privacy

`groupSummary` contains only:
```
activeCount: number       // count only
completedCount: number    // count only
totalMemberCount: number  // count only
isReady: boolean          // group readiness
```

No participant names, IDs, profiles, or individual progress visible.

## Analytics

- No clue text or image URLs are logged to analytics
- No proof content is logged
- No GPS coordinates are logged
- Stop completion events use only: `userId`, `huntId`, `participationId`, `stopId`, `validationMethod`

## Data Retention After Withdrawal

When a participant withdraws:
- `hunt_participants` status → `withdrawn`
- `hunt_stop_progress` records preserved
- `proof_submissions` records preserved (moderation record)
- No data deleted on withdrawal

## RLS Summary

All participant-facing data access is gated by:
1. `auth.uid()` match on `user_id` column
2. SECURITY DEFINER RPCs that validate ownership before returning data
3. No direct table queries from client that bypass ownership checks
