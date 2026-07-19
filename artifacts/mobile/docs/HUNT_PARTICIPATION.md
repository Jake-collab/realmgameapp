# Hunt Participation — Worlds

## Participation Record

A `hunt_participants` row is created when a user joins or accepts an invitation. It is the authoritative membership record for a user in a Hunt (or Occurrence).

```
HuntParticipant {
  id, huntId, occurrenceId?,
  userId, role: creator|player|co_host,
  status: invited|accepted|ready|active|paused|completed|declined|removed|left|expired,
  joinedAt, readyAt, startedAt, completedAt,
  withdrawnAt, withdrawalReason,         ← user withdrawal
  removedAt, removedByUserId, removalReason,  ← host removal
  removalNoteInternal,                   ← NEVER sent to client
  awardedPoints,                         ← set by server only
  rewardSnapshot,                        ← JSONB snapshot at join/start time
  completionIdempotencyKey,              ← prevents duplicate point awards
  createdAt, updatedAt
}
```

## Joining

`join_hunt(huntId, occurrenceId?)`:
1. Verifies active account + published hunt + privacy + capacity (advisory lock).
2. Checks existing participation for idempotency.
3. Builds **reward snapshot** from Hunt configuration at join time.
4. Creates `hunt_participants` row (`status = 'accepted'`).
5. Increments `hunt_occurrences.participant_count` (if occurrence specified).
6. Initializes stop progress records (first stop for ordered hunts; all stops for unordered).
7. Emits `hunt_joined` domain event.

## Reward Snapshot

Stored at join (or updated at start) time. Contains:
```json
{
  "huntVersion": 1,
  "occurrenceId": "...",
  "pointsReward": 800,
  "requiredStopCount": 6,
  "proofConfigVersion": 1,
  "completionDeadline": "...",
  "participationMode": "solo",
  "groupRewardRule": "individual_full_reward",
  "snapshotAt": "..."
}
```

Later edits to the Hunt (e.g., point value change) do not affect active participants. `complete_hunt` uses `reward_snapshot.pointsReward`, never the current `hunts.points_reward`.

## Starting

`start_hunt(participationId)`:
1. Verifies participation ownership and valid start status (`accepted`, `ready`).
2. Checks hunt status and start window.
3. For host-controlled hunts: only `creator`/`co_host` role may trigger.
4. Marks first stop `available` (ordered) or all required stops `available` (unordered).
5. Sets `status = 'active'`, `started_at = NOW()`.

## Withdrawal

`withdraw_from_hunt(participationId, reason?)`:
- Participant-initiated (not removal).
- Not available for `completed` participation.
- Sets `status = 'left'`, `withdrawn_at = NOW()`.
- Decrements `occurrence.participant_count` to reopen a capacity slot.
- Does **not** affect `awardedPoints` or `reward_snapshot`.
- Idempotent: calling again returns success.

## Removal

`remove_hunt_participant(participantId, reason, internalNote?)`:
- Only `creator` or `co_host` may remove.
- Cannot remove the `creator` role.
- Sets `status = 'removed'`, `removed_at = NOW()`, `removed_by_user_id`, `removal_reason`.
- `removal_note_internal` is stored but **never returned to the removed participant**.
- Decrements `occurrence.participant_count`.

## Completion

`complete_hunt(participationId)`:
- Verifies all required stops are `completed` (server-side check).
- Verifies completion deadline (from `reward_snapshot`).
- Inserts `points_ledger` row with `idempotency_key = 'hunt_completion:{participationId}'`.
- Updates `profiles.total_points`.
- Sets `awarded_points`, `completed_at`, `status = 'completed'`.
- Idempotent: second call returns existing completion without double-awarding.

## Cancellation

`cancel_hunt_occurrence(occurrenceId, reason?)`:
- Creator/co_host only.
- Sets `occurrence.status = 'cancelled'`, `cancelled_at`, `cancellation_reason`.
- Active participations are **not** automatically refunded or removed in Build 1.
- Future prompt: add cancellation notification and optional grace period.

## Role Hierarchy

| Role | Can invite | Can start (host-controlled) | Can remove participants |
|---|---|---|---|
| `creator` | Yes | Yes | Yes |
| `co_host` | Yes | Yes | Yes |
| `player` | No (Build 1) | No | No |
