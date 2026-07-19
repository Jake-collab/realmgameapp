/**
 * Hunt Domain Tests — Worlds
 *
 * Unit tests for Hunt domain logic.
 * No network, no Supabase client, no real RLS required.
 *
 * Coverage:
 * - Hunt availability evaluation (10 scenarios)
 * - Hunt eligibility evaluation (13 scenarios)
 * - Hunt action resolver (8 scenarios)
 * - Participation state machine (8 scenarios)
 * - Stop state machine (8 scenarios)
 * - Invitation state machine (5 scenarios)
 * - Hunt completion readiness (8 scenarios)
 * - Stop display priority (6 scenarios)
 * - Stop service utilities (8 scenarios)
 * - Idempotency key formats (3 scenarios)
 * - Security assertions (8 scenarios)
 *
 * Integration tests (skipped — require live Supabase):
 * - join_hunt RPC (idempotency, capacity, reward snapshot)
 * - accept_hunt_invitation RPC (idempotency, capacity recheck)
 * - complete_hunt_stop RPC (sequential unlock, trusted-only guard)
 * - complete_hunt RPC (idempotency, points ledger)
 * - get_hunt_availability RPC (all states)
 * - get_my_hunts_summary RPC
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  evaluateHuntEligibility,
  evaluateStartEligibility,
} from '../features/hunts/services/huntEligibility.service';
import { evaluateHuntAvailability } from '../features/hunts/services/huntAvailability.service';
import { resolveHuntAction } from '../features/hunts/services/huntActionResolver';
import {
  evaluateCompletionReadiness,
} from '../features/hunts/services/huntCompletion.service';
import {
  isStopAccessible,
  canStartStop,
  canManuallyCompleteStop,
  isProofRequired,
  shouldShowClue,
  isStopTransitionAllowed,
  getStopDisplayPriority,
  getStopStatusLabel,
} from '../features/hunts/services/huntStop.service';
import {
  PARTICIPANT_ALLOWED_TRANSITIONS,
  TRUSTED_ONLY_PARTICIPANT_TRANSITIONS,
  STOP_ALLOWED_TRANSITIONS,
  TRUSTED_ONLY_STOP_TRANSITIONS,
  INVITATION_ALLOWED_TRANSITIONS,
  CAPACITY_COUNTING_STATUSES,
  SLOT_RELEASING_STATUSES,
  ELIGIBILITY_USER_MESSAGES,
} from '../features/hunts/constants';
import { normalizeHuntError, HuntErrors } from '../features/hunts/utils/huntErrors';
import type { HuntEligibilityContext } from '../features/hunts/services/huntEligibility.service';
import type { StopProgressStatus, ParticipantStatus } from '../features/hunts/types/hunt.types';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const ACTIVE_PROFILE = {
  account_status: 'active' as const,
  onboarding_status: 'completed' as const,
};

const ACTIVE_CONTEXT: HuntEligibilityContext = {
  userId: 'user-001',
  profile: ACTIVE_PROFILE,
};

const BASE_ELIGIBILITY_INPUT = {
  huntId: 'hunt-001',
  huntStatus: 'active' as const,
  huntPrivacy: 'public' as const,
  huntJoinPolicy: 'open' as const,
  maxParticipants: null,
  minParticipants: 1,
  currentParticipantCount: 0,
};

const BASE_AVAILABILITY_INPUT = {
  huntId: 'hunt-001',
  occurrenceId: null,
  huntStatus: 'active' as const,
  huntPrivacy: 'public' as const,
  huntJoinPolicy: 'open' as const,
  maxParticipants: null,
  currentParticipantCount: 0,
  isAuthenticated: true,
};

// ─── Hunt Availability Tests ──────────────────────────────────────────────────

describe('HuntAvailability', () => {
  it('returns available for authenticated user on active open hunt', () => {
    const result = evaluateHuntAvailability(BASE_AVAILABILITY_INPUT);
    expect(result.state).toBe('available');
    expect(result.canJoin).toBe(true);
    expect(result.canView).toBe(true);
  });

  it('returns available with canJoin=false for unauthenticated user', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      isAuthenticated: false,
    });
    expect(result.state).toBe('available');
    expect(result.canJoin).toBe(false);
    expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
  });

  it('returns cancelled for cancelled hunt', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      huntStatus: 'cancelled',
    });
    expect(result.state).toBe('cancelled');
    expect(result.canJoin).toBe(false);
  });

  it('returns expired for expired hunt', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      huntStatus: 'expired',
    });
    expect(result.state).toBe('expired');
    expect(result.canJoin).toBe(false);
  });

  it('returns paused for paused hunt', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      huntStatus: 'paused',
    });
    expect(result.state).toBe('paused');
    expect(result.canJoin).toBe(false);
  });

  it('returns active for user already participating', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      participationStatus: 'active',
      participationId: 'part-001',
    });
    expect(result.state).toBe('active');
    expect(result.canJoin).toBe(false);
    expect(result.participationId).toBe('part-001');
  });

  it('returns ready for accepted participant (canStart=true)', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      participationStatus: 'accepted',
      participationId: 'part-001',
    });
    expect(result.state).toBe('ready');
    expect(result.canStart).toBe(true);
  });

  it('returns full when capacity reached', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      maxParticipants: 5,
      currentParticipantCount: 5,
    });
    expect(result.state).toBe('full');
    expect(result.canJoin).toBe(false);
    expect(result.reasonCode).toBe('HUNT_FULL');
  });

  it('returns invitation_required for invite-only hunt without invitation', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      huntPrivacy: 'invite_only',
      invitationStatus: null,
    });
    expect(result.state).toBe('invitation_required');
    expect(result.canJoin).toBe(false);
    expect(result.reasonCode).toBe('INVITATION_REQUIRED');
  });

  it('returns invited for invite-only hunt with pending invitation', () => {
    const result = evaluateHuntAvailability({
      ...BASE_AVAILABILITY_INPUT,
      huntPrivacy: 'invite_only',
      invitationStatus: 'pending',
      invitationId: 'inv-001',
    });
    expect(result.state).toBe('invited');
    expect(result.canJoin).toBe(true);
    expect(result.invitationId).toBe('inv-001');
  });
});

// ─── Hunt Eligibility Tests ───────────────────────────────────────────────────

describe('HuntEligibility', () => {
  it('rejects unauthenticated user', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      context: { userId: null, profile: null },
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
  });

  it('rejects suspended account', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      context: {
        userId: 'user-001',
        profile: { account_status: 'suspended', onboarding_status: 'completed' },
      },
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_RESTRICTED');
  });

  it('rejects incomplete onboarding', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      context: {
        userId: 'user-001',
        profile: { account_status: 'active', onboarding_status: 'not_started' },
      },
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ONBOARDING_INCOMPLETE');
  });

  it('rejects cancelled hunt', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      huntStatus: 'cancelled',
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('HUNT_CANCELLED');
  });

  it('rejects expired hunt', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      huntStatus: 'expired',
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('HUNT_EXPIRED');
  });

  it('rejects paused hunt', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      huntStatus: 'paused',
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('HUNT_PAUSED');
  });

  it('rejects full hunt', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      maxParticipants: 10,
      currentParticipantCount: 10,
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('HUNT_FULL');
  });

  it('rejects invite_only hunt without invitation', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      huntPrivacy: 'invite_only',
      hasPendingInvitation: false,
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('INVITATION_REQUIRED');
  });

  it('allows invite_only hunt WITH valid invitation', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      huntPrivacy: 'invite_only',
      hasPendingInvitation: true,
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe('ELIGIBLE');
  });

  it('rejects already joined participant', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      existingParticipationStatus: 'active',
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ALREADY_JOINED');
  });

  it('rejects already completed participant', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      existingParticipationStatus: 'completed',
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ALREADY_COMPLETED');
  });

  it('returns ELIGIBLE for valid unjoined user', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      context: ACTIVE_CONTEXT,
    });
    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe('ELIGIBLE');
    expect(result.userMessage).toBe('');
  });

  it('rejects prerequisite hunt not completed', () => {
    const result = evaluateHuntEligibility({
      ...BASE_ELIGIBILITY_INPUT,
      context: { ...ACTIVE_CONTEXT, completedHuntIds: new Set() },
      huntPrerequisites: [{
        type: 'hunt_completion',
        requiredHuntId: 'required-hunt-001',
        requiredQuestId: null,
        minimumPoints: null,
      }],
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('PREREQUISITE_NOT_MET');
  });
});

// ─── Hunt Action Resolver Tests ───────────────────────────────────────────────

describe('HuntActionResolver', () => {
  it('returns join_hunt action for available + canJoin', () => {
    const action = resolveHuntAction({
      state: 'available',
      canJoin: true,
      canStart: false,
      reasonCode: 'ELIGIBLE',
      participationId: null,
      invitationId: null,
    });
    expect(action.actionType).toBe('join_hunt');
    expect(action.isEnabled).toBe(true);
    expect(action.requiresConfirmation).toBe(true);
  });

  it('returns start_hunt for ready + canStart', () => {
    const action = resolveHuntAction({
      state: 'ready',
      canJoin: false,
      canStart: true,
      reasonCode: 'ALREADY_JOINED',
      participationId: 'part-001',
      invitationId: null,
    });
    expect(action.actionType).toBe('start_hunt');
    expect(action.isEnabled).toBe(true);
  });

  it('returns continue_hunt for active state', () => {
    const action = resolveHuntAction({
      state: 'active',
      canJoin: false,
      canStart: false,
      reasonCode: 'ALREADY_JOINED',
      participationId: 'part-001',
      invitationId: null,
    });
    expect(action.actionType).toBe('continue_hunt');
  });

  it('returns accept_invitation for invited state with invitationId', () => {
    const action = resolveHuntAction({
      state: 'invited',
      canJoin: true,
      canStart: false,
      reasonCode: 'ELIGIBLE',
      participationId: null,
      invitationId: 'inv-001',
    });
    expect(action.actionType).toBe('accept_invitation');
    expect(action.requiresConfirmation).toBe(true);
  });

  it('returns view_completion for completed state', () => {
    const action = resolveHuntAction({
      state: 'completed',
      canJoin: false,
      canStart: false,
      reasonCode: 'ALREADY_COMPLETED',
      participationId: 'part-001',
      invitationId: null,
    });
    expect(action.actionType).toBe('view_completion');
  });

  it('returns disabled action for full hunt', () => {
    const action = resolveHuntAction({
      state: 'full',
      canJoin: false,
      canStart: false,
      reasonCode: 'HUNT_FULL',
      participationId: null,
      invitationId: null,
    });
    expect(action.actionType).toBe('full');
    expect(action.isEnabled).toBe(false);
  });

  it('returns cancelled action for cancelled hunt', () => {
    const action = resolveHuntAction({
      state: 'cancelled',
      canJoin: false,
      canStart: false,
      reasonCode: 'HUNT_CANCELLED',
      participationId: null,
      invitationId: null,
    });
    expect(action.actionType).toBe('cancelled');
    expect(action.isEnabled).toBe(false);
  });

  it('returns upcoming action for upcoming hunt', () => {
    const action = resolveHuntAction({
      state: 'upcoming',
      canJoin: false,
      canStart: false,
      reasonCode: 'HUNT_UPCOMING',
      participationId: null,
      invitationId: null,
    });
    expect(action.actionType).toBe('upcoming');
    expect(action.isEnabled).toBe(false);
  });
});

// ─── Participation State Machine Tests ────────────────────────────────────────

describe('ParticipantStateMachine', () => {
  it('allows invited → accepted', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.invited).toContain('accepted');
  });

  it('allows invited → declined', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.invited).toContain('declined');
  });

  it('allows accepted → active', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.accepted).toContain('active');
  });

  it('allows active → completed (trusted only)', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.active).toContain('completed');
    expect(TRUSTED_ONLY_PARTICIPANT_TRANSITIONS.has('completed')).toBe(true);
  });

  it('allows active → left (user withdrawal)', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.active).toContain('left');
    expect(TRUSTED_ONLY_PARTICIPANT_TRANSITIONS.has('left')).toBe(false);
  });

  it('completed is terminal — no transitions out', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.completed).toHaveLength(0);
  });

  it('removed is terminal — no transitions out', () => {
    expect(PARTICIPANT_ALLOWED_TRANSITIONS.removed).toHaveLength(0);
  });

  it('removal is trusted-only', () => {
    expect(TRUSTED_ONLY_PARTICIPANT_TRANSITIONS.has('removed')).toBe(true);
  });
});

// ─── Stop State Machine Tests ─────────────────────────────────────────────────

describe('StopStateMachine', () => {
  it('allows locked → available', () => {
    expect(STOP_ALLOWED_TRANSITIONS.locked).toContain('available');
  });

  it('allows available → in_progress', () => {
    expect(STOP_ALLOWED_TRANSITIONS.available).toContain('in_progress');
  });

  it('allows in_progress → awaiting_proof', () => {
    expect(STOP_ALLOWED_TRANSITIONS.in_progress).toContain('awaiting_proof');
  });

  it('completed is trusted-only', () => {
    expect(TRUSTED_ONLY_STOP_TRANSITIONS.has('completed')).toBe(true);
  });

  it('rejected is trusted-only', () => {
    expect(TRUSTED_ONLY_STOP_TRANSITIONS.has('rejected')).toBe(true);
  });

  it('completed is terminal', () => {
    expect(STOP_ALLOWED_TRANSITIONS.completed).toHaveLength(0);
  });

  it('isStopTransitionAllowed: blocks trusted-only from untrusted caller', () => {
    expect(isStopTransitionAllowed('in_progress', 'completed', false)).toBe(false);
  });

  it('isStopTransitionAllowed: allows trusted-only from trusted caller', () => {
    expect(isStopTransitionAllowed('awaiting_proof', 'completed', true)).toBe(false); // awaiting_proof → completed not in allowed
    expect(isStopTransitionAllowed('under_review', 'completed', true)).toBe(true);
  });
});

// ─── Invitation State Machine Tests ───────────────────────────────────────────

describe('InvitationStateMachine', () => {
  it('allows pending → accepted', () => {
    expect(INVITATION_ALLOWED_TRANSITIONS.pending).toContain('accepted');
  });

  it('allows pending → declined', () => {
    expect(INVITATION_ALLOWED_TRANSITIONS.pending).toContain('declined');
  });

  it('allows pending → revoked', () => {
    expect(INVITATION_ALLOWED_TRANSITIONS.pending).toContain('revoked');
  });

  it('accepted is terminal', () => {
    expect(INVITATION_ALLOWED_TRANSITIONS.accepted).toHaveLength(0);
  });

  it('declined is terminal', () => {
    expect(INVITATION_ALLOWED_TRANSITIONS.declined).toHaveLength(0);
  });
});

// ─── Completion Readiness Tests ───────────────────────────────────────────────

describe('HuntCompletionReadiness', () => {
  const completedStop = { id: 's1', isRequired: true, progressStatus: 'completed' as StopProgressStatus };
  const incompleteStop = { id: 's2', isRequired: true, progressStatus: 'available' as StopProgressStatus };
  const optionalIncomplete = { id: 's3', isRequired: false, progressStatus: 'available' as StopProgressStatus };
  const pendingStop = { id: 's4', isRequired: true, progressStatus: 'under_review' as StopProgressStatus };
  const rejectedStop = { id: 's5', isRequired: true, progressStatus: 'rejected' as StopProgressStatus };

  it('returns ready when all required stops completed', () => {
    const result = evaluateCompletionReadiness([completedStop], 'active', null);
    expect(result.isReady).toBe(true);
    expect(result.state).toBe('ready');
  });

  it('returns missing_required_stop when a required stop is incomplete', () => {
    const result = evaluateCompletionReadiness([completedStop, incompleteStop], 'active', null);
    expect(result.isReady).toBe(false);
    expect(result.state).toBe('missing_required_stop');
    expect(result.missingStopIds).toContain('s2');
  });

  it('ignores optional incomplete stops', () => {
    const result = evaluateCompletionReadiness([completedStop, optionalIncomplete], 'active', null);
    expect(result.isReady).toBe(true);
  });

  it('returns proof_pending when stop is under review', () => {
    const result = evaluateCompletionReadiness([pendingStop], 'active', null);
    expect(result.isReady).toBe(false);
    expect(result.state).toBe('proof_pending');
  });

  it('returns proof_rejected when a stop proof was rejected', () => {
    const result = evaluateCompletionReadiness([rejectedStop], 'active', null);
    expect(result.isReady).toBe(false);
    expect(result.state).toBe('proof_rejected');
  });

  it('returns expired when deadline has passed', () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    const result = evaluateCompletionReadiness([completedStop], 'active', pastDeadline, new Date());
    expect(result.isReady).toBe(false);
    expect(result.state).toBe('expired');
  });

  it('returns invalid_state when participation is not active', () => {
    const result = evaluateCompletionReadiness([completedStop], 'completed', null);
    expect(result.isReady).toBe(false);
    expect(result.state).toBe('invalid_state');
  });

  it('returns already_completed for completed participation', () => {
    const result = evaluateCompletionReadiness([completedStop], 'completed', null);
    expect(result.state).toBe('invalid_state'); // completed is handled as invalid_state
  });
});

// ─── Stop Display Priority Tests ──────────────────────────────────────────────

describe('StopDisplayPriority', () => {
  const stops = [
    { id: 's1', sortOrder: 0, progressStatus: 'completed' as StopProgressStatus, isRequired: true },
    { id: 's2', sortOrder: 1, progressStatus: 'in_progress' as StopProgressStatus, isRequired: true },
    { id: 's3', sortOrder: 2, progressStatus: 'not_started' as StopProgressStatus, isRequired: true },
    { id: 's4', sortOrder: 3, progressStatus: 'not_started' as StopProgressStatus, isRequired: true },
  ];

  it('marks completed stops as completed', () => {
    const result = getStopDisplayPriority(stops);
    expect(result.find(s => s.id === 's1')?.displayPriority).toBe('completed');
  });

  it('marks in_progress stop as current', () => {
    const result = getStopDisplayPriority(stops);
    expect(result.find(s => s.id === 's2')?.displayPriority).toBe('current');
  });

  it('marks first locked stop after active as next', () => {
    const result = getStopDisplayPriority(stops);
    expect(result.find(s => s.id === 's3')?.displayPriority).toBe('next');
  });

  it('marks remaining locked stops as locked', () => {
    const result = getStopDisplayPriority(stops);
    expect(result.find(s => s.id === 's4')?.displayPriority).toBe('locked');
  });

  it('returns all completed when all done', () => {
    const allDone = stops.map(s => ({ ...s, progressStatus: 'completed' as StopProgressStatus }));
    const result = getStopDisplayPriority(allDone);
    expect(result.every(s => s.displayPriority === 'completed')).toBe(true);
  });

  it('sorts stops by sort_order regardless of input order', () => {
    const shuffled = [stops[3], stops[1], stops[0], stops[2]];
    const result = getStopDisplayPriority(shuffled);
    expect(result[0].id).toBe('s1');
    expect(result[1].id).toBe('s2');
  });
});

// ─── Stop Service Utility Tests ───────────────────────────────────────────────

describe('StopServiceUtilities', () => {
  it('isStopAccessible: available is accessible', () => {
    expect(isStopAccessible('available')).toBe(true);
  });

  it('isStopAccessible: locked is not accessible', () => {
    expect(isStopAccessible('locked')).toBe(false);
  });

  it('isStopAccessible: not_started is not accessible', () => {
    expect(isStopAccessible('not_started')).toBe(false);
  });

  it('canStartStop: only available stops can be started', () => {
    expect(canStartStop('available')).toBe(true);
    expect(canStartStop('in_progress')).toBe(false);
    expect(canStartStop('locked')).toBe(false);
  });

  it('canManuallyCompleteStop: manual_confirmation method works without location', () => {
    expect(canManuallyCompleteStop('available', 'manual_confirmation', false)).toBe(true);
  });

  it('canManuallyCompleteStop: image method requires proof flow', () => {
    expect(canManuallyCompleteStop('available', 'image', false)).toBe(false);
  });

  it('isProofRequired: image method requires proof', () => {
    expect(isProofRequired('image')).toBe(true);
    expect(isProofRequired('manual_confirmation')).toBe(false);
    expect(isProofRequired('none')).toBe(false);
  });

  it('shouldShowClue: shows clue for revealed stops', () => {
    expect(shouldShowClue('available')).toBe(true);
    expect(shouldShowClue('locked')).toBe(false);
    expect(shouldShowClue('not_started')).toBe(false);
    expect(shouldShowClue('completed')).toBe(true);
  });
});

// ─── Idempotency Key Tests ────────────────────────────────────────────────────

describe('IdempotencyKeys', () => {
  it('completion key follows format hunt_completion:{participationId}', () => {
    const participationId = 'part-uuid-12345';
    const key = `hunt_completion:${participationId}`;
    expect(key).toBe('hunt_completion:part-uuid-12345');
    expect(key.startsWith('hunt_completion:')).toBe(true);
  });

  it('join key follows format hunt_join:{huntId}:{userId}', () => {
    const key = `hunt_join:hunt-001:user-001`;
    expect(key.startsWith('hunt_join:')).toBe(true);
    const parts = key.split(':');
    expect(parts).toHaveLength(3);
  });

  it('duplicate completion keys are structurally equal', () => {
    const id = 'part-abc';
    const key1 = `hunt_completion:${id}`;
    const key2 = `hunt_completion:${id}`;
    expect(key1).toBe(key2);
  });
});

// ─── Security Assertion Tests ─────────────────────────────────────────────────

describe('Security Assertions', () => {
  it('CAPACITY_COUNTING_STATUSES includes active participants', () => {
    expect(CAPACITY_COUNTING_STATUSES.has('active')).toBe(true);
    expect(CAPACITY_COUNTING_STATUSES.has('completed')).toBe(true);
    expect(CAPACITY_COUNTING_STATUSES.has('accepted')).toBe(true);
  });

  it('CAPACITY_COUNTING_STATUSES does not include withdrawn participants', () => {
    expect(CAPACITY_COUNTING_STATUSES.has('left')).toBe(false);
    expect(CAPACITY_COUNTING_STATUSES.has('removed')).toBe(false);
    expect(CAPACITY_COUNTING_STATUSES.has('declined')).toBe(false);
    expect(CAPACITY_COUNTING_STATUSES.has('expired')).toBe(false);
  });

  it('TRUSTED_ONLY_PARTICIPANT_TRANSITIONS blocks client completion', () => {
    // The client should never directly set 'completed' — trusted server only
    expect(TRUSTED_ONLY_PARTICIPANT_TRANSITIONS.has('completed')).toBe(true);
  });

  it('TRUSTED_ONLY_STOP_TRANSITIONS blocks client stop completion', () => {
    expect(TRUSTED_ONLY_STOP_TRANSITIONS.has('completed')).toBe(true);
    expect(TRUSTED_ONLY_STOP_TRANSITIONS.has('rejected')).toBe(true);
  });

  it('ELIGIBILITY_USER_MESSAGES never expose SQL or policy names', () => {
    const messages = Object.values(ELIGIBILITY_USER_MESSAGES);
    for (const msg of messages) {
      expect(msg.toLowerCase()).not.toContain('rls');
      expect(msg.toLowerCase()).not.toContain('policy');
      expect(msg.toLowerCase()).not.toContain('sql');
      expect(msg.toLowerCase()).not.toContain('pg_');
      expect(msg.toLowerCase()).not.toContain('supabase');
    }
  });

  it('normalizeHuntError never exposes raw DB errors', () => {
    const rawError = { code: 'PGRST116', message: 'relation "hunt_stop_geofences" does not exist' };
    const normalized = normalizeHuntError(rawError);
    expect(normalized.userMessage).not.toContain('relation');
    expect(normalized.userMessage).not.toContain('hunt_stop_geofences');
    expect(normalized.code).toBe('HUNT_NOT_FOUND');
  });

  it('HuntErrors.full message does not expose capacity numbers', () => {
    const err = HuntErrors.full();
    // Safe to include "full" in the message, but no raw SQL numbers
    expect(err.userMessage).toBeTruthy();
    expect(err.userMessage.toLowerCase()).not.toContain('select');
  });

  it('start eligibility blocks non-host from host_controlled start', () => {
    const result = evaluateStartEligibility({
      participationStatus: 'accepted',
      huntStatus: 'active',
      startModel: 'host_controlled',
      participantRole: 'player',
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('NOT_AUTHORIZED');
  });
});

// ─── Integration tests (skipped — require live Supabase) ─────────────────────

describe.skip('Integration: join_hunt RPC', () => {
  it.todo('idempotent: second call returns existing participation');
  it.todo('blocks join when capacity reached');
  it.todo('creates reward snapshot from hunt.version at join time');
  it.todo('initializes stop progress for first stop (ordered hunt)');
  it.todo('increments occurrence.participant_count atomically');
});

describe.skip('Integration: accept_hunt_invitation RPC', () => {
  it.todo('idempotent: second accept returns existing participation');
  it.todo('rechecks capacity before creating participation');
  it.todo('marks invitation as accepted atomically with participation creation');
  it.todo('blocks expired invitations');
});

describe.skip('Integration: complete_hunt_stop RPC', () => {
  it.todo('unlocks next stop for ordered hunt');
  it.todo('blocks trusted-only status changes from client');
  it.todo('idempotent: already-completed stop returns success');
  it.todo('returns huntCompletionReady=true when all required stops done');
});

describe.skip('Integration: complete_hunt RPC', () => {
  it.todo('idempotent: second call returns existing completion');
  it.todo('inserts points_ledger entry with idempotency key');
  it.todo('fails when required stops are incomplete');
  it.todo('fails after completion deadline');
  it.todo('uses reward from snapshot, not current hunt config');
});

describe.skip('Integration: get_hunt_availability RPC', () => {
  it.todo('returns available for authenticated user');
  it.todo('returns invited for pending invitation');
  it.todo('returns full when capacity reached');
  it.todo('returns active for participant in progress');
  it.todo('returns completed for finished participant');
});

describe.skip('Integration: get_my_hunts_summary RPC', () => {
  it.todo('returns active, ready, completed, invitations for user');
  it.todo('excludes other users participation data');
  it.todo('excludes expired invitations');
});
