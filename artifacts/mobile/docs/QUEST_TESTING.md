# Quest Domain Testing — Worlds

## Test Architecture

Quest domain tests are pure unit tests — no network calls, no database, no Expo-specific modules.

All tests are in `__tests__/` and use `testEnvironment: 'node'` to avoid React Native import errors.

```
__tests__/
  questScheduling.test.ts     ← Occurrence keys, availability windows, cooldowns
  questStateMachine.test.ts   ← Participation and proof transition validation
  questEligibility.test.ts    ← Synchronous eligibility evaluator
  questAvailability.test.ts   ← Full availability state evaluation
  questErrors.test.ts         ← Error factory and normalization
  questCompletion.test.ts     ← Progress helpers and reversal contract
```

---

## Running Tests

```bash
# From workspace root
pnpm --filter @workspace/mobile test

# Watch mode
pnpm --filter @workspace/mobile test:watch

# Coverage
pnpm --filter @workspace/mobile test:coverage
```

Or from the mobile artifact directory:
```bash
cd artifacts/mobile
pnpm test
```

---

## Test Coverage Areas

### Scheduling (`questScheduling.test.ts`)

| Scenario | Test |
|---------|------|
| Daily occurrence key format | `buildDailyOccurrenceKey` → `daily:{slug}:{YYYY-MM-DD}` |
| Monthly occurrence key format | `buildMonthlyOccurrenceKey` → `monthly:{slug}:{YYYY-MM}` |
| UTC date boundary | Start near midnight UTC uses correct UTC date |
| Availability window open | `isWithinAvailabilityWindow` returns true |
| Availability window before start | Returns false |
| Availability window after end | Returns false |
| No available_from/until | Defaults to open |
| Upcoming quest | `isUpcoming` returns true before available_from |
| Repeat cooldown elapsed | `checkRepeatCooldown` onCooldown=false |
| Repeat cooldown active | onCooldown=true, remainingSeconds > 0 |
| Daily expiry at end of day | Capped at UTC midnight |
| Daily expiry at quest deadline | Capped at available_until |
| Countdown format | Seconds, minutes, hours, days, "now" for past |

### State Machine (`questStateMachine.test.ts`)

| Scenario | Test |
|---------|------|
| Valid participation transitions | started→in_progress, in_progress→awaiting_proof, etc. |
| Blocked completion (untrusted) | `completed`/`rejected` require trusted=true |
| Trusted completion allowed | trusted=true bypasses guard |
| Terminal participation states | Cannot leave completed/abandoned/expired |
| Cannot abandon under_review | Blocked by transition table |
| Proof draft editable | `isProofEditable(draft)` = true |
| Proof submitted immutable | `isProofEditable(submitted)` = false |
| Reviewer-only proof transitions | `approved`/`rejected`/`needs_resubmission` need trusted |
| Quest content terminal | archived is terminal |
| Quest content visibility | Only `published` is visible |

### Eligibility (`questEligibility.test.ts`)

| Scenario | Reason Code |
|---------|------------|
| No userId | `NOT_AUTHENTICATED` |
| No profile | `NOT_AUTHENTICATED` |
| Suspended account | `ACCOUNT_SUSPENDED` |
| Deactivated account | `ACCOUNT_SUSPENDED` |
| Restricted account | `ACCOUNT_RESTRICTED` |
| Onboarding incomplete | `ONBOARDING_INCOMPLETE` |
| Paused quest | `QUEST_PAUSED` |
| Expired quest | `QUEST_EXPIRED` |
| Draft quest | `QUEST_NOT_PUBLISHED` |
| Quest not yet started | `QUEST_NOT_STARTED_YET` |
| Quest window closed | `QUEST_EXPIRED` |
| Geo quest, no location permission | `LOCATION_PERMISSION_REQUIRED` |
| Active participation exists | `ACTIVE_PARTICIPATION_EXISTS` + participationId |
| Awaiting proof | `ACTIVE_PARTICIPATION_EXISTS` |
| Needs resubmission | `ACTIVE_PARTICIPATION_EXISTS` |
| Non-repeatable already completed | `ALREADY_COMPLETED` |
| Repeatable quest with completion | `ELIGIBLE` (no cooldown) |
| Abandoned participation | `ELIGIBLE` (not blocked) |
| Fully qualified user + quest | `ELIGIBLE` |

### Availability (`questAvailability.test.ts`)

| Scenario | Availability State |
|---------|-------------------|
| started participation | `active` |
| in_progress participation | `active` |
| awaiting_proof participation | `awaiting_proof` |
| under_review participation | `under_review` |
| needs_resubmission participation | `needs_resubmission` |
| completed participation | `completed` |
| abandoned participation | falls through to `available` |
| Paused quest | `paused` |
| Expired/archived quest | `expired` |
| Upcoming quest | `upcoming` + availableFrom |
| Hard expiration + active participation | `expired` |
| started_users_may_finish + expired quest | `active` (not expired) |
| Eligible user | `available` + `canStart=true` + occurrenceKey |
| Suspended user | `ineligible` |
| Batch evaluation | Correct state for each quest in map |
| Home active selector: needs_resubmission wins | Correct priority |

### Error Utils (`questErrors.test.ts`)

| Scenario | Result |
|---------|--------|
| All known error codes | Create without throw, have message |
| Non-retriable errors | `canRetry=false` |
| Retriable errors | `canRetry=true` |
| Technical field not exposed | `technical=undefined` (non-dev) |
| Cooldown error with hours | Message includes hours |
| Cooldown error under 1h | Message says "soon" |
| Pass-through QuestDomainError | Same reference returned |
| `Failed to fetch` | `NETWORK_UNAVAILABLE` |
| Unique constraint | `REWARD_ALREADY_ISSUED` |
| RLS policy violation | `NOT_ELIGIBLE` |
| Unknown error | `SERVER_ERROR` |

### Completion Utils (`questCompletion.test.ts`)

| Scenario | Result |
|---------|--------|
| No objectives | Zero progress, null currentStep |
| 0% with required steps | 0% progressPercent |
| Partial required steps | Correct percent, correct currentStep |
| All required done | 100%, completionReadiness=ready, null currentStep |
| Optional steps excluded from count | Only required count |
| Reversal entry: transaction_type | `reversal` |
| Reversal entry: amount | Original amount (not negated) |
| Reversal entry: idempotency | `reversal:{txId}:{adminId}` |

---

## Writing New Tests

### Naming convention

`{domain}.test.ts` for pure unit tests, `{domain}.integration.test.ts` for tests requiring a live DB.

### Test data factories

Use local `makeQuest()`, `makeContext()`, `makeParticipation()`, `makeObjective()`, `makeProgress()` factories defined at the top of each test file. Never import factories across files.

### Mocking policy

- Do NOT mock Supabase unless testing a service that requires it and the test verifies the DB call pattern.
- DO mock `@/lib/supabase/client` (`isSupabaseConfigured()` → returns `false`) to exercise dev-mode paths.
- DO pass `now` parameter to all scheduling functions for deterministic testing.

### Adding eligibility tests

```typescript
it('returns REASON_CODE for [situation]', () => {
  const result = evaluateEligibilitySync(makeQuest({ /* overrides */ }), makeContext({ /* overrides */ }));
  expect(result.eligible).toBe(false);
  expect(result.reasonCode).toBe('REASON_CODE');
});
```

### Testing state machine transitions

```typescript
it('allows X → Y', () => {
  expect(validateParticipationTransition('X', 'Y').allowed).toBe(true);
});

it('blocks X → Y for untrusted caller', () => {
  const result = validateParticipationTransition('X', 'Y', false);
  expect(result.allowed).toBe(false);
  expect(result.requiresTrusted).toBe(true);
});
```
