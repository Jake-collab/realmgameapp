# Hunt Active Testing — Worlds (Prompt 13)

## Test File

`__tests__/activeHuntGameplay.test.ts` — 70 tests

## Test Coverage

### `resolveStopAction` (stop action resolver)

Tests all completion method × status combinations:
- Terminal states: `completed`, `locked`, `expired`
- Review states: `rejected`, `needs_resubmission`, `under_review`, `awaiting_proof`
- Non-current stop (ordered hunt lock)
- `manual_confirmation` / `none`: mark_complete with confirmation
- `location`: check_location (unvalidated) → complete_stop (validated)
- `text`: add_proof → submit_proof (draft ready)
- `image`: add_proof → submit_proof
- `text_and_image`: combined requirements
- `image_and_location`: location gate → then image
- `trusted_code`: enter code flow

### `resolveHuntLevelAction` (hunt-level action resolver)

- `ready` → complete_hunt enabled
- Missing stops → continue disabled with count in label
- Proof pending → continue disabled
- Non-active participation → disabled
- Singular/plural stop count labels

### `createEmptyProofDraft`

- Default field values per completion method
- `maxImages` per method (0 for manual, 3 for mixed, 5 for image-only)
- `previousSubmissionId` threading

### `evaluateProofDraftReadiness`

All method × state combinations:
- `text`: empty, short, valid, too long
- `image`: no images, with uploaded mediaId, failed upload, not-yet-uploaded
- `text_and_image`: text only, image only, both required
- `image_and_location`: image + location validation matrix
- `location`: validated / not validated
- `manual_confirmation`: always ready (no proof needed)

### `resolveActiveHuntViewMode`

All participation status → view mode mappings including cancelled flag.

### Security Invariants

- Locked/expired stops: all methods return no proof flow, no location flow, no complete stop
- Under-review stops: no proof flow opened
- Awaiting-proof stops: no actions possible

## Running Tests

```bash
# New tests only
npx jest __tests__/activeHuntGameplay.test.ts --no-coverage

# Full suite
npx jest --no-coverage

# Watch mode during development
npx jest --watch --testPathPattern=activeHuntGameplay
```

## Test Environment

- `testEnvironment: node` — no React Native rendering
- `@jest/globals` for typed `describe`/`it`/`expect`
- Pure function tests — no mocks needed (no network, no RN APIs)
- All tested modules: `stopActionResolver.ts`, `activeHunt.types.ts`

## What's NOT Tested Here

- Hook behavior (requires React testing library + query client setup)
- Component rendering (E2E / Storybook)
- RPC responses (integration tests against real Supabase)
- Proof upload pipeline (requires mock storage service)
- Location validation (requires mock ExpoLocation)

These are covered by E2E tests and manual QA on device.
