# Quest Security — Worlds

## Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Client awards own points | `points_ledger` INSERT blocked by RLS; only SECURITY DEFINER RPC can insert |
| Client completes own quest | `complete_quest` RPC validates state and uses snapshot, not client-supplied amount |
| Client sees others' proof | RLS on `proof_submissions` — `auth.uid() = user_id` |
| Client accesses geofence data | `quest_geofences` has no RLS read policy for clients — zero rows returned |
| Client claims quest reward twice | Unique `idempotency_key` in `points_ledger` prevents double-insert |
| Client submits after proof approval | `updateDraftProof` uses `WHERE status IN ('draft', 'uploading')` |
| Client transitions to terminal state | `TRUSTED_ONLY_PARTICIPATION_TRANSITIONS` blocks `completed`/`rejected` from client |
| Client manipulates reviewer fields | RLS: `reviewer_id`, `review_notes`, `reviewed_at` not updatable by proof owner |
| Race condition duplicate start | Participation insert fails unique constraint; client detects and returns existing |
| Guest/unauthenticated quest access | All quest participation tables require `auth.uid()` via RLS |
| Fake location coordinates | Geo validation uses `quest_geofences` (server-only) — client coordinates are advisory only |

---

## RLS Policy Summary

### `quests` — Public read, no client writes

```sql
SELECT: status = 'published' AND (available_from IS NULL OR available_from <= NOW())
                              AND (available_until IS NULL OR available_until > NOW())
INSERT/UPDATE/DELETE: service_role only
```

### `quest_participations` — Owner only

```sql
SELECT: user_id = auth.uid()
INSERT: user_id = auth.uid()
UPDATE: user_id = auth.uid()  AND status NOT IN ('completed', 'rejected')
  -- Completion/rejection can only be set via SECURITY DEFINER RPC
DELETE: none
```

### `proof_submissions` — Owner only

```sql
SELECT: user_id = auth.uid()
INSERT: user_id = auth.uid()
UPDATE: user_id = auth.uid()  AND status IN ('draft', 'uploading')
  -- Reviewer fields excluded from updateable set
DELETE: none
```

### `quest_geofences` — Completely blocked for clients

```sql
-- No SELECT policy for authenticated role.
-- Zero rows are returned to any client query.
-- Validation happens via Edge Function with service_role access.
```

### `points_ledger` — Read own, no insert

```sql
SELECT: user_id = auth.uid()
INSERT: none  -- RPC only
UPDATE: none  -- immutable by trigger
DELETE: none  -- immutable by trigger
```

### `quest_occurrences` — Public read for published, active instances

```sql
SELECT: is_published = TRUE AND available_from <= NOW() AND available_until > NOW()
```

### `quest_prerequisites` — Public read for published quest prerequisites

```sql
SELECT: EXISTS (SELECT 1 FROM quests WHERE id = quest_id AND status = 'published')
```

---

## SECURITY DEFINER RPCs

### `complete_quest(p_participation_id, p_user_id, p_idempotency_key)`

Security properties:
- `SECURITY DEFINER SET search_path = public` — prevents schema injection
- `auth.uid() = p_user_id` — caller identity check at entry
- `participation.user_id = p_user_id` — ownership double-check
- Points come from `reward_snapshot_points` in DB — client cannot supply amount
- Idempotency key uniqueness prevents double-award
- Executes with elevated privileges — only `authenticated` role can call (REVOKE from PUBLIC)

### `abandon_quest(p_participation_id, p_user_id)`

Security properties:
- `auth.uid() = p_user_id` — identity check
- Cannot abandon `under_review` participations (review must resolve first)
- Cannot abandon terminal states (completed, rejected, abandoned, expired)
- No points awarded or reversed

---

## Sensitive Data Handling

| Data | Handling |
|------|---------|
| Geofence polygons | Server-only. Never in API response, never in types exposed to client |
| Proof image content | Never logged. Events log `submission_type` only |
| Reviewer notes | Not accessible to proof owner via RLS |
| Review decisions | Participation/proof status update propagates the decision — raw notes are hidden |
| GPS coordinates | Approximate user position for display only; precise validation happens server-side against `quest_geofences` |
| `SUPABASE_SERVICE_ROLE_KEY` | Never in `EXPO_PUBLIC_*`. Never in mobile bundle. Used only by server-side code. |

---

## Input Validation

### Quest start

Validated at multiple layers:
1. React Query mutation (`useStartQuest`) — UI layer checks state before calling
2. `evaluateQuestEligibility` — full eligibility evaluation including account, quest, prerequisites
3. `insertParticipation` — DB unique constraints catch races
4. `complete_quest` RPC — final server-side state validation

### Proof submission

- Text length: `MIN_PROOF_TEXT_LENGTH` ≤ text ≤ `MAX_PROOF_TEXT_LENGTH` (client-side + server-side)
- Image count: ≤ `MAX_PROOF_IMAGES` per submission
- Resubmission limit: ≤ `MAX_RESUBMISSIONS` (enforced by proof review workflow)
- Status guard: `WHERE status IN ('draft', 'uploading')` prevents editing submitted proof

---

## What the Mobile Client Cannot Do

The following actions are impossible for the mobile client:

- Award points (INSERT blocked by RLS)
- Set `quest.status` (no UPDATE policy)
- Set `proof_submissions.reviewer_id`, `review_notes`, `reviewed_at`
- Read `quest_geofences` rows (no SELECT policy)
- Set participation status to `completed` or `rejected` directly (SECURITY DEFINER guard)
- Insert into `points_ledger` (blocked by RLS)
- Modify other users' participations, proof, or step progress
- Abandon a participation while its proof is under review
- See another user's proof content

---

## Audit Trail

- Every point award has an `idempotency_key` and `created_at` — non-deletable.
- Every proof resubmission is linked via `previous_submission_id` — full chain preserved.
- Every participation start/complete/abandon records its own timestamp (`started_at`, `completed_at`, `abandoned_at`).
- Domain events (analytics) log user intent without logging private content.
