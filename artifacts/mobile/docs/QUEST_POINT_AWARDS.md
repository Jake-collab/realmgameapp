# Quest Point Awards — Worlds

## Core Principles

1. **Snapshot at start** — `reward_snapshot_points` captures `quest.points_reward` when participation is created. The user is awarded the locked-in amount regardless of future reward changes.
2. **Atomic award** — completion status update and point insert happen atomically in the `complete_quest` RPC.
3. **Idempotent insert** — the `idempotency_key` unique constraint in `points_ledger` prevents double-awarding under any retry or race condition.
4. **Append-only ledger** — points are never deleted. Corrections use a reversal entry.
5. **Client cannot award points** — `points_ledger` INSERT is blocked for `authenticated` role by RLS. Only the `complete_quest` RPC (SECURITY DEFINER) writes to the ledger.

---

## Points Ledger Schema

```sql
points_ledger
  id                UUID PRIMARY KEY
  user_id           UUID REFERENCES profiles(id)
  amount            INTEGER NOT NULL CHECK (amount > 0)
  transaction_type  TEXT ('quest_reward' | 'reversal' | 'bonus' | 'admin_adjustment' | ...)
  source_type       TEXT ('quest' | 'hunt' | 'admin' | ...)
  source_id         UUID     ← quest_id or hunt_id
  quest_participation_id UUID ← links to the specific participation
  reason            TEXT     ← human-readable description
  idempotency_key   TEXT UNIQUE NOT NULL
  created_at        TIMESTAMPTZ NOT NULL
  -- Immutable: trigger blocks UPDATE/DELETE
```

The `idempotency_key` format for quest completion:
```
quest_completion:{participation_id}
```

Example: `quest_completion:a1b2c3d4-1234-5678-abcd-ef1234567890`

---

## complete_quest RPC

```sql
-- Called by mobile client or Edge Function
SELECT complete_quest(
  p_participation_id := 'uuid',
  p_user_id          := 'uuid',
  p_idempotency_key  := 'quest_completion:uuid'
);
```

Returns JSON:
```json
{
  "awarded_points": 100,
  "completed_at": "2026-07-19T14:30:00Z",
  "ledger_id": "uuid",
  "was_already_completed": false
}
```

The RPC:
1. Validates `auth.uid() = p_user_id`
2. Locks the participation row
3. Returns existing result if already completed (idempotent)
4. Validates state (`in_progress`, `started`, or `under_review`)
5. Resolves `reward_snapshot_points` from the DB (not from client)
6. Updates participation to `completed`
7. Inserts `points_ledger` row with `ON CONFLICT (idempotency_key) DO NOTHING`

---

## User Point Totals

```sql
-- View: user_point_totals
SELECT total_points, quest_points, hunt_points, bonus_points
FROM user_point_totals
WHERE user_id = 'uuid';
```

Aggregated from `points_ledger`. Reversals are deducted (same `amount` value, filtered by `transaction_type = 'reversal'`). The view is defined in migration `009_points_and_achievements.sql`.

---

## Point Reward Guidelines

Admins use `point_reward_guidelines` when setting a quest's reward:

| Difficulty | Suggested Range | Min Duration | Max Duration |
|-----------|-----------------|-------------|-------------|
| `very_easy` | 10–50 pts | 0–10 min | — |
| `easy` | 50–150 pts | 10–30 min | — |
| `medium` | 150–300 pts | 30–60 min | — |
| `hard` | 300–600 pts | 60–120 min | — |
| `very_hard` | 600–1000 pts | 120+ min | — |
| `expert` | 1000+ pts | Varies | — |

These are suggestions. Admins may set any value in `[MIN_QUEST_POINTS, MAX_QUEST_POINTS]` = `[1, 10000]`.

---

## Point Reversals

Points are never deleted. Incorrect awards are corrected via a reversal entry:

```typescript
const reversal = buildReversalLedgerEntry({
  originalTransactionId: 'ledger-uuid',
  userId: 'user-uuid',
  originalAmount: 100,
  reason: 'Quest credited in error — quest was not actually available',
  adminId: 'admin-uuid',
});
// Insert via service role / Edge Function — not accessible to mobile client
```

The reversal's `idempotency_key = 'reversal:{originalTransactionId}:{adminId}'` prevents double-reversals.

**Mobile client never sees this** — the `buildReversalLedgerEntry()` function is documentation of the contract for the admin panel (Prompt 17).

---

## Development Mode

When `EXPO_PUBLIC_SUPABASE_URL` is not configured, the completion service returns a mock result with 100 points. No DB writes are made. The mock result is clearly labeled in dev logs.

```typescript
if (!isSupabaseConfigured()) {
  return { success: true, participationId, awardedPoints: 100, completedAt: now, wasAlreadyCompleted: false };
}
```
