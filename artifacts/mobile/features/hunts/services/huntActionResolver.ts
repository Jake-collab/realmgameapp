/**
 * Hunt Action Resolver — Worlds
 *
 * Resolves the single primary action for a Hunt in a given context.
 * Consumed by Map markers, Detail header, and My Hunts cards.
 *
 * Rules:
 * - Never duplicate this logic in components.
 * - Never return both "join" and "start" as available at the same time.
 * - Never expose implementation details in labels.
 * - All UI copy lives here — never hard-coded in components.
 */

import type {
  HuntAction,
  HuntActionType,
  HuntAvailabilityState,
  HuntEligibilityReasonCode,
} from '../types/hunt.types';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface HuntActionResolverInput {
  state: HuntAvailabilityState;
  canJoin: boolean;
  canStart: boolean;
  reasonCode: HuntEligibilityReasonCode;
  participationId: string | null;
  invitationId: string | null;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

export function resolveHuntAction(input: HuntActionResolverInput): HuntAction {
  const { state, canJoin, canStart, reasonCode, participationId, invitationId } = input;

  switch (state) {
    case 'active':
      return action('continue_hunt', 'Continue Hunt', true, false, null, 'spinner');

    case 'ready':
      if (canStart) {
        return action('start_hunt', 'Start Hunt', true, true,
          "Ready to go? Starting the hunt will begin your timer.", 'replace_label');
      }
      return action('view_hunt', 'View Hunt', true, false, null, 'none');

    case 'available':
      if (canJoin) {
        return action('join_hunt', 'Join Hunt', true, true,
          "Ready to join? You'll receive stops and clues once the hunt starts.", 'replace_label');
      }
      return action('view_hunt', 'View Hunt', true, false, null, 'none');

    case 'invited':
      if (invitationId) {
        return action('accept_invitation', 'Accept Invitation', true, true,
          "Accept the invitation to join this hunt?", 'replace_label');
      }
      return action('view_hunt', 'View Hunt', true, false, null, 'none');

    case 'invitation_required':
      return action('invitation_required', 'Invitation Required', false, false, null, 'none');

    case 'upcoming':
      return action('upcoming', 'Coming Soon', false, false, null, 'none');

    case 'completed':
      return action('view_completion', 'View Results', true, false, null, 'none');

    case 'full':
      return action('full', 'Hunt Full', false, false, null, 'none');

    case 'paused':
      return action('unavailable', 'Temporarily Paused', false, false, null, 'none');

    case 'cancelled':
      return action('cancelled', 'Cancelled', false, false, null, 'none');

    case 'expired':
      return action('expired', 'Hunt Ended', false, false, null, 'none');

    case 'private':
    case 'ineligible':
      return action('unavailable', 'Unavailable', false, false, null, 'none');

    case 'joined':
      return action('continue_hunt', 'Continue Hunt', true, false, null, 'spinner');

    default:
      return action('view_hunt', 'View Hunt', true, false, null, 'none');
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function action(
  actionType: HuntActionType,
  label: string,
  isEnabled: boolean,
  requiresConfirmation: boolean,
  confirmationMessage: string | null,
  loadingBehavior: 'replace_label' | 'spinner' | 'none',
  reasonCode: HuntEligibilityReasonCode | null = null,
): HuntAction {
  return {
    actionType,
    label,
    isEnabled,
    requiresConfirmation,
    confirmationMessage,
    reasonCode,
    loadingBehavior,
  };
}

// ─── Secondary actions ────────────────────────────────────────────────────────

/**
 * Secondary/contextual actions available within an active hunt screen.
 * These supplement the primary action — displayed as secondary buttons.
 */
export function resolveSecondaryActions(input: {
  state: HuntAvailabilityState;
  participationStatus: string | null;
  canWithdraw: boolean;
}): HuntAction[] {
  const actions: HuntAction[] = [];

  if (input.canWithdraw && ['active', 'ready', 'accepted', 'paused'].includes(input.participationStatus ?? '')) {
    actions.push(
      action('unavailable', 'Withdraw from Hunt', true, true,
        'Are you sure you want to withdraw? Your progress will be lost.', 'replace_label')
    );
  }

  return actions;
}
