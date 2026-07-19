/**
 * Stop Action Resolver — Worlds (Prompt 13)
 *
 * Single source of truth for what action is available on a given stop.
 * Never duplicated in screen components.
 *
 * Priority order:
 *   rejected → resubmit_proof
 *   needs_resubmission → resubmit_proof
 *   under_review / awaiting_proof → waiting_for_review
 *   completed → completed
 *   expired → expired
 *   locked → locked
 *   available/in_progress (by completionMethod):
 *     location only → check_location (if not validated) or complete_stop
 *     proof required → add_proof
 *     manual → mark_complete
 */

import type { StopProgressStatus, StopCompletionMethod } from '@/features/hunts/types/hunt.types';
import type { StopActionResult } from '../types/activeHunt.types';

interface ResolveStopActionInput {
  progressStatus: StopProgressStatus;
  completionMethod: StopCompletionMethod;
  /** Whether location was validated in the current session */
  locationValidated: boolean;
  /** Whether proof was drafted and is ready to submit */
  proofDraftReady: boolean;
  /** Whether the stop is the current active stop (for ordered hunts) */
  isCurrent: boolean;
}

export function resolveStopAction(input: ResolveStopActionInput): StopActionResult {
  const { progressStatus, completionMethod, locationValidated, proofDraftReady, isCurrent } = input;

  // ── Terminal states ───────────────────────────────────────────────────────

  if (progressStatus === 'completed') {
    return {
      actionType:           'completed',
      label:                'Completed',
      isEnabled:            false,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       null,
      opensProofFlow:       false,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'none',
    };
  }

  if (progressStatus === 'locked') {
    return {
      actionType:           'locked',
      label:                'Locked',
      isEnabled:            false,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       'Complete earlier stops first.',
      opensProofFlow:       false,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'none',
    };
  }

  if (progressStatus === 'expired') {
    return {
      actionType:           'expired',
      label:                'Expired',
      isEnabled:            false,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       'This stop is no longer available.',
      opensProofFlow:       false,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'none',
    };
  }

  // ── Review states ─────────────────────────────────────────────────────────

  if (progressStatus === 'rejected') {
    return {
      actionType:           'resubmit_proof',
      label:                'Resubmit Proof',
      isEnabled:            true,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       null,
      opensProofFlow:       true,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'spinner',
    };
  }

  if (progressStatus === 'needs_resubmission') {
    return {
      actionType:           'resubmit_proof',
      label:                'Resubmit Proof',
      isEnabled:            true,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       null,
      opensProofFlow:       true,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'spinner',
    };
  }

  if (progressStatus === 'under_review' || progressStatus === 'awaiting_proof') {
    return {
      actionType:           'waiting_for_review',
      label:                'Under Review',
      isEnabled:            false,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       'Your proof is currently being reviewed.',
      opensProofFlow:       false,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'none',
    };
  }

  // ── Not current stop (for ordered hunts) ─────────────────────────────────
  // Note: 'completed', 'locked', 'expired' are already handled above.
  if (!isCurrent) {
    return {
      actionType:           'locked',
      label:                'Not Yet Available',
      isEnabled:            false,
      requiresConfirmation: false,
      confirmationMessage:  null,
      disabledReason:       'Complete the current stop first.',
      opensProofFlow:       false,
      opensLocationFlow:    false,
      callsCompleteStop:    false,
      loadingBehavior:      'none',
    };
  }

  // ── Active states by completion method ───────────────────────────────────

  switch (completionMethod) {
    case 'none':
    case 'manual_confirmation':
      return {
        actionType:           'mark_complete',
        label:                'Mark Activity Complete',
        isEnabled:            true,
        requiresConfirmation: true,
        confirmationMessage:  'Have you completed this activity? This cannot be undone.',
        disabledReason:       null,
        opensProofFlow:       false,
        opensLocationFlow:    false,
        callsCompleteStop:    true,
        loadingBehavior:      'spinner',
      };

    case 'location':
      if (!locationValidated) {
        return {
          actionType:           'check_location',
          label:                'Check Location',
          isEnabled:            true,
          requiresConfirmation: false,
          confirmationMessage:  null,
          disabledReason:       null,
          opensProofFlow:       false,
          opensLocationFlow:    true,
          callsCompleteStop:    false,
          loadingBehavior:      'spinner',
        };
      }
      return {
        actionType:           'complete_stop',
        label:                'Complete Stop',
        isEnabled:            true,
        requiresConfirmation: true,
        confirmationMessage:  'Location verified. Mark this stop as complete?',
        disabledReason:       null,
        opensProofFlow:       false,
        opensLocationFlow:    false,
        callsCompleteStop:    true,
        loadingBehavior:      'spinner',
      };

    case 'text':
    case 'image':
    case 'text_and_image':
      return {
        actionType:           proofDraftReady ? 'submit_proof' : 'add_proof',
        label:                proofDraftReady ? 'Review & Submit' : 'Add Proof',
        isEnabled:            true,
        requiresConfirmation: false,
        confirmationMessage:  null,
        disabledReason:       null,
        opensProofFlow:       true,
        opensLocationFlow:    false,
        callsCompleteStop:    false,
        loadingBehavior:      'spinner',
      };

    case 'image_and_location':
      if (!locationValidated) {
        return {
          actionType:           'check_location',
          label:                'Verify Location First',
          isEnabled:            true,
          requiresConfirmation: false,
          confirmationMessage:  null,
          disabledReason:       null,
          opensProofFlow:       false,
          opensLocationFlow:    true,
          callsCompleteStop:    false,
          loadingBehavior:      'spinner',
        };
      }
      return {
        actionType:           proofDraftReady ? 'submit_proof' : 'add_proof',
        label:                proofDraftReady ? 'Review & Submit' : 'Add Photo',
        isEnabled:            true,
        requiresConfirmation: false,
        confirmationMessage:  null,
        disabledReason:       null,
        opensProofFlow:       true,
        opensLocationFlow:    false,
        callsCompleteStop:    false,
        loadingBehavior:      'spinner',
      };

    case 'trusted_code':
      return {
        actionType:           'add_proof',
        label:                'Enter Code',
        isEnabled:            true,
        requiresConfirmation: false,
        confirmationMessage:  null,
        disabledReason:       null,
        opensProofFlow:       true,
        opensLocationFlow:    false,
        callsCompleteStop:    false,
        loadingBehavior:      'spinner',
      };

    default:
      return {
        actionType:           'view_stop',
        label:                'View Stop',
        isEnabled:            true,
        requiresConfirmation: false,
        confirmationMessage:  null,
        disabledReason:       null,
        opensProofFlow:       false,
        opensLocationFlow:    false,
        callsCompleteStop:    false,
        loadingBehavior:      'none',
      };
  }
}

// ─── Primary hunt-level action (for header/footer) ────────────────────────────

export interface HuntLevelActionResult {
  label: string;
  isEnabled: boolean;
  actionType: 'complete_hunt' | 'continue' | 'disabled';
  reasonText: string | null;
}

export function resolveHuntLevelAction(
  participationStatus: string | null,
  completionReadiness: string | null,
  completedRequired: number,
  totalRequired: number,
): HuntLevelActionResult {
  if (participationStatus !== 'active' && participationStatus !== 'paused') {
    return { label: 'Unavailable', isEnabled: false, actionType: 'disabled', reasonText: null };
  }

  if (completionReadiness === 'ready') {
    return {
      label:     'Complete Hunt',
      isEnabled: true,
      actionType:'complete_hunt',
      reasonText: null,
    };
  }

  const remaining = Math.max(0, totalRequired - completedRequired);
  return {
    label:      `${remaining} Stop${remaining !== 1 ? 's' : ''} Remaining`,
    isEnabled:  false,
    actionType: 'continue',
    reasonText: remaining > 0
      ? `Complete ${remaining} more required stop${remaining !== 1 ? 's' : ''}.`
      : 'Proof review pending.',
  };
}
