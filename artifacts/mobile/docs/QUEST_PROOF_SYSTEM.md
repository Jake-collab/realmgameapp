# Quest Proof System — Worlds

## Overview

The proof system allows users to submit evidence of quest completion for manual review. It supports photo, text, location check-in, and combination proof types.

Proof submission is **optional for auto-completion quests** (where all steps auto-validate) but **required for manual_review quests** before points can be awarded.

---

## Proof Types

| Type | Description | Storage |
|------|-------------|---------|
| `none` | No proof required (auto-completion only) | — |
| `photo` | One or more photographs | `proof_media` → `media_assets` |
| `text` | Written response | `proof_submissions.text_response` |
| `text_and_image` | Text + at least one image | Both |
| `location` | GPS check-in evidence | `proof_submissions.location_lat/lng` |
| `image_and_location` | Photo at a specific location | Both |
| `nfc` | NFC tag scan (future) | Server-validated |

---

## Proof Lifecycle

```
User creates draft proof
         ↓
User adds evidence (text, uploads media, location)
         ↓
User submits → proof.status = 'submitted'
         ↓
System queues for review → proof.status = 'under_review'
         ↓
Reviewer decision:
  approved → quest completes, points awarded
  rejected → participation ends
  needs_resubmission → user can create new proof (linked to this one)
```

---

## Implementation Flow

### Creating a Draft

```typescript
const result = await createQuestProofDraft({
  participationId,
  userId,
  submissionType: 'photo',
  locationLat: 51.5074,
  locationLng: -0.1278,
  locationAccuracyMeters: 15,
});
// Returns { success, proof } with draft in 'draft' status
```

**Idempotent:** If an active draft already exists, the existing draft is returned without creating a duplicate.

### Updating a Draft

```typescript
await updateQuestProofDraft(proofId, userId, {
  textResponse: 'Here is my evidence...',
});
```

Draft and uploading proofs are editable. Submitted proof is immutable.

### Submitting

```typescript
const result = await submitQuestProof(proofId, userId, participationId);
// proof.status → 'submitted'
// participation.status → 'under_review'
```

**Validation before submit:** Use `validateProofRequirements()` to check required fields before the submit button becomes enabled. Never submit a proof that fails validation — the server will reject it.

### Resubmission

When `proof.status = 'needs_resubmission'`:
1. User creates a new draft via `createQuestProofDraft()` — the service detects the resubmission state automatically and creates a new linked draft.
2. The new draft has `previous_submission_id` set to the prior submission.
3. This creates an audit chain of all submission attempts.

---

## Proof Validation

```typescript
const { valid, missingFields } = validateProofRequirements(
  proof,
  requirementConfig,
  attachedMediaCount
);
```

The `ProofRequirementConfig` is derived from `quest.proof_type` and `quest.completion_mode`. Never let users submit without validation passing.

### Constraints

| Constraint | Value |
|-----------|-------|
| `MAX_PROOF_IMAGES` | 10 |
| `MIN_PROOF_TEXT_LENGTH` | 10 chars |
| `MAX_PROOF_TEXT_LENGTH` | 2000 chars |
| `MAX_RESUBMISSIONS` | 3 |

---

## Security

| Rule | Implementation |
|------|---------------|
| Users access only their own proof | Supabase RLS on `proof_submissions` |
| Submitted proof is immutable | `updateDraftProof` uses `WHERE status IN ('draft', 'uploading')` |
| Reviewer fields are server-only | `reviewer_id`, `review_notes`, `reviewed_at` never in client-visible updates |
| Proof image content not logged | `onProofStarted/Submitted` events log type only |
| Users cannot approve own proof | Business rule — enforced by review queue design |

---

## Media Storage

Proof images are uploaded via the **object storage** system (Prompt 9). The client uploads to a temporary location, the moderation pipeline approves the asset, and the approved `media_id` is attached to the proof via `attachProofMedia()`.

**Never** attach unmoderated media to a proof submission. The `proof_media` table references `media_assets.id`, and moderation status is checked during proof review.

---

## Repository Reference

`features/quests/repositories/proof.repository.ts`

| Function | Purpose |
|----------|---------|
| `fetchCurrentProof(participationId)` | Get active/latest proof |
| `fetchProofHistory(participationId)` | Full submission chain |
| `fetchProofById(proofId)` | Single proof by ID |
| `createDraftProof(payload)` | Create new draft |
| `updateDraftProof(proofId, updates)` | Update editable draft |
| `submitProof(proofId)` | Submit → immutable |
| `attachProofMedia(proofId, mediaId, sortOrder)` | Link approved media |
