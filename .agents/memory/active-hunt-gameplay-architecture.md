---
name: Active Hunt Gameplay Architecture
description: Prompt 13 — full active hunt gameplay loop, proof submission, location validation, stop completion, hunt completion, withdrawal
---

## Feature Location

- Feature module: `features/active-hunt/` (types, hooks, services, index)
- Screens: `app/(main)/hunt-active/[participationId].tsx` (replaced placeholder), `app/(main)/hunt-completion/[participationId].tsx`
- Components: `components/active-hunt/` (10 components)
- Migration: `supabase/migrations/023_hunt_active_gameplay.sql`
- Tests: `__tests__/activeHuntGameplay.test.ts` (70 tests)

## Stop Action Architecture

Single function `resolveStopAction()` in `features/active-hunt/services/stopActionResolver.ts` resolves what the primary button does for any stop state × completion method combination. This is the SINGLE source of truth — never duplicated in screen components.

**Why:** Prevents inconsistent state where screen shows wrong action for stop status. All 10+ action types determined deterministically.

**How to apply:** Call before rendering the primary action button. Pass `progressStatus`, `completionMethod`, `locationValidated`, `proofDraftReady`, `isCurrent`.

## Hunt-Level Action

`resolveHuntLevelAction()` in same file determines when "Complete Hunt" button appears. Only shown when `completionReadiness.state === 'ready'`.

## Proof Draft State

`useHuntProofDraft()` in `features/active-hunt/hooks/useHuntProofDraft.ts` manages local ephemeral draft (text + images + location validated). Images tracked by `localUri → uploadState → mediaId`. Cleared after confirmed submission.

**Why:** Prevents accidental submission of partial drafts. Single source of draft truth.

## New Repository Functions (Migration 023)

Added to `features/hunts/repositories/hunt.repository.ts`:
- `rpcSubmitHuntProof()` → calls `submit_hunt_stop_proof` RPC
- `rpcValidateHuntStopLocation()` → calls `validate_hunt_stop_location` RPC
- `fetchHuntStopSubmission()` → calls `get_hunt_stop_submission` RPC
- `fetchHuntCompletionReadiness()` → calls `get_hunt_completion_readiness` RPC

## ActiveHunt Type Updated

Added `isOrdered: boolean` to `ActiveHunt` in `features/hunts/types/hunt.types.ts`. Also updated `fetchActiveHunt` repository to include `stop_ordering` in the hunt query.

## Location Validation Hook

`useValidateHuntStopLocation` wraps `useForegroundLocation` + RPC. Uses `{ status }` (not `permissionStatus`) from `useLocationPermission`.

## Test Count History

After Prompt 13: **677 total, 644 passing, 33 skipped** (up from 607 passing before Prompt 13).

## Security Invariants

- No geofence geometry ever returned to client
- Locked clue content never rendered
- Proof images: private bucket + signed URLs only
- No optimistic stop/hunt completion
- Points awarded exactly once via idempotency key in `complete_hunt` RPC
