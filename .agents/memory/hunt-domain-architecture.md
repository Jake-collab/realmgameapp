---
name: Hunt Domain Architecture
description: Prompt 11 complete — Hunt feature structure, key decisions, test patterns, and security invariants.
---

## Status
Prompt 11 complete. 85 new unit tests, 26 integration tests skipped.

## Structural Pattern
Mirrors `features/quests/` exactly:
- `types/` → `services/` → `repositories/` → `hooks/` → `events/` → `constants/` → `fixtures/` → `index.ts`

## Key Decisions

**Reward snapshot**: Captured at `join_hunt` time as JSONB in `hunt_participants`. `complete_hunt` uses snapshot, not current hunt config. Never silently changed by post-join edits.

**Creator proof contract**: Creator-facing proof choices must translate to the canonical active-Hunt completion methods (`manual_confirmation`, `text`, `image`, `location`, `image_and_location`). Do not offer QR proof until scanning and trusted server-token validation exist.
**Why:** The active stop resolver deliberately has no completion action for unknown values, and a plain text field cannot safely validate a QR credential.
**How to apply:** When adding a creator proof option, define both its write mapping and draft-resume reverse mapping, then verify it resolves to a supported participant action.

**Creator drafts, revisions, and covers**: Existing drafts must finish their server read and timestamp-based local-recovery merge before any autosave; each submitted Hunt version is immutable, and rejected content must start a new editable revision. Covers remain private until independently approved as media.
**Why:** An eager autosave can replace a server draft with defaults, changing a reviewed version destroys auditability, and Hunt approval must not silently approve pending media.

**Creator proof enforcement**: Completion must match the stop’s persisted proof method; manual client completion cannot substitute for an approved proof or a server-recorded geofence validation.
**Why:** UI-level proof choices are advisory unless the completion RPC verifies the linked submission, its review state, and any location check.

**Start models**: `individual` (each participant starts themselves), `scheduled` (auto at starts_at), `host_controlled` (creator/co_host triggers). `evaluateStartEligibility` blocks `player` role from host_controlled.

**Completion idempotency**: `hunt_completion:{participationId}` key in both `hunt_participants.completion_idempotency_key` and `points_ledger.idempotency_key` — both UNIQUE.

**Capacity counting statuses**: `invited, accepted, ready, active, paused, completed` count toward capacity. `declined, removed, left, expired` release the slot.

**Private geometry**: `hunt_stop_geofences` has RLS `USING (FALSE)` — domain types never include validation coordinates. Only public approximate display coords in `HuntStopPreview`.

**Locked clue content**: `fetchActiveHunt` filters out `not_started`/`locked` stops. `hintText` is NEVER in any domain type.

**`huntActionResolver` is single source of truth**: All action labels/types in `huntActionResolver.ts`. Never duplicated in components.

## Files Created (Prompt 11)

Services (created in earlier session):
- `features/hunts/services/huntEligibility.service.ts`
- `features/hunts/services/huntAvailability.service.ts`
- `features/hunts/services/huntActionResolver.ts`
- `features/hunts/services/huntCompletion.service.ts`
- `features/hunts/services/huntStop.service.ts`

Hooks (created this session):
- `features/hunts/hooks/useHuntAvailability.ts`
- `features/hunts/hooks/useHuntDetail.ts`
- `features/hunts/hooks/useMyHunts.ts`
- `features/hunts/hooks/useHuntInvitations.ts`
- `features/hunts/hooks/useActiveHunt.ts`
- `features/hunts/hooks/useJoinHunt.ts`
- `features/hunts/hooks/useStartHunt.ts`
- `features/hunts/hooks/useHuntInvitationActions.ts`
- `features/hunts/hooks/useWithdrawFromHunt.ts`
- `features/hunts/hooks/useCompleteHuntStop.ts`
- `features/hunts/hooks/useCompleteHunt.ts`
- `features/hunts/hooks/useInviteToHunt.ts`

Other:
- `features/hunts/fixtures/huntFixtures.ts` — 5 Hunt scenarios, __DEV__ guarded
- `features/hunts/index.ts` — barrel export
- `app/(main)/hunt/diagnostics.tsx` — dev diagnostics screen (__DEV__ guarded)
- `__tests__/hunt.test.ts` — 85 unit tests + 26 skipped integration tests
- `docs/HUNT_DOMAIN.md`, `HUNT_STATE_MACHINE.md`, `HUNT_PRIVACY.md`
- `docs/HUNT_INVITATIONS.md`, `HUNT_PARTICIPATION.md`, `HUNT_STOPS_AND_CLUES.md`
- `docs/HUNT_POINT_AWARDS.md`, `HUNT_SECURITY.md`, `HUNT_TESTING.md`

## Security Assertions (Unit Tested)
- `ELIGIBILITY_USER_MESSAGES` values contain no SQL keywords
- `normalizeHuntError()` strips DB relation names from errors
- `TRUSTED_ONLY_PARTICIPANT_TRANSITIONS` blocks `completed` and `removed`
- `TRUSTED_ONLY_STOP_TRANSITIONS` blocks `completed` and `rejected`
- `CAPACITY_COUNTING_STATUSES` correctly excludes withdrawn participants
- Player role blocked from host_controlled hunt start

## Test Counts After Prompt 11
- 507 passing, 33 skipped, 16 suites total (up from 422 passing pre-prompt)
