/**
 * Quest Action Resolver — Worlds
 *
 * The single authoritative function that maps Quest availability state
 * to a typed UI action. Every card, screen, and button that drives a quest
 * action must use this resolver — never scatter label logic across components.
 *
 * Rules:
 * - One resolver call → one action per quest/participation combo.
 * - The UI layer chooses how to present the action (button, pill, disabled state).
 * - Never duplicate availability/eligibility checks here; trust the state passed in.
 */

import type {
  QuestAvailabilityState,
  EligibilityReasonCode,
} from '../types/quest.types';
export type { QuestAvailabilityState } from '../types/quest.types';
import type { ParticipationStatus, ProofSubmissionStatus } from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestActionType =
  | 'view'
  | 'start'
  | 'continue'
  | 'submit_proof'
  | 'view_submission'
  | 'resubmit'
  | 'view_completion'
  | 'complete_step'
  | 'unavailable';

export interface QuestAction {
  /** Button label shown to the user */
  label: string;
  /** Semantic action type — used for routing/mutation dispatch */
  actionType: QuestActionType;
  /** Whether the action is currently interactive */
  enabled: boolean;
  /** True if performing this action triggers a network/mutation operation */
  isMutation: boolean;
  /** Shown as disabled caption or toast when enabled = false */
  disabledReason?: string;
  /** Accessibility label for the button (more descriptive than label) */
  accessibilityLabel?: string;
}

export interface QuestActionInput {
  availabilityState: QuestAvailabilityState;
  /** Present when user has a participation */
  participationStatus?: ParticipationStatus | null;
  /** Present when a proof submission exists */
  proofStatus?: ProofSubmissionStatus | null;
  /** From QuestAvailabilityResult.reasonCode when state = 'ineligible' */
  reasonCode?: EligibilityReasonCode | null;
  /** Human-readable reason from availability result */
  userMessage?: string | null;
  /** Availability date for 'upcoming' state */
  availableFrom?: string | null;
  /** Whether the multi-step quest has all required steps completed */
  allRequiredStepsComplete?: boolean;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Map the current quest + participation state to a single UI action.
 *
 * Call this once per quest card or screen, not inside render loops.
 */
export function resolveQuestAction(input: QuestActionInput): QuestAction {
  const {
    availabilityState,
    participationStatus,
    proofStatus,
    reasonCode,
    userMessage,
    availableFrom,
    allRequiredStepsComplete,
  } = input;

  switch (availabilityState) {
    case 'available':
      return {
        label: 'Start Quest',
        actionType: 'start',
        enabled: true,
        isMutation: true,
        accessibilityLabel: 'Start this quest',
      };

    case 'active':
      // Active state — look at participation sub-status
      if (participationStatus === 'awaiting_proof') {
        return {
          label: 'Submit Proof',
          actionType: 'submit_proof',
          enabled: true,
          isMutation: false, // routes to proof screen
          accessibilityLabel: 'Submit proof for this quest',
        };
      }
      if (participationStatus === 'under_review') {
        return {
          label: 'View Submission',
          actionType: 'view_submission',
          enabled: true,
          isMutation: false,
          accessibilityLabel: 'View your submitted proof',
        };
      }
      if (participationStatus === 'needs_resubmission') {
        return {
          label: 'Resubmit Proof',
          actionType: 'resubmit',
          enabled: true,
          isMutation: false,
          accessibilityLabel: 'Resubmit proof for this quest',
        };
      }
      // in_progress, started — general continue
      return {
        label: 'Continue Quest',
        actionType: 'continue',
        enabled: true,
        isMutation: false,
        accessibilityLabel: 'Continue this quest',
      };

    case 'awaiting_proof':
      return {
        label: 'Submit Proof',
        actionType: 'submit_proof',
        enabled: true,
        isMutation: false,
        accessibilityLabel: 'Submit proof for this quest',
      };

    case 'under_review':
      return {
        label: 'View Submission',
        actionType: 'view_submission',
        enabled: true,
        isMutation: false,
        accessibilityLabel: 'View your submitted proof, currently under review',
      };

    case 'needs_resubmission':
      return {
        label: 'Resubmit Proof',
        actionType: 'resubmit',
        enabled: true,
        isMutation: false,
        accessibilityLabel: 'Resubmit proof — previous proof needs correction',
      };

    case 'completed':
      return {
        label: 'View Completion',
        actionType: 'view_completion',
        enabled: true,
        isMutation: false,
        accessibilityLabel: 'View your quest completion',
      };

    case 'upcoming': {
      const dateStr = availableFrom
        ? ` from ${new Date(availableFrom).toLocaleDateString()}`
        : '';
      return {
        label: 'Start Quest',
        actionType: 'start',
        enabled: false,
        isMutation: false,
        disabledReason: `Available${dateStr}`,
        accessibilityLabel: `Quest not yet available${dateStr}`,
      };
    }

    case 'expired':
      return {
        label: 'Quest Expired',
        actionType: 'unavailable',
        enabled: false,
        isMutation: false,
        disabledReason: 'This quest is no longer available.',
        accessibilityLabel: 'This quest has expired',
      };

    case 'paused':
      return {
        label: 'Temporarily Unavailable',
        actionType: 'unavailable',
        enabled: false,
        isMutation: false,
        disabledReason: 'This quest is temporarily unavailable.',
        accessibilityLabel: 'This quest is temporarily unavailable',
      };

    case 'ineligible': {
      const reason = mapIneligibleReason(reasonCode, userMessage);
      return {
        label: 'Start Quest',
        actionType: 'unavailable',
        enabled: false,
        isMutation: false,
        disabledReason: reason,
        accessibilityLabel: `Quest unavailable — ${reason}`,
      };
    }

    default:
      return {
        label: 'View Quest',
        actionType: 'view',
        enabled: true,
        isMutation: false,
        accessibilityLabel: 'View quest details',
      };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapIneligibleReason(
  reasonCode: EligibilityReasonCode | null | undefined,
  userMessage: string | null | undefined
): string {
  if (userMessage) return userMessage;
  switch (reasonCode) {
    case 'ALREADY_COMPLETED': return 'You completed this quest.';
    case 'ACTIVE_PARTICIPATION_EXISTS': return 'Continue your current quest.';
    case 'REPEAT_COOLDOWN': return 'This quest will be available again later.';
    case 'LOCATION_PERMISSION_REQUIRED': return 'Enable location to check availability.';
    case 'PREREQUISITE_NOT_MET': return 'Complete the required quest first.';
    case 'ACCOUNT_RESTRICTED': return 'This action is currently unavailable for your account.';
    case 'ACCOUNT_SUSPENDED': return 'Your account access is restricted.';
    case 'ONBOARDING_INCOMPLETE': return 'Complete onboarding to access quests.';
    case 'QUEST_NOT_PUBLISHED': return 'This quest is not available.';
    case 'QUEST_EXPIRED': return 'This quest has expired.';
    case 'QUEST_PAUSED': return 'This quest is temporarily unavailable.';
    case 'NO_OCCURRENCE_AVAILABLE': return 'No active occurrence for this quest.';
    case 'OUTSIDE_AVAILABLE_REGION': return 'You must be in the designated area.';
    default: return 'This quest is not available right now.';
  }
}

/**
 * Derive a short home-priority rank for a participation status.
 * Higher = shown first. Used to pick the dominant panel from active participations.
 */
export function participationUrgencyRank(status: ParticipationStatus): number {
  switch (status) {
    case 'needs_resubmission': return 6;
    case 'awaiting_proof':     return 5;
    case 'in_progress':        return 4;
    case 'started':            return 3;
    case 'under_review':       return 2;
    default:                   return 0;
  }
}
