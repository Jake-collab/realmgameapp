# Hunt Testing — Worlds

## Running Tests

```bash
# Run all Hunt tests
cd artifacts/mobile
pnpm jest __tests__/hunt.test.ts --testEnvironment=node

# Run with coverage
pnpm jest __tests__/hunt.test.ts --testEnvironment=node --coverage

# Run all tests (Hunt + Quest + Map)
pnpm jest --testEnvironment=node
```

## Test Coverage

The `hunt.test.ts` file covers **87 unit tests** and **22 skipped integration tests**:

| Suite | Tests | Notes |
|---|---|---|
| HuntAvailability | 10 | All states, capacity, invitation scenarios |
| HuntEligibility | 13 | Auth, account, privacy, capacity, prerequisites |
| HuntActionResolver | 8 | All action types |
| ParticipantStateMachine | 8 | Transitions, trusted-only guards |
| StopStateMachine | 8 | Transitions, trusted-only guards |
| InvitationStateMachine | 5 | All valid transitions |
| HuntCompletionReadiness | 8 | All readiness states |
| StopDisplayPriority | 6 | Ordering, priority assignment |
| StopServiceUtilities | 8 | Accessibility, proof, clue visibility |
| IdempotencyKeys | 3 | Format, deduplication |
| SecurityAssertions | 8 | TRUSTED_ONLY sets, message safety, error normalization |

## Integration Tests (Skipped — Require Live Supabase)

Skipped tests are decorated with `describe.skip(...)`. To run them:
1. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the environment.
2. Apply migrations 001–021 to the target project.
3. Seed test users and hunt fixtures.
4. Remove `.skip` from the relevant describe block.

Integration suites:
- `join_hunt RPC` — idempotency, capacity lock, reward snapshot
- `accept_hunt_invitation RPC` — capacity recheck, atomic participation creation
- `complete_hunt_stop RPC` — sequential unlock, trusted-only guard
- `complete_hunt RPC` — idempotency key, points ledger, deadline enforcement
- `get_hunt_availability RPC` — all 10+ availability states
- `get_my_hunts_summary RPC` — data isolation

## Dev Diagnostics Screen

In development builds, a Hunt diagnostics screen is available at:
```
app/(main)/hunt/diagnostics.tsx
```

Access programmatically:
```typescript
// In any dev screen:
import { router } from 'expo-router';
router.push('/(main)/hunt/diagnostics');
```

This screen is **not registered as a tab** — it has no production navigation entry. It renders fixture data through all domain evaluation functions so you can inspect state machine outputs without a live backend.

## Dev Fixtures

`features/hunts/fixtures/huntFixtures.ts` provides:

| Fixture | State | Description |
|---|---|---|
| `DEV_HUNT_A` | `available` | Public official hunt, user not joined |
| `DEV_HUNT_B` | `invited` | Invite-only hunt, user has pending invitation |
| `DEV_HUNT_C` | `active` | Hunt in progress (2/6 stops complete) |
| `DEV_HUNT_D` | `completed` | Finished hunt |
| `DEV_HUNT_E` | `upcoming` | Scheduled hunt, not yet open |
| `DEV_ACTIVE_HUNT` | — | Full `ActiveHunt` with 3 stops (2 completed, 1 in progress) |
| `DEV_PENDING_INVITATION` | — | Pending invitation with message |
| `DEV_MY_HUNTS_SUMMARY` | — | My Hunts summary with active + completed + invitation |

Fixtures are guarded: importing in production throws immediately.

## Testing Patterns

### Test eligibility combinations
```typescript
evaluateHuntEligibility({
  huntId: 'hunt-001',
  huntStatus: 'active',
  huntPrivacy: 'public',
  huntJoinPolicy: 'open',
  maxParticipants: null,
  minParticipants: 1,
  currentParticipantCount: 0,
  context: {
    userId: 'user-001',
    profile: { account_status: 'active', onboarding_status: 'completed' },
  },
});
```

### Test completion readiness
```typescript
evaluateCompletionReadiness(
  stops.map(s => ({ id: s.id, isRequired: s.isRequired, progressStatus: s.progressStatus })),
  'active',   // participationStatus
  null,       // completionDeadline
);
```

### Test action resolution
```typescript
resolveHuntAction({
  state: 'available',
  canJoin: true,
  canStart: false,
  reasonCode: 'ELIGIBLE',
  participationId: null,
  invitationId: null,
});
// → { actionType: 'join_hunt', label: 'Join Hunt', isEnabled: true, requiresConfirmation: true }
```

## Security Test Assertions

The test suite includes a `Security Assertions` suite that verifies:
1. `ELIGIBILITY_USER_MESSAGES` values contain no SQL keywords.
2. `normalizeHuntError()` strips raw DB relation names from errors.
3. `TRUSTED_ONLY_PARTICIPANT_TRANSITIONS` blocks client from setting `completed` or `removed`.
4. `TRUSTED_ONLY_STOP_TRANSITIONS` blocks client from setting `completed` or `rejected`.
5. `CAPACITY_COUNTING_STATUSES` correctly excludes withdrawn/removed participants.
6. Start eligibility blocks `player` role from starting `host_controlled` hunts.

These tests should remain passing after any future domain changes.
