---
name: Quest Domain Architecture
description: Key decisions and patterns from the Prompt 6 quest domain implementation; covers data model, services, TypeScript patterns, and test quirks.
---

## Occurrence key format
Deterministic string: `daily:{slug}:{YYYY-MM-DD}` | `monthly:{slug}:{YYYY-MM}` | `geo:{slug}`.
Stable lookup without needing a DB record for every quest instance.

## Reward snapshot at start time
`reward_snapshot_points` is written to `quest_participations` at quest start (not at completion).
Prevents retroactive reward changes from affecting active participants.

## Only path to point awards: `complete_quest` RPC
Mobile client cannot directly INSERT into `points_ledger` — RLS blocks it.
`complete_quest` is a SECURITY DEFINER Postgres function; validates state, uses DB snapshot value, idempotency key prevents double-award.

## Expiration behavior per quest
`hard` = all active participations expire when the content window closes.
`started_users_may_finish` = in-progress users can complete even after window closes.
Evaluated in `questAvailability.service.ts`.

## Prerequisite evaluation: checked once at start
Prerequisite satisfaction (AND logic via `quest_prerequisites` table) is checked when the quest is started.
NOT re-validated mid-participation. Keep this intentional — retroactive blocking is a bad UX.

## `QuestObjectiveRow` has `completion_mode`
`completion_mode: QuestCompletionMode` was added to `QuestObjectiveRow` in database.types.ts (migration 017).
`QuestObjective` (app type) also requires it. They are structurally compatible.

## Untyped Supabase client — repository cast pattern
`requireSupabase()` returns an untyped `SupabaseClient` (no Database generic).
All `.insert()`, `.update()`, `.upsert()` arguments resolve to `never[]` for unknown tables.
**Fix:** Cast the entire `.from()` chain: `(client.from('table') as any).update(x)`.
Do NOT use `x as any` as the argument — that fails with `'any' not assignable to 'never'`.
Select/single results cast with `data as unknown as TargetType`.

## `__DEV__` is `true` in Jest/Expo test environment
`questErrors.ts` uses `__DEV__` to gate the `technical` field on errors.
In the Jest test environment (jest-expo), `__DEV__` is `true`, so `technical` IS populated.
Tests must check `__DEV__` rather than assuming it is false.

## Pre-existing TypeScript errors (not from Prompt 6)
- `hooks/useColors.ts(20)` — unsafe `as` cast in the colors utility
- `services/quests/quest.service.ts` — the OLD Prompt 4 quest service has untyped Supabase inserts

**Why:** These exist because the old quest.service.ts was scaffolded before the `(client.from() as any)` pattern was established. Fix them separately if needed.

## Extended row types pattern
`QuestRowExtended` and `QuestParticipationRowExtended` in quest.repository.ts add migration 017 columns locally.
This keeps `database.types.ts` as the hand-authored canonical file without duplicating partial-migration fields.
The extended interfaces inherit from the base row types.

## Canonical Daily assignment
Daily Quest personalization is Interest Bubble based, but the selected Quest must be persisted per user and UTC occurrence date by a server-side assignment function. A configured client must show an unavailable state—not locally rank a substitute—when that authority cannot be reached.

**Why:** Refresh-time client selection can reshuffle a user's Daily Quest and cannot be trusted as an authority.

**How to apply:** Keep Interest Bubble IDs and targeting mode separate from public Quest content; never use raw interest labels or client-only randomness for assignment. Preference changes guide future UTC assignments only; they never reroll an already persisted Daily.

## Canonical Quest catalog rewards
Quest catalog content uses EASY=100, MEDIUM=200, HARD=300, and EPIC=500 at the database boundary. The shared historical `very_easy` enum value remains read-compatible for non-Quest content, but is normalized to `easy` for every Quest write.

**Why:** The shared enum is also used outside Quest, so removing or renaming it globally would risk changing Hunt semantics. Existing participation reward snapshots remain the authority for active history.

**How to apply:** Keep Quest reward enforcement in Quest-specific triggers/functions, not shared enum changes. Never apply Quest point tables to Hunt rewards.

## One-time proof verification
Quest photo, video, and location submissions require a short-lived server-issued verification session; the database validates ownership/expiry and consumes the session on submission.

**Why:** A live camera or GPS reading is only evidence when the server can bind it to the active participation and reject replay.

**How to apply:** Upload captured media to private proof storage, attach it to the draft, then submit; never treat a local URI or device-reported coordinate as completed proof by itself.
