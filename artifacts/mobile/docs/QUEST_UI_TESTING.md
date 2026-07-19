# Quest UI Testing — Worlds

Testing strategy and test inventory for Quest screens and domain logic.

---

## Test Environment Setup

All tests run in `testEnvironment: node` (configured in `jest.config.js`).
- Import paths use `@/` alias (mapped in `tsconfig.json` and `jest.config.js`)
- Do NOT mock `__DEV__` — it is always `true` in the Jest/Expo environment
- Use `jest-expo` preset

---

## Test Files

| File | Tests |
|---|---|
| `__tests__/questActionResolver.test.ts` | Action resolver state machine |
| `__tests__/questHomeLogic.test.ts` | Home priority ordering, state mapping |
| `__tests__/questProofValidation.test.ts` | Proof field requirements, canSubmit logic |
| `__tests__/questErrors.test.ts` | Error utilities (pre-existing) |
| `__tests__/questEligibility.test.ts` | Eligibility evaluation (pre-existing) |

---

## Running Tests

```bash
# All tests
cd artifacts/mobile && pnpm test

# Specific file
cd artifacts/mobile && pnpm test questActionResolver

# Watch mode
cd artifacts/mobile && pnpm test --watch
```

---

## Test Coverage by Domain

### Action Resolver (`questActionResolver.test.ts`)
- All `QuestAvailabilityState` values → correct `actionType`
- All `ParticipationStatus` sub-states within `active`
- `ineligible` with reason codes and user messages
- `upcoming` with and without `availableFrom`
- Every resolved action has `accessibilityLabel`
- `participationUrgencyRank` ordering

### Home Priority (`questHomeLogic.test.ts`)
- Priority order matches spec §46
- Edge cases: single participation, empty list
- `participationToAvailabilityState` mapping

### Proof Validation (`questProofValidation.test.ts`)
- `needsText` / `needsImage` / `needsLocation` for all proof types
- `canSubmit` gating for each type combination
- All 7 proof types covered without throwing

---

## Writing New Tests

### Pattern

```typescript
// __tests__/<feature>.test.ts
import { utilFunction } from '@/features/quests/utils/myUtil';

describe('myUtil', () => {
  it('returns correct value', () => {
    expect(utilFunction('input')).toBe('expected');
  });
});
```

### Rules
1. Import only from `@/features/quests/` — never from Supabase directly in tests
2. Do not mock `isSupabaseConfigured` just to bypass logic — test the actual branches
3. `__DEV__` is always `true` — write assertions that match this
4. Test domain logic, not UI rendering (for rendering, use Maestro E2E in later prompts)

---

## Future Test Areas (Prompt 9+)

- Eligibility with mock Supabase (integration tests)
- Navigation routing (Maestro E2E)
- Proof submission end-to-end with mock storage
- Geo-Quest location validation (mock GPS coordinates)
- Leaderboard sorting and ranking
