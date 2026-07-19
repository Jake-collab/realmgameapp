/**
 * Participation State Machine — Worlds
 *
 * Validates participation status transitions.
 * All transition logic is centralized here — never spread across service files.
 *
 * Allowed transitions:
 *   started           → in_progress | awaiting_proof | abandoned | expired
 *   in_progress       → awaiting_proof | abandoned | expired
 *   awaiting_proof    → under_review | abandoned | expired
 *   under_review      → completed | rejected | needs_resubmission
 *   needs_resubmission → under_review | abandoned
 *   completed         → (terminal)
 *   rejected          → (terminal)
 *   abandoned         → (terminal)
 *   expired           → (terminal)
 *
 * Sensitive transitions (completed, rejected) MUST be performed by trusted
 * server logic — the client may not request these directly.
 */

import type { ParticipationStatus } from '@/lib/supabase/database.types';
import {
  PARTICIPATION_ALLOWED_TRANSITIONS,
  TRUSTED_ONLY_PARTICIPATION_TRANSITIONS,
} from '../constants';

// ─── Transition validation ────────────────────────────────────────────────────

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  requiresTrusted?: boolean;
}

/**
 * Validate whether a participation status transition is allowed.
 *
 * @param from      Current status
 * @param to        Requested new status
 * @param isTrusted Whether the caller is server/admin (bypasses client restrictions)
 */
export function validateParticipationTransition(
  from: ParticipationStatus,
  to: ParticipationStatus,
  isTrusted = false
): TransitionResult {
  const allowed = PARTICIPATION_ALLOWED_TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Cannot transition participation from '${from}' to '${to}'.`,
    };
  }

  if (TRUSTED_ONLY_PARTICIPATION_TRANSITIONS.has(to) && !isTrusted) {
    return {
      allowed: false,
      reason: `Transition to '${to}' requires trusted server authorization.`,
      requiresTrusted: true,
    };
  }

  return { allowed: true };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

/** Returns true if the participation is in a terminal state */
export function isParticipationTerminal(status: ParticipationStatus): boolean {
  return ['completed', 'rejected', 'abandoned', 'expired'].includes(status);
}

/** Returns true if the participation is actively in progress */
export function isParticipationActive(status: ParticipationStatus): boolean {
  return ['started', 'in_progress', 'awaiting_proof', 'needs_resubmission'].includes(status);
}

/** Returns true if the participation is awaiting any form of action */
export function requiresUserAction(status: ParticipationStatus): boolean {
  return ['started', 'in_progress', 'awaiting_proof', 'needs_resubmission'].includes(status);
}

/** Returns true if the participation has been submitted for review */
export function isSubmittedOrUnderReview(status: ParticipationStatus): boolean {
  return ['under_review'].includes(status);
}

/** Returns true if the user can abandon this participation */
export function canAbandon(status: ParticipationStatus): boolean {
  const abandonable = PARTICIPATION_ALLOWED_TRANSITIONS[status] ?? [];
  return abandonable.includes('abandoned');
}

/** Returns true if the user can submit proof at this status */
export function canSubmitProof(status: ParticipationStatus): boolean {
  return ['started', 'in_progress', 'awaiting_proof', 'needs_resubmission'].includes(status);
}

// ─── Transition sequence helpers ──────────────────────────────────────────────

/**
 * Returns the standard "progress" transition for an auto-completion quest.
 * Auto quests skip the proof/review cycle.
 *
 * Example: started → in_progress → completed (server-side)
 */
export function getAutoCompletionTransitions(): ParticipationStatus[] {
  return ['started', 'in_progress', 'completed'];
}

/**
 * Returns the standard transitions for a manual-review quest.
 *
 * Example: started → in_progress → awaiting_proof → under_review → completed
 */
export function getManualReviewTransitions(): ParticipationStatus[] {
  return ['started', 'in_progress', 'awaiting_proof', 'under_review', 'completed'];
}
