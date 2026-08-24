/**
 * Active Hunt Gameplay Types — Worlds (Prompt 13)
 *
 * Types specific to the active hunt gameplay loop:
 * - Proof draft state (local, never persisted)
 * - Stop-level action resolution
 * - Location validation results
 * - Proof submission detail (safe subset)
 *
 * Domain types (ActiveHunt, ActiveHuntStop, etc.) remain in features/hunts/types/hunt.types.ts
 */

import type { StopCompletionMethod, StopProgressStatus, ClueVisibilityState } from '@/features/hunts/types/hunt.types';

// ─── Stop-level action types ──────────────────────────────────────────────────

export type StopActionType =
  | 'view_stop'
  | 'check_location'
  | 'mark_complete'
  | 'add_proof'
  | 'submit_proof'
  | 'view_submission'
  | 'resubmit_proof'
  | 'complete_stop'
  | 'waiting_for_review'
  | 'completed'
  | 'locked'
  | 'expired';

export interface StopActionResult {
  actionType: StopActionType;
  label: string;
  isEnabled: boolean;
  requiresConfirmation: boolean;
  confirmationMessage: string | null;
  disabledReason: string | null;
  /** Whether this action opens a proof modal */
  opensProofFlow: boolean;
  /** Whether this action opens a location validation panel */
  opensLocationFlow: boolean;
  /** Whether this action calls completeHuntStop directly */
  callsCompleteStop: boolean;
  loadingBehavior: 'spinner' | 'replace_label' | 'none';
}

// ─── Proof draft ──────────────────────────────────────────────────────────────

export type ProofUploadState =
  | 'idle'
  | 'selecting'
  | 'uploading'
  | 'uploaded'
  | 'error';

export interface ProofImageItem {
  /** Stable local asset ID used to reconcile upload replay */
  localAssetId?: string;
  /** Local URI from image picker */
  localUri: string;
  /** Uploaded media asset ID (null until uploaded) */
  mediaId: string | null;
  uploadState: ProofUploadState;
  errorMessage: string | null;
  /** Approximate file size in bytes */
  fileSizeBytes: number | null;
}

export interface ProofDraftState {
  participationId: string;
  stopId: string;
  completionMethod: StopCompletionMethod;
  /** Text response for text-type proof */
  textResponse: string;
  textMinLength: number;
  textMaxLength: number;
  /** Images for image-type proof */
  images: ProofImageItem[];
  maxImages: number;
  /** Whether location was validated this session */
  locationValidated: boolean;
  /** Previous submission ID for resubmission chain */
  previousSubmissionId: string | null;
  /** Whether the draft is ready to submit */
  isReadyToSubmit: boolean;
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Last local update */
  lastUpdatedAt: Date | null;
}

export function createEmptyProofDraft(
  participationId: string,
  stopId: string,
  completionMethod: StopCompletionMethod,
  previousSubmissionId?: string | null,
): ProofDraftState {
  const maxImages = completionMethod === 'text_and_image' ? 3 :
                    completionMethod === 'image_and_location' ? 3 :
                    completionMethod === 'image' ? 5 : 0;

  return {
    participationId,
    stopId,
    completionMethod,
    textResponse: '',
    textMinLength: 10,
    textMaxLength: 1000,
    images: [],
    maxImages,
    locationValidated: false,
    previousSubmissionId: previousSubmissionId ?? null,
    isReadyToSubmit: false,
    isSubmitting: false,
    lastUpdatedAt: null,
  };
}

// ─── Proof readiness evaluator ────────────────────────────────────────────────

export function evaluateProofDraftReadiness(draft: ProofDraftState): {
  isReady: boolean;
  missingItems: string[];
} {
  const missingItems: string[] = [];

  const requiresText   = ['text', 'text_and_image'].includes(draft.completionMethod);
  const requiresImage  = ['image', 'image_and_location', 'text_and_image'].includes(draft.completionMethod);
  const requiresLocation = ['location', 'image_and_location'].includes(draft.completionMethod);

  if (requiresText) {
    if (draft.textResponse.trim().length < draft.textMinLength) {
      missingItems.push(`Answer must be at least ${draft.textMinLength} characters.`);
    }
    if (draft.textResponse.length > draft.textMaxLength) {
      missingItems.push(`Answer must be ${draft.textMaxLength} characters or fewer.`);
    }
  }

  if (requiresImage) {
    const uploadedImages = draft.images.filter(img => img.mediaId !== null);
    if (uploadedImages.length === 0) {
      missingItems.push('At least one photo is required.');
    }
    const failedImages = draft.images.filter(img => img.uploadState === 'error');
    if (failedImages.length > 0) {
      missingItems.push('Some photos failed to upload. Please retry or remove them.');
    }
  }

  if (requiresLocation && !draft.locationValidated) {
    missingItems.push('Location verification is required.');
  }

  return { isReady: missingItems.length === 0, missingItems };
}

// ─── Location validation result ───────────────────────────────────────────────

export type LocationValidationOutcome =
  | 'not_started'
  | 'acquiring'
  | 'validated'
  | 'outside_area'
  | 'poor_accuracy'
  | 'permission_denied'
  | 'timeout'
  | 'rate_limited'
  | 'server_error'
  | 'stop_unavailable'
  | 'hunt_expired';

export interface LocationValidationResult {
  outcome: LocationValidationOutcome;
  validated: boolean;
  reasonCode: string | null;
  userMessage: string;
}

// ─── Proof submission detail (safe subset for UI) ─────────────────────────────

export type ProofSubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'needs_resubmission'
  | 'approved'
  | 'rejected';

export interface HuntProofSubmissionDetail {
  submissionId: string;
  submissionType: StopCompletionMethod;
  textResponse: string | null;
  status: ProofSubmissionStatus;
  moderationStatus: 'pending' | 'clean' | 'flagged' | 'rejected';
  /** User-safe explanation — only set for needs_resubmission/rejected */
  reviewExplanation: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  previousSubmissionId: string | null;
  locationVerified: boolean;
  mediaItems: Array<{ mediaId: string; sortOrder: number }>;
}

// ─── Server completion readiness ──────────────────────────────────────────────

export interface ServerCompletionReadiness {
  isReady: boolean;
  state: string;
  totalRequired: number;
  completed: number;
  userMessage: string;
}

// ─── Withdrawal result ────────────────────────────────────────────────────────

export interface WithdrawalConfirmationState {
  isOpen: boolean;
  isWithdrawing: boolean;
  errorMessage: string | null;
}

// ─── Active hunt screen view state ───────────────────────────────────────────

export type ActiveHuntViewMode =
  | 'loading'
  | 'active'
  | 'paused'
  | 'completed'         // → route to completion screen
  | 'withdrawn'
  | 'removed'
  | 'cancelled'
  | 'expired'
  | 'not_found'
  | 'unauthorized';

export function resolveActiveHuntViewMode(
  participationStatus: string | null,
  huntCancelled?: boolean,
): ActiveHuntViewMode {
  if (!participationStatus) return 'not_found';

  switch (participationStatus) {
    case 'active':    return 'active';
    case 'paused':    return 'paused';
    case 'completed': return 'completed';
    case 'withdrawn': return 'withdrawn';
    case 'removed':   return 'removed';
    default:
      if (huntCancelled) return 'cancelled';
      return 'not_found';
  }
}
