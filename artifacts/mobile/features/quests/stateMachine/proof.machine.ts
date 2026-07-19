/**
 * Proof State Machine — Worlds
 *
 * Validates proof submission status transitions.
 * All proof transition logic is centralized here.
 *
 * Allowed transitions:
 *   draft              → uploading | submitted
 *   uploading          → draft | submitted
 *   submitted          → under_review
 *   under_review       → approved | rejected | needs_resubmission
 *   needs_resubmission → submitted (new submission created via resubmission flow)
 *   approved           → (terminal)
 *   rejected           → (terminal)
 *
 * Only trusted reviewers may set: approved, rejected, needs_resubmission.
 */

import type { ProofSubmissionStatus } from '@/lib/supabase/database.types';
import {
  PROOF_ALLOWED_TRANSITIONS,
  TRUSTED_ONLY_PROOF_TRANSITIONS,
} from '../constants';

// ─── Transition validation ────────────────────────────────────────────────────

export interface ProofTransitionResult {
  allowed: boolean;
  reason?: string;
  requiresTrusted?: boolean;
}

/**
 * Validate whether a proof status transition is allowed.
 *
 * @param from      Current status
 * @param to        Requested new status
 * @param isTrusted Whether caller is a trusted reviewer/server
 */
export function validateProofTransition(
  from: ProofSubmissionStatus,
  to: ProofSubmissionStatus,
  isTrusted = false
): ProofTransitionResult {
  const allowed = PROOF_ALLOWED_TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Cannot transition proof from '${from}' to '${to}'.`,
    };
  }

  if (TRUSTED_ONLY_PROOF_TRANSITIONS.has(to) && !isTrusted) {
    return {
      allowed: false,
      reason: `Transition to '${to}' requires trusted reviewer authorization.`,
      requiresTrusted: true,
    };
  }

  return { allowed: true };
}

// ─── Proof status helpers ─────────────────────────────────────────────────────

export function isProofTerminal(status: ProofSubmissionStatus): boolean {
  return ['approved', 'rejected'].includes(status);
}

export function isProofEditable(status: ProofSubmissionStatus): boolean {
  return ['draft', 'uploading'].includes(status);
}

export function isProofImmutable(status: ProofSubmissionStatus): boolean {
  return ['submitted', 'under_review', 'approved', 'rejected'].includes(status);
}

export function isProofApproved(status: ProofSubmissionStatus): boolean {
  return status === 'approved';
}

export function isProofAwaitingReview(status: ProofSubmissionStatus): boolean {
  return ['submitted', 'under_review'].includes(status);
}

export function canResubmit(status: ProofSubmissionStatus): boolean {
  return status === 'needs_resubmission';
}

/** Returns true if the user can make edits to a draft proof */
export function canUserEditProof(status: ProofSubmissionStatus): boolean {
  return isProofEditable(status);
}

/** Returns true if the user may submit the proof */
export function canUserSubmitProof(status: ProofSubmissionStatus): boolean {
  return ['draft', 'uploading'].includes(status);
}

/** Returns true if the user should see a "resubmit" action */
export function shouldShowResubmitAction(status: ProofSubmissionStatus): boolean {
  return status === 'needs_resubmission';
}
