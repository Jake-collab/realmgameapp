# Quest Domain — Worlds

## Overview

Worlds has three quest types: **Daily**, **Monthly Drop**, and **Geo**. Each quest a user participates in creates a `quest_participation` record that progresses through a well-defined state machine. Quest completion is the only path to point awards.

---

## Quest Types

| Type    | Slug Pattern | Availability Window | Repeatability | Key Behavior |
|---------|-------------|---------------------|---------------|--------------|
| `daily` | `daily:{quest-slug}:{YYYY-MM-DD}` | Calendar day (UTC) | Repeatable, resets each day | Participation expires at midnight UTC |
| `monthly` | `monthly:{quest-slug}:{YYYY-MM}` | Calendar month (UTC) | Non-repeatable by default | One completion per monthly window per user |
| `geo`   | `geo:{quest-slug}` | Custom (admin-set) | Optional | Location-based; validate proximity server-side |

---

## Data Model

### Core tables

```
quests                    ← Quest definition (admin-created)
  ↓ 1:many
quest_objectives          ← Steps within a quest
  
quests                    
  ↓ 1:many
quest_participations      ← A user's attempt at a quest
  ↓ 1:many
quest_step_progress       ← Per-step completion within a participation
  ↓ 0:1
proof_submissions         ← Proof of completion (photo, text, location)
  ↓ 0:many
proof_media               ← Attached images for photo proof

quest_occurrences         ← Scheduled instances of repeatable quests
quest_prerequisites       ← Prerequisite requirements for a quest
points_ledger             ← Append-only point awards
user_point_totals         ← Materialized view of user point totals
```

### Key columns (added in migration 017)

| Table | Column | Purpose |
|-------|--------|---------|
| `quests` | `completion_mode` | `auto` or `manual_review` |
| `quests` | `expiration_behavior` | `hard` or `started_users_may_finish` |
| `quests` | `home_priority` | Integer sort weight for Home/Quests lists |
| `quest_participations` | `reward_snapshot_points` | Points captured at start time |
| `quest_participations` | `occurrence_key` | Links participation to a specific occurrence |

---

## Completion Modes

### `auto`
- Quest completes immediately once all required steps are marked done.
- No proof submission required.
- Points awarded atomically by the `complete_quest` RPC.
- Typical for: short, self-reported daily tasks (morning walk, reflection).

### `manual_review`
- User must submit proof (photo, text, or location evidence).
- Proof enters review queue (reviewer approves/rejects/requests resubmission).
- Only after approval does the `complete_quest` RPC fire.
- Typical for: location-verified tasks, creative submissions.

---

## Expiration Behavior

### `hard`
- When `available_until` passes, ALL participations (active or otherwise) are immediately expired.
- No further completion is possible.
- Typical for: daily quests where the day is over.

### `started_users_may_finish`
- When `available_until` passes, no NEW participations can be created.
- Existing active participations may continue to completion.
- Typical for: monthly quests where a late-started user deserves to finish.

---

## Occurrence Model

Repeatable quests (e.g., `is_repeatable = TRUE`) use **occurrence keys** to track uniqueness per user per period.

```
Occurrence key format:
  daily:{quest-slug}:{YYYY-MM-DD}     ← e.g., daily:morning-walk:2026-07-19
  monthly:{quest-slug}:{YYYY-MM}      ← e.g., monthly:city-explorer:2026-07
  geo:{quest-slug}                    ← e.g., geo:riverside-mural (typically one occurrence)
```

**Uniqueness constraint:** `(user_id, occurrence_key)` on `quest_participations.status = 'completed'` prevents double-completion of the same occurrence.

**Non-repeatable quests** use the existing `idx_unique_non_repeatable_completion` index which enforces one completion per `(user_id, quest_id)`.

---

## Prerequisite System

```sql
quest_prerequisites
  quest_id              UUID    -- Quest that has this requirement
  prerequisite_type     TEXT    -- 'quest_completion' | 'minimum_points' | 'achievement'
  required_quest_id     UUID    -- For quest_completion type
  minimum_points        INT     -- For minimum_points type
  required_achievement_id UUID  -- For achievement type
```

All prerequisites use **AND logic** — every row must be satisfied. Evaluated at start time only (not rechecked mid-participation).

---

## Point Award Model

1. `reward_snapshot_points` is captured from `quests.points_reward` at participation start.
2. At completion, the RPC `complete_quest` inserts a `points_ledger` entry using the **snapshot**, not the current quest reward value.
3. If the quest admin changes `points_reward` after a participation starts, that change does NOT affect existing participants.
4. Idempotency key: `quest_completion:{participation_id}` prevents double-awarding even under retries.
5. Points are **never deleted** — corrections use a reversal entry (`transaction_type = 'reversal'`).

---

## Security Model

| Surface | Rule |
|---------|------|
| `quest_geofences` | Never returned to clients. Server-side validation only. |
| `complete_quest` RPC | `SECURITY DEFINER`. Validates `auth.uid()`. Never accepts reward value from client. |
| `abandon_quest` RPC | `SECURITY DEFINER`. Cannot abandon under-review participations. |
| Proof reviewer fields | `reviewer_id`, `review_notes`, `reviewed_at` are not updatable by proof owner. |
| `points_ledger` | Client INSERT blocked by RLS. Only RPC/Edge Function can award points. |

---

## Module Structure

```
features/quests/
  types/
    quest.types.ts          ← All app-level domain types
  constants/
    index.ts                ← Transition tables, business rule constants
  utils/
    questErrors.ts          ← Error factory and normalization
  events/
    questEvents.ts          ← Domain event emission (analytics hook)
  stateMachine/
    participation.machine.ts
    proof.machine.ts
    questContent.machine.ts
  repositories/
    quest.repository.ts     ← DB reads + writes (no geofences)
    proof.repository.ts
  services/
    questScheduling.service.ts
    questEligibility.service.ts
    questAvailability.service.ts
    questStart.service.ts
    questProgress.service.ts
    questCompletion.service.ts
    questAbandonment.service.ts
    questProof.service.ts
    questSelection.service.ts
  queries/
    questKeys.ts            ← Centralized React Query key factory
  hooks/
    index.ts                ← Barrel exports
    useDailyQuests.ts
    useMonthlyQuests.ts
    useGeoQuests.ts
    useQuestDetail.ts
    useQuestAvailability.ts
    useActiveQuest.ts
    useQuestParticipation.ts
    useQuestProgress.ts
    useCompletedQuests.ts
    useStartQuest.ts
    useAbandonQuest.ts
    useSubmitQuestProof.ts
    useQuestPointGuideline.ts
    useHomeQuestSummary.ts
  index.ts                  ← Barrel export
```
