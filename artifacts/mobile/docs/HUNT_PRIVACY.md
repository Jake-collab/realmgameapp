# Hunt Privacy — Worlds

## Privacy Levels

| Privacy | Visibility | Join Requirement |
|---|---|---|
| `public` | Visible on map and search to everyone | Open or invitation-optional |
| `unlisted` | Accessible by direct link only — not shown on map | Open or invitation-optional |
| `invite_only` | Visible to invitees; map shows marker only to participants | Valid pending invitation required |
| `private` | Only visible to participants and invitees | Valid pending invitation required |

## Join Policy (independent from Privacy)

| Join Policy | Behavior |
|---|---|
| `open` | Any eligible user may join (subject to capacity) |
| `approval_required` | Creator must approve join requests (Build 5+) |
| `invite_only` | Invitation required, regardless of privacy level |

A Hunt can be `public` with `join_policy = 'invite_only'` — visible to all, but joining requires an invitation.

## Access Control Function

```sql
can_access_hunt(p_hunt_id UUID, p_user_id UUID) → BOOLEAN
```
Returns TRUE when:
- Hunt privacy is `public` or `unlisted`
- OR user is an active participant or pending invitee (for `invite_only` / `private`)

Excludes `declined`, `removed`, `left`, `expired` participants.

## Stop Geometry Privacy

Three tiers of location data:

| Tier | Accessible To | Data |
|---|---|---|
| Public display | Everyone (map) | `hunt_stop_geofences.public_lat / public_lng` (approximate) |
| Revealed coordinates | Active participants (server-gated) | Approximate coords sent only when `server_reveal_state = 'revealed_to_participant'` — via Edge Function (Build 5+) |
| Validation geometry | Server only (never client) | `hunt_stop_geofences.validation_point / validation_polygon` — RLS `USING (FALSE)` |

## Clue Content Privacy

| Reveal Rule | When Shown |
|---|---|
| `on_stop_reveal` | When `server_reveal_state = 'revealed_to_participant'` for the stop |
| `on_request` | After participant explicitly requests (future: with penalty) |
| `timed` | After `reveal_after_seconds` from stop unlock time |

**`hint_text` is never included in `ActiveHuntClue`** — it is only accessible after an explicit hint request (future prompt, with optional penalty_points).

## Participant Removal Privacy

When a participant is removed:
- `removal_note_internal` is stored in the database but **never included in any API response or domain type**.
- The removed participant sees only `removal_reason` (a non-specific public reason).
- Removal event analytics include only `removedUserId` — no reason or note.

## Block Relationship Enforcement

The `invite_to_hunt` RPC checks both directions of the `user_blocks` table:
```sql
(blocker_id = inviter AND blocked_id = invitee) OR
(blocker_id = invitee AND blocked_id = inviter)
```
A blocked user cannot be invited, and cannot invite the user who blocked them.
