# Hunt Point Awards — Worlds

## Award Model

Points for Hunt completion are awarded **exactly once** via an idempotency key in the `points_ledger` table. The client never directly controls point award.

## Idempotency

```
Idempotency key format: hunt_completion:{participationId}
```

The `complete_hunt` RPC:
1. Checks `EXISTS (SELECT 1 FROM points_ledger WHERE idempotency_key = key)`.
2. If already awarded: returns the existing result without inserting again.
3. If not yet awarded: inserts into `points_ledger` with `ON CONFLICT (idempotency_key) DO NOTHING`.

This ensures double-calling `complete_hunt` (e.g., due to network retry) never double-awards points.

## Reward Source

Points are always read from **`reward_snapshot.pointsReward`** stored at join/start time:

```sql
v_reward_points := COALESCE(
  (v_participant.reward_snapshot->>'pointsReward')::INTEGER,
  (SELECT points_reward FROM hunts WHERE id = v_participant.hunt_id)
);
```

- The fallback to `hunts.points_reward` is for safety only (legacy rows without a snapshot).
- Active participant rewards are **never affected by post-join Hunt edits**.

## Reward Snapshot Capture

Snapshot is built at `join_hunt` time:
```json
{
  "huntVersion": 1,
  "occurrenceId": "...",
  "pointsReward": 800,
  "requiredStopCount": 6,
  "proofConfigVersion": 1,
  "completionDeadline": "2026-07-26T18:00:00Z",
  "participationMode": "solo",
  "groupRewardRule": "individual_full_reward",
  "snapshotAt": "2026-07-19T14:30:00Z"
}
```

If a Hunt raises its point reward after you join: you receive the points from the snapshot at join time, not the new amount.

## Group Reward Rules

Build 1 default: `individual_full_reward`
- Each participant receives the full configured reward.
- No shared pool or contribution-based splits in Build 1.

Future: `shared_pool`, `contribution_based` rules (Build 5+).

## Points Ledger Entry

```sql
INSERT INTO points_ledger (
  user_id, amount, transaction_type,
  reference_id, idempotency_key, description
) VALUES (
  user_id, reward_points, 'hunt_reward',
  participation_id, 'hunt_completion:{id}',
  'Hunt completed: {hunt_title}'
);
```

## Profile Balance Update

After inserting the ledger entry:
```sql
UPDATE profiles SET total_points = total_points + reward_points WHERE id = user_id;
```

Both operations happen in the same RPC transaction — they are atomic.

## Completion Deadline

The completion deadline comes from `reward_snapshot.completionDeadline` (set at join time from `occurrence.complete_until` → `occurrence.ends_at` → `hunt.ends_at`).

If the deadline has passed when `complete_hunt` is called, the RPC returns an error. The client should display an expired state instead of showing the Finish button.

## Security

- `points_ledger` is append-only. The client can read their own entries but **cannot insert or update** (RLS enforced).
- `profiles.total_points` is updated by trusted server functions only.
- The `completionIdempotencyKey` column on `hunt_participants` is `UNIQUE` — a second insert with the same key would fail even if the `points_ledger` check were somehow bypassed.
