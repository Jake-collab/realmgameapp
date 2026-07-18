# Points System — Worlds

## Design Principle

Points are tracked in an **append-only ledger** (`points_ledger`), never as
a single mutable total column. This provides:

- Full audit history of every point event
- Idempotent retry safety (unique `idempotency_key`)
- Correct concurrent totals (no race-condition drift)
- Non-destructive corrections (reversal transactions)

---

## Tables

### `points_ledger`

One row per point event. Rows are immutable — `UPDATE` and `DELETE` raise exceptions.

```
id                  — UUID primary key
user_id             — the recipient
amount              — positive = credit; reversals use the reversal transaction type
transaction_type    — quest_reward | hunt_reward | achievement_reward | admin_adjustment | reversal
source_type         — quest | hunt | achievement | admin | system
source_id           — UUID of the quest/hunt/achievement that triggered the award
quest_participation_id / hunt_participant_id / achievement_id — direct FK for quick joins
reason              — human-readable audit note
idempotency_key     — prevents duplicate awards (UNIQUE)
created_by          — NULL = server; non-NULL = admin who performed adjustment
reversed_transaction_id — for reversals: FK to the original transaction
```

### `user_point_totals` (view)

```sql
SELECT user_id, COALESCE(SUM(amount), 0) AS total_points
FROM points_ledger
GROUP BY user_id;
```

This is the **only** authoritative source for a user's balance.
Never cache totals in a separate column.

---

## Transaction Types

| Type | Created by | Notes |
|---|---|---|
| `quest_reward` | Server (Edge Function) | After quest completion proof is approved |
| `hunt_reward` | Server (Edge Function) | After hunt completion |
| `achievement_reward` | Server (achievement evaluator) | On achievement unlock |
| `admin_adjustment` | Admin RPC | Manual correction; always logged in audit_logs |
| `reversal` | Admin RPC | Corrects a prior transaction; `reversed_transaction_id` required |

---

## Idempotency Key Format

```
{transaction_type}:{source_id}:{user_id}
```

Example:
```
quest_reward:a1b2c3d4-...-quest-uuid:e5f6a7b8-...-user-uuid
```

The server generates this key before inserting. If the transaction already exists (unique
violation), the insert is safely ignored — preventing double-awards on retry.

---

## Point Award Flow (Build 1 Architecture)

```
User submits proof
        ↓
proof_submissions.status → 'submitted'
        ↓
Moderator / automated review
        ↓
proof_submissions.status → 'approved'
quest_participations.status → 'completed'
        ↓
Server Edge Function (Build 4+):
  1. Generate idempotency_key
  2. Check points_ledger for existing key
  3. If absent: INSERT into points_ledger
  4. UPDATE quest_participations.awarded_points
  5. INSERT into audit_logs
        ↓
points_ledger updated
user_point_totals view refreshes on next query
```

**Clients cannot award themselves points.** RLS blocks `INSERT` on `points_ledger`.
The `awarded_points` column on `quest_participations` and `hunt_participants` is
set only by service_role logic.

---

## Correcting Mistakes

Never `DELETE` or `UPDATE` a ledger row. Instead:

```sql
-- Example: reverse an erroneous 500-point quest reward
INSERT INTO points_ledger (
  user_id, amount, transaction_type,
  source_type, reason, idempotency_key,
  created_by, reversed_transaction_id
) VALUES (
  '<user-id>',
  -500,               -- negative reversal amount? No — see note below
  'reversal',
  'admin',
  'Erroneous award for quest xyz — reversed by admin',
  'reversal:<original-ledger-id>:<user-id>',
  '<admin-user-id>',
  '<original-ledger-id>'
);
```

> **Note**: The amount for a reversal is the negation of the original.
> The `user_point_totals` view sums all amounts, so the net effect is zero.

---

## Leaderboard Views

Four views are derived from `points_ledger`:

| View | Filter |
|---|---|
| `leaderboard_global` | All transaction types, all time |
| `leaderboard_monthly` | All types, rolling 30 days |
| `leaderboard_quest` | `transaction_type = 'quest_reward'` |
| `leaderboard_hunt` | `transaction_type = 'hunt_reward'` |

All views filter out users where `user_settings.leaderboard_visibility = FALSE`.

Paginate in the application layer:

```typescript
// Example
const { data } = await supabase
  .from('leaderboard_global')
  .select('*')
  .range(0, 49);  // first 50 results
```

---

## Calibration Reference

The `point_reward_guidelines` table provides suggested ranges (not enforced):

| Difficulty | Est. minutes | Suggested range |
|---|---|---|
| Very easy | 5–10 | 25–50 pts |
| Easy | 10–20 | 75–125 pts |
| Medium | 20–45 | 150–250 pts |
| Hard | 45–90 | 300–500 pts |
| Epic | 120+ | 750–2,000 pts |

Admins may override these values for individual quests. The calibration table exists
to give consistent guidance to quest creators and, eventually, the AI generation system.
