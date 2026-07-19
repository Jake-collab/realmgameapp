# Hunt Progress Testing (Prompt 14)

## Test File

`artifacts/mobile/__tests__/huntProgress.test.ts`

Run with:
```
cd artifacts/mobile && pnpm test huntProgress
```

## Test Coverage

### Section Selection (`resolveDefaultHuntProgressSection`)
- Leaderboards default when no urgent items
- Needs-resubmission triggers In Action (highest priority)
- Awaiting-proof triggers In Action
- Active hunts trigger In Action
- Under-review triggers In Action
- `arrivedFromCompletion` triggers Completed when no urgency
- Urgent items beat `arrivedFromCompletion`
- Last section is respected when no urgency
- Leaderboards is always the final fallback

### Status Classification
- `HUNT_IN_ACTION_STATUSES` contains only `active` and `paused`
- `HUNT_OTHER_ACTIVITY_STATUSES` contains withdrawn/removed/cancelled/expired
- The two sets are disjoint (no status appears in both)

### Leaderboard Privacy
- Anonymous entries have `null` userId and username
- Non-anonymous entries have userId and username
- `huntPoints` field is separate from quest `points`
- No `email` or `account_status` on entries

### Point Isolation
- Only `hunt_reward`, `reversal`, `admin_adjustment` are valid types
- `quest_reward` is excluded from Hunt transaction types
- Net points sum correctly (reward + negative reversal)
- Reversal chain links correctly via `reversedLedgerId`
- `displayLabel` is used, never raw `reason`

### Completion Detail Guards
- `hasReversal` flag is present
- `awardedPoints` can be null
- No private geo fields on detail
- No reviewer identity fields

### Other Activity Guards
- Safe notes present for all statuses
- No `removal_note_internal` or internal fields exposed

### Security Invariants
- Anonymous leaderboard users cannot be identified
- No raw `reason` field on transactions
- No internal removal reason on other activity
- `account_status` not present on leaderboard entries
- `locked` not in valid stop statuses list

## Running All Tests

```
cd artifacts/mobile && pnpm test
```

Expected: ≥ 644 passing tests (all prior tests continue to pass).
