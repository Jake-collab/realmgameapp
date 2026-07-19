# Quest User Flow — Worlds

Step-by-step flow for every quest user journey.

---

## 1. Discovery → Start

```
Quest Home (index.tsx)
  ↓ tap quest card
Quest List (quests.tsx) [optional — via "See all"]
  ↓ tap quest item
Quest Detail (quest-detail/[questId].tsx)
  ↓ tap "Start Quest"
  → useStartQuest mutation fires
  → on success: router.replace('/quest-active/' + participationId)
Active Quest (quest-active/[participationId].tsx)
```

**Start Quest** is the only permitted button label before initiation.

---

## 2. Active → Proof Submission

```
Active Quest
  ↓ status = awaiting_proof → "Submit Proof" button appears
  ↓ tap "Submit Proof"
Quest Proof (quest-proof/[participationId].tsx)
  ↓ user fills required fields for proof_type
  ↓ tap "Submit Proof" (mutation)
  → createQuestProofDraft() + submitQuestProof()
  → success → submitted confirmation state shown in-screen
  ↓ tap "Back to Quests"
Quest Home
```

---

## 3. Proof Under Review

```
Quest Proof screen (read-only mode)
  → shows SubmissionStatus(under_review)
  → user waits for notification
  → if approved: Quest Completion screen (deep link)
  → if rejected: needs_resubmission state
```

---

## 4. Resubmission

```
Quest Home → dominant panel shows "Resubmit Proof" (highest urgency)
  ↓ tap
Active Quest → status = needs_resubmission → "Resubmit Proof" button
  ↓ tap
Quest Proof (resubmission mode)
  → shows SubmissionStatus(needs_resubmission) + reviewer feedback
  → user corrects and resubmits
```

---

## 5. Completion

```
Completion notification (or Active Quest → completed status)
  ↓
Quest Completion (quest-completion/[participationId].tsx)
  → calls completeQuest() (idempotent)
  → confirms awardedPoints from server result
  → shows +N points only after server confirmation
  ↓ tap "Back to Quests"
Quest Home
```

---

## 6. Abandonment

```
Active Quest → ⋯ menu → "Abandon this quest"
  → ConfirmationModal (explicit consent required)
  ↓ tap "Yes, Abandon"
  → useAbandonQuest mutation fires
  → on success: router.replace('/quest')
Quest Home (no active panel)
```

---

## Terminal States

| Status | Meaning | User can |
|--------|---------|----------|
| `completed` | Successfully done | View completion |
| `abandoned` | User quit | Start again (if repeatable) |
| `expired` | Time limit passed | Depending on expiration_behavior |

Progress records are **never deleted**.

---

## Home Priority Order (Spec §46)

When the user has active participations, the dominant panel shows:

1. `needs_resubmission` — most urgent
2. `awaiting_proof`
3. `in_progress`
4. `started`
5. `under_review`
6. Highest priority daily quest (when no active participation)
7. Empty state
