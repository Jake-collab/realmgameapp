# Hunt Proof UI — Worlds (Prompt 13)

## Proof Submission Flow

```
Primary Action Button (Add Proof / Resubmit)
    ↓
HuntProofDraft Modal (pageSheet)
  - Text input (for text/text_and_image)
  - Image picker (for image/image_and_location/text_and_image)
  - Location badge (shows verified status for image_and_location)
  - Character counter
  - Missing items validation list
    ↓
Review Proof Button (when draft isReady && no uploading images)
    ↓
HuntProofReview Modal (pageSheet)
  - Hunt + stop title
  - Text answer preview
  - Image thumbnails (with upload status badges)
  - Location verified badge
  - Immutability warning
    ↓
Submit Proof Button
    ↓
useSubmitHuntProof.mutateAsync()
    ↓
submit_hunt_stop_proof RPC (SECURITY DEFINER)
    ↓
Stop status → under_review or awaiting_proof
    ↓
Cache invalidation → useActiveHunt refetch
```

## Proof Draft State (`useHuntProofDraft`)

Local state only — never persisted. Ephemeral per session.

```typescript
ProofDraftState {
  textResponse: string        // min 10, max 1000 chars
  images: ProofImageItem[]    // localUri + uploadState + mediaId
  locationValidated: boolean  // from location validation flow
  previousSubmissionId: null  // set on resubmission
  isSubmitting: boolean       // during submit call
}
```

## Readiness Evaluation (`evaluateProofDraftReadiness`)

| Method | Text Required | Image Required | Location Required |
|--------|--------------|----------------|-------------------|
| `text` | ✓ (≥10 chars) | ✗ | ✗ |
| `image` | ✗ | ✓ (≥1 uploaded) | ✗ |
| `text_and_image` | ✓ | ✓ | ✗ |
| `image_and_location` | ✗ | ✓ | ✓ |
| `location` | ✗ | ✗ | ✓ |
| `manual_confirmation` | ✗ | ✗ | ✗ |
| `trusted_code` | ✓ (code entry) | ✗ | ✗ |

## Image Upload Pipeline

1. User selects image from library or camera
2. `proofDraft.addImage(localUri, fileSize)` — adds to draft with `uploadState: 'idle'`
3. Screen's useEffect triggers upload via media service
4. `setImageUploadState(localUri, 'uploading')` during upload
5. On success: `setImageUploadState(localUri, 'uploaded', mediaId)`
6. On failure: `setImageUploadState(localUri, 'error', null, errorMessage)`
7. User can retry failed uploads or remove the image
8. Submit collects all `images.filter(img => img.mediaId !== null).map(img => img.mediaId)`

## Resubmission Flow

1. Stop status is `needs_resubmission` or `rejected`
2. `HuntSubmissionStatus` component shows review explanation (user-safe text only)
3. User taps "Resubmit Proof"
4. `useHuntProofDraft` initialized with `previousSubmissionId` from prior submission
5. New `proof_submissions` record created, linked via `previous_submission_id`
6. Prior submission record retained (audit trail preserved)

## Privacy Rules

- Proof images are NEVER made publicly accessible
- Signed URLs only (via storage service) — not embedded in RPC responses
- No reviewer identity shown to participant
- `reviewExplanation` is user-safe text set by reviewer — no internal scores/rules
- Location coordinates submitted to RPC but never returned
