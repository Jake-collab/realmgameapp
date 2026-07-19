# Hunt Active Security — Worlds (Prompt 13)

## Core Security Invariants

### 1. No Private Geometry on Client

Validation geofence coordinates (lat/lng/radius) from `hunt_stop_geofences` are **never** returned to the client. The `validate_hunt_stop_location` RPC computes proximity server-side and returns only a `validated: boolean`.

### 2. No Locked Clue Content

Clue content (`clue_text`, `image_media_id`) is only included in `fetchActiveHunt` when `stop.status !== 'not_started' && stop.status !== 'locked'`. Locked clues are filtered before any data leaves the database layer.

### 3. No Optimistic Completion

Neither stop completion, hunt completion, nor points award are applied optimistically. The client waits for server RPC results before updating UI. All mutations have `retry: 0` to prevent accidental double-execution.

### 4. Server-Authoritative Points

Points are awarded in `complete_hunt` (migration 021) via an idempotency key: `hunt_completion:{participationId}`. The `points_ledger` INSERT is wrapped in the same transaction as the `hunt_participants` status update.

### 5. Proof Images Are Private

Proof images are stored in the `proof-submissions` storage bucket (never public). Signed URLs are fetched separately and never embedded in RPC responses. The `get_hunt_stop_submission` RPC returns only `mediaId` values — the client fetches signed URLs independently.

### 6. Location Not Transmitted as Payload

When submitting proof for `image_and_location` stops, the client does NOT transmit the exact GPS coordinates as proof content. The location was already validated via `validate_hunt_stop_location`. The `submit_hunt_stop_proof` call includes `p_location_lat/lng: null`.

### 7. Reviewer Identity Not Exposed

`get_hunt_stop_submission` returns `review_explanation` (user-safe text) but NOT `reviewer_id`. Moderator identities are never surfaced to participants.

### 8. Resubmission Chain Integrity

`submit_hunt_stop_proof` validates `previous_submission_id` belongs to the calling user and the same stop progress. Cross-user resubmission reference is rejected.

## SECURITY DEFINER Functions (Migration 023)

All four new RPCs use `SECURITY DEFINER`:
- `submit_hunt_stop_proof` — validates ownership before creating proof record
- `validate_hunt_stop_location` — computes proximity without exposing geofence
- `get_hunt_stop_submission` — returns safe subset only
- `get_hunt_completion_readiness` — evaluates readiness without exposing stop details

## RLS Policies

- `proof_submissions_owner_read`: participants can SELECT their own rows
- `hunt_participants`: RLS enforced via existing migration 008 policies
- `hunt_stop_progress`: RLS enforced via existing migration 008 policies
- Service role used only in SECURITY DEFINER functions, never on client

## Input Validation

All RPC inputs validated before processing:
- Participation ID ownership (auth.uid() match)
- Stop belongs to participation's hunt
- Participation status in `['active', 'paused']`
- Previous submission ID belongs to same user + stop

## No Client-Side Geofence Math

The client has no geofence data to compute proximity. There is no fallback "client-side validation" path. If the RPC is unavailable, the validation fails gracefully with a retry prompt.
