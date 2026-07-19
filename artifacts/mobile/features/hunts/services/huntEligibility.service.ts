/**
 * Hunt Eligibility Service — Worlds
 *
 * One centralized evaluator for whether a user can join a specific Hunt.
 * Called by the availability evaluator, join service, invitation accept, and UI guards.
 *
 * Returns structured reason codes — never raw SQL or policy names.
 *
 * Checks (in order):
 *  1. Authentication
 *  2. Account status + onboarding
 *  3. Hunt content status (published / active)
 *  4. Hunt paused / cancelled / expired
 *  5. Privacy / invitation requirement
 *  6. Existing participation (idempotency)
 *  7. Capacity
 *  8. Occurrence availability (start window)
 *  9. Prerequisites
 */

import type { HuntEligibilityResult, HuntEligibilityReasonCode, HuntStatus } from '../types/hunt.types';
import { JOINABLE_HUNT_STATUSES, ELIGIBILITY_USER_MESSAGES } from '../constants';

// ─── Context types ────────────────────────────────────────────────────────────

export interface HuntEligibilityContext {
  /** Authenticated user ID. Null = not authenticated. */
  userId: string | null;
  /** Profile data — account_status and onboarding_status */
  profile: {
    account_status: 'active' | 'restricted' | 'suspended' | 'deactivated';
    onboarding_status: 'not_started' | 'in_progress' | 'completed';
  } | null;
  /** Completed hunt IDs (preloaded for prerequisite checks) */
  completedHuntIds?: Set<string>;
  /** Completed quest IDs (for cross-domain prerequisites) */
  completedQuestIds?: Set<string>;
  /** User total points (for minimum_points prerequisites) */
  userTotalPoints?: number;
}

export interface HuntEligibilityInput {
  huntId: string;
  huntStatus: HuntStatus;
  huntPrivacy: 'public' | 'unlisted' | 'invite_only' | 'private';
  huntJoinPolicy: 'open' | 'approval_required' | 'invite_only';
  maxParticipants: number | null;
  minParticipants: number;
  currentParticipantCount: number;
  context: HuntEligibilityContext;
  now?: Date;
  // Existing participation details
  existingParticipationStatus?: string | null;
  // Invitation details
  hasPendingInvitation?: boolean;
  invitationExpired?: boolean;
  // Occurrence window
  occurrenceStartsAt?: string | null;
  occurrenceJoinUntil?: string | null;
  // Prerequisites
  huntPrerequisites?: Array<{
    type: string;
    requiredHuntId: string | null;
    requiredQuestId: string | null;
    minimumPoints: number | null;
  }>;
}

// ─── Eligibility evaluator ────────────────────────────────────────────────────

export function evaluateHuntEligibility(
  input: HuntEligibilityInput
): HuntEligibilityResult {
  const { context, now = new Date() } = input;

  // 1. Authentication
  if (!context.userId || !context.profile) {
    return ineligible('NOT_AUTHENTICATED');
  }

  // 2. Account status
  const { account_status, onboarding_status } = context.profile;
  if (account_status === 'suspended' || account_status === 'deactivated') {
    return ineligible('ACCOUNT_RESTRICTED');
  }
  if (account_status === 'restricted') {
    return ineligible('ACCOUNT_RESTRICTED');
  }
  if (onboarding_status !== 'completed') {
    return ineligible('ONBOARDING_INCOMPLETE');
  }

  // 3. Hunt content status
  if (input.huntStatus === 'cancelled') return ineligible('HUNT_CANCELLED');
  if (input.huntStatus === 'expired')   return ineligible('HUNT_EXPIRED');
  if (input.huntStatus === 'paused')    return ineligible('HUNT_PAUSED');
  if (!JOINABLE_HUNT_STATUSES.has(input.huntStatus)) {
    // Upcoming hunts (scheduled) may still allow invitation-based joining
    if (input.huntStatus === 'scheduled' && !input.hasPendingInvitation) {
      return ineligible('HUNT_UPCOMING');
    }
    if (input.huntStatus !== 'scheduled') {
      return ineligible('HUNT_NOT_PUBLISHED');
    }
  }

  // 4. Privacy / invitation check
  if (input.huntPrivacy === 'invite_only' || input.huntJoinPolicy === 'invite_only') {
    if (!input.hasPendingInvitation) {
      return ineligible('INVITATION_REQUIRED');
    }
    if (input.invitationExpired) {
      return ineligible('INVITATION_EXPIRED');
    }
  }

  // 5. Existing participation idempotency
  const ep = input.existingParticipationStatus;
  if (ep) {
    if (ep === 'completed') return ineligible('ALREADY_COMPLETED');
    if (['accepted', 'ready', 'active', 'paused', 'invited'].includes(ep)) {
      return ineligible('ALREADY_JOINED');
    }
    if (['removed', 'left'].includes(ep)) {
      // Removed/left users cannot rejoin by default in Build 1
      return ineligible('NOT_AUTHORIZED');
    }
  }

  // 6. Capacity
  if (
    input.maxParticipants !== null &&
    input.currentParticipantCount >= input.maxParticipants
  ) {
    return ineligible('HUNT_FULL');
  }

  // 7. Occurrence availability window
  if (input.occurrenceJoinUntil) {
    const joinUntil = new Date(input.occurrenceJoinUntil);
    if (now > joinUntil) {
      return ineligible('START_WINDOW_CLOSED');
    }
  }

  // 8. Prerequisites
  if (input.huntPrerequisites && input.huntPrerequisites.length > 0) {
    const prereqResult = checkPrerequisites(input.huntPrerequisites, context);
    if (!prereqResult.eligible) return prereqResult;
  }

  return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
}

// ─── Prerequisites ────────────────────────────────────────────────────────────

function checkPrerequisites(
  prerequisites: HuntEligibilityInput['huntPrerequisites'],
  context: HuntEligibilityContext,
): HuntEligibilityResult {
  if (!prerequisites || prerequisites.length === 0) {
    return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
  }

  for (const prereq of prerequisites) {
    if (prereq.type === 'hunt_completion') {
      if (!prereq.requiredHuntId) continue;
      if (!context.completedHuntIds?.has(prereq.requiredHuntId)) {
        return ineligible('PREREQUISITE_NOT_MET');
      }
    }

    if (prereq.type === 'quest_completion') {
      if (!prereq.requiredQuestId) continue;
      if (!context.completedQuestIds?.has(prereq.requiredQuestId)) {
        return ineligible('PREREQUISITE_NOT_MET');
      }
    }

    if (prereq.type === 'minimum_points') {
      if (prereq.minimumPoints !== null) {
        const userPoints = context.userTotalPoints ?? 0;
        if (userPoints < prereq.minimumPoints) {
          return ineligible('PREREQUISITE_NOT_MET');
        }
      }
    }

    // 'achievement', 'invitation', 'admin_access' evaluated in future prompts
  }

  return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ineligible(reasonCode: HuntEligibilityReasonCode): HuntEligibilityResult {
  return {
    eligible: false,
    reasonCode,
    userMessage: ELIGIBILITY_USER_MESSAGES[reasonCode] ?? 'You are not eligible for this hunt.',
  };
}

// ─── Start eligibility ────────────────────────────────────────────────────────
/**
 * Whether a participant may START (become active) for a given hunt.
 * Separate from join eligibility — called on the Start button.
 */
export function evaluateStartEligibility(input: {
  participationStatus: string | null;
  huntStatus: HuntStatus;
  startModel: 'individual' | 'scheduled' | 'host_controlled';
  participantRole: 'creator' | 'player' | 'co_host' | null;
  occurrenceStartUntil?: string | null;
  now?: Date;
}): HuntEligibilityResult {
  const now = input.now ?? new Date();

  if (!input.participationStatus) {
    return ineligible('NOT_AUTHORIZED');
  }

  if (!['accepted', 'ready', 'invited'].includes(input.participationStatus)) {
    if (input.participationStatus === 'active') {
      return ineligible('ALREADY_JOINED'); // active already
    }
    return ineligible('NOT_AUTHORIZED');
  }

  if (input.huntStatus !== 'active' && input.huntStatus !== 'ready' && input.huntStatus !== 'scheduled') {
    return ineligible('HUNT_NOT_PUBLISHED');
  }

  // Host-controlled: only creator/co_host may trigger
  if (
    input.startModel === 'host_controlled' &&
    !['creator', 'co_host'].includes(input.participantRole ?? '')
  ) {
    return ineligible('NOT_AUTHORIZED');
  }

  // Start window check
  if (input.occurrenceStartUntil) {
    const startUntil = new Date(input.occurrenceStartUntil);
    if (now > startUntil) {
      return ineligible('START_WINDOW_CLOSED');
    }
  }

  return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
}
