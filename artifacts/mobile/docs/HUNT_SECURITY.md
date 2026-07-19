# Hunt Security — Worlds

## Threat Model Summary

The Hunt domain handles physical-world challenges where security matters for:
1. **Fairness**: preventing participants from completing stops without visiting.
2. **Privacy**: protecting exact stop locations from non-participants.
3. **Financial integrity**: ensuring points are awarded exactly once.
4. **Participant safety**: not exposing one participant's location to another.

## Private Stop Geometry

`hunt_stop_geofences.validation_point` and `.validation_polygon` are **never accessible to clients**:

```sql
-- RLS policy on hunt_stop_geofences
CREATE POLICY no_client_reads ON hunt_stop_geofences FOR SELECT USING (FALSE);
```

- Only `SECURITY DEFINER` RPCs (running as `service_role`) can read this data.
- No API route or client query can return raw geofence coordinates.
- The client submits a coordinate; the server evaluates containment and returns only a boolean result.

## Clue Content Protection

- `hint_text` is **never included in any domain type** — omitted from `ActiveHuntClue` entirely.
- `clueText` is only included in authorized responses when `server_reveal_state = 'revealed_to_participant'`.
- `features/hunts/repositories/hunt.repository.ts` filters progress by `status != 'locked' | 'not_started'` before constructing the response.

## Trusted-Only Transitions

The following state transitions may only be performed by trusted server logic:

| Entity | Transition | Reason |
|---|---|---|
| Participant | `completed` | Points award must be atomic; server owns completion |
| Participant | `removed` | Host authority verification required |
| Participant | `expired` | Time-based; not user-triggered |
| Stop | `completed` | Proof or location validation required |
| Stop | `rejected` | Reviewer authority required |
| Stop | `under_review` | Server-side proof ingestion |

Client code uses `TRUSTED_ONLY_PARTICIPANT_TRANSITIONS` and `TRUSTED_ONLY_STOP_TRANSITIONS` sets to guard against accidental privilege escalation in UI logic.

## Reward Idempotency

```
idempotency_key = 'hunt_completion:{participationId}'
```

- `points_ledger` has a UNIQUE constraint on `idempotency_key`.
- `complete_hunt` checks for existing awards before inserting.
- `hunt_participants.completion_idempotency_key` also has a UNIQUE constraint.
- Double-completion is impossible even under concurrent requests.

## Capacity Enforcement

The `join_hunt` and `accept_hunt_invitation` RPCs use a PostgreSQL advisory lock:
```sql
PERFORM pg_advisory_xact_lock(hashtext('join_hunt:' || hunt_id));
```

This prevents two concurrent joins from both passing the capacity check and creating over-capacity participation.

## Error Message Safety

All user-facing error messages are in `ELIGIBILITY_USER_MESSAGES` and `HuntErrors.*`:
- **Never expose SQL errors, relation names, or RLS policy names.**
- `normalizeHuntError()` maps raw DB errors to safe domain errors.
- `assertRpcSuccess()` extracts only `userMessage` from RPC responses.

Unit tests in `hunt.test.ts` verify that `ELIGIBILITY_USER_MESSAGES` values do not contain SQL keywords.

## Block Relationship Enforcement

`invite_to_hunt` checks `user_blocks` bidirectionally:
- The inviter cannot invite someone they've blocked.
- A blocked user cannot be invited by the user who blocked them.
- Neither direction is surfaced to the client as a reason (returns generic `BLOCK_RELATIONSHIP` code).

## Participant Removal Privacy

The `removal_note_internal` column:
- Is stored in the database for moderation purposes.
- Is **never included in any API response**, domain type, or event payload.
- The removed participant sees only `removal_reason` (a non-specific, operator-vetted string).

## Domain Event Outbox Safety

`hunt_domain_events.payload`:
- **Never includes:** private geometry, proof contents, hint text, moderation notes, access tokens, or private user data.
- Contains only safe scalar metadata (event type, huntId, participationId, etc.).
- Client direct reads are blocked: `CREATE POLICY no_client_read ... USING (FALSE)`.

## Security Checklist for New Hunt Features

- [ ] Does the new data type expose private stop geometry? → Remove it.
- [ ] Does the new type include `hintText`? → Remove it.
- [ ] Does the new type include `removal_note_internal`? → Remove it.
- [ ] Is a state transition client-callable that should be trusted-only? → Add to `TRUSTED_ONLY_*` sets.
- [ ] Does a new point award use `idempotency_key`? → Required.
- [ ] Does a new RPC use advisory lock for capacity changes? → Required.
- [ ] Does a new error message expose SQL, relation names, or policy names? → Replace with safe message.
