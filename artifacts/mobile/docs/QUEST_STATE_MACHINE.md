# Quest State Machine — Worlds

## Overview

Quest domain state is modeled with two independent state machines:
1. **Participation status** — the user's progress through a quest
2. **Proof submission status** — the lifecycle of a proof submission

A third machine governs **quest content status** (admin-side) but is not directly manipulated by the mobile client.

All transition logic lives in `features/quests/stateMachine/`. Never add transition logic to service or UI files.

---

## Participation State Machine

### States

| State | Meaning | Active? | Terminal? |
|-------|---------|---------|-----------|
| `started` | Participation created; not yet progressing | ✅ | ❌ |
| `in_progress` | User has begun working on steps | ✅ | ❌ |
| `awaiting_proof` | All steps done; proof required | ✅ | ❌ |
| `under_review` | Proof submitted; awaiting reviewer | ❌ | ❌ |
| `needs_resubmission` | Reviewer requested new proof | ✅ | ❌ |
| `completed` | Quest finished and points awarded | ❌ | ✅ |
| `rejected` | Quest failed (rare) | ❌ | ✅ |
| `abandoned` | User gave up voluntarily | ❌ | ✅ |
| `expired` | Deadline passed before completion | ❌ | ✅ |

### Allowed Transitions

```
started           → in_progress | awaiting_proof | abandoned | expired
in_progress       → awaiting_proof | abandoned | expired
awaiting_proof    → under_review | abandoned | expired
under_review      → completed* | rejected* | needs_resubmission*
needs_resubmission → under_review | abandoned
completed         → (terminal)
rejected          → (terminal)
abandoned         → (terminal)
expired           → (terminal)
```

`*` Starred transitions require trusted server authorization — the mobile client cannot request these directly.

### Transition Rules

1. **No backwards transitions** — once in terminal state, participation stays there.
2. **Under-review participations cannot be abandoned** — the review must resolve first.
3. **Completion and rejection require trusted RPCs** — `complete_quest` and `abandon_quest` enforce this.
4. **Expiration is detected client-side** but set server-side by a scheduled job. The client detects expiry at query time and shows the expired state without making a DB write.

### Implementation

```typescript
import { validateParticipationTransition } from '@/features/quests/stateMachine/participation.machine';

const result = validateParticipationTransition('started', 'in_progress');
// result.allowed = true

const blocked = validateParticipationTransition('started', 'completed', false);
// blocked.allowed = false, blocked.requiresTrusted = true
```

---

## Proof Submission State Machine

### States

| State | Meaning | Editable by User? |
|-------|---------|-------------------|
| `draft` | Not yet submitted | ✅ |
| `uploading` | Media upload in progress | ✅ |
| `submitted` | Submitted for review; immutable | ❌ |
| `under_review` | Reviewer is working | ❌ |
| `needs_resubmission` | Reviewer requested retry | ❌ |
| `approved` | Proof accepted | ❌ (terminal) |
| `rejected` | Proof definitively rejected | ❌ (terminal) |

### Allowed Transitions

```
draft              → uploading | submitted
uploading          → draft | submitted
submitted          → under_review
under_review       → approved* | rejected* | needs_resubmission*
needs_resubmission → submitted   (via new draft created in resubmission flow)
approved           → (terminal)
rejected           → (terminal)
```

`*` Reviewer-only transitions.

### Key Rules

1. **Submitted proof is immutable** — users cannot edit or delete after submit.
2. **Resubmission creates a new proof record** linked to the prior via `previous_submission_id`.
3. **Reviewers cannot be the proof owner** (enforced by business rule, not DB constraint in Build 1).
4. **Reviewer fields** (`reviewer_id`, `review_notes`, `reviewed_at`) are never writable by the proof owner via RLS.

---

## Quest Content State Machine (Admin-only)

```
draft          → pending_review | rejected
pending_review → approved | rejected
approved       → scheduled | published | rejected
scheduled      → published | paused | archived
published      → paused | expired | archived
paused         → published | archived
expired        → archived
rejected       → draft
archived       → (terminal)
```

Mobile clients read `status` but never write it directly. Admin panel (Prompt 17) manages transitions.

---

## Quest Availability State

`evaluateQuestAvailability()` returns a `QuestAvailabilityState` that maps the combination of participation status + quest content status into a single UI-facing state:

| Availability State | Meaning | Can Start? |
|-------------------|---------|-----------|
| `upcoming` | Quest exists but not yet open | ❌ |
| `available` | User can start | ✅ |
| `active` | User has started/in_progress | ❌ |
| `awaiting_proof` | User must submit proof | ❌ |
| `under_review` | Proof submitted, pending | ❌ |
| `needs_resubmission` | Reviewer wants new proof | ❌ |
| `completed` | User has completed this quest/occurrence | ❌ |
| `expired` | Quest or participation has expired | ❌ |
| `paused` | Quest temporarily unavailable | ❌ |
| `ineligible` | User cannot start (see reasonCode) | ❌ |

This evaluation is cached in React Query (30s stale time) and never duplicated in component code.

---

## RPC Boundaries

| Action | Who | How |
|--------|-----|-----|
| Start quest | Mobile client | `insertParticipation` via repository |
| Mark step done | Mobile client | `upsertStepProgress` via repository |
| Submit proof | Mobile client | `submitProof` via repository + RPC |
| Complete quest (auto) | `complete_quest` RPC | SECURITY DEFINER |
| Complete quest (manual) | Reviewer triggers via admin Edge Function → `complete_quest` RPC | SECURITY DEFINER |
| Abandon quest | Mobile client | `abandon_quest` RPC | SECURITY DEFINER |
| Expire participation | Scheduled Edge Function (batch) | Service role |
