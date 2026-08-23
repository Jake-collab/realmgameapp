/**
 * Hunt Domain Constants — Worlds
 *
 * Centralized business rules for the Hunt system.
 * Never hard-code these in components, services, or screens.
 */

import type {
  ParticipantStatus,
  StopProgressStatus,
  InvitationStatus,
  HuntStatus,
  HuntStartModel,
  ParticipationMode,
  HuntEligibilityReasonCode,
} from '../types/hunt.types';

// ─── Hunt lifecycle ───────────────────────────────────────────────────────────

/** Build 1 default: active participants may finish even after the Hunt expires */
export const DEFAULT_EXPIRATION_BEHAVIOR = 'started_users_grace_period' as const;

/** Build 1 default: every eligible participant receives the full configured reward */
export const DEFAULT_GROUP_REWARD_RULE = 'individual_full_reward' as const;

/** Build 1 default: stops must be completed in sort_order sequence */
export const DEFAULT_STOP_ORDERING = 'ordered' as const;

/** Build 1 default: individual start (no host required) */
export const DEFAULT_START_MODEL: HuntStartModel = 'individual';

/** Build 1 default: solo participation */
export const DEFAULT_PARTICIPATION_MODE: ParticipationMode = 'solo';

// ─── Occurrence keys ──────────────────────────────────────────────────────────
/**
 * Format: hunt:{hunt-slug}:{ISO-date-or-period}
 * Examples:
 *   hunt:downtown-photo-walk:2026-08-01
 *   hunt:city-explorer:open-2026-08
 */
export const SCHEDULED_OCCURRENCE_FORMAT  = 'hunt:{slug}:{date}';
export const OPEN_OCCURRENCE_FORMAT       = 'hunt:{slug}:open-{yearMonth}';
export const OCCURRENCE_KEY_PREFIX        = 'hunt:';

// ─── Idempotency key formats ──────────────────────────────────────────────────
/** Format: hunt_completion:{participationId} */
export const HUNT_COMPLETION_IDEMPOTENCY_FORMAT = 'hunt_completion:{participationId}';
/** Format: hunt_join:{huntId}:{userId} */
export const HUNT_JOIN_IDEMPOTENCY_FORMAT = 'hunt_join:{huntId}:{userId}';

// ─── Point constraints ────────────────────────────────────────────────────────
export const MIN_HUNT_POINTS    = 1;
export const MAX_HUNT_POINTS    = 50000;
export const MIN_STOP_POINTS    = 0;
export const MAX_STOP_POINTS    = 5000;

// ─── Capacity ─────────────────────────────────────────────────────────────────
/**
 * Build 1 capacity rule:
 * - accepted/joined participations count toward capacity.
 * - Pending invitations do NOT guarantee capacity.
 * - Declined, revoked, expired, withdrawn, removed statuses do NOT count.
 */
export const CAPACITY_COUNTING_STATUSES: ReadonlySet<ParticipantStatus> = new Set([
  'invited',    // invited counts — reduces capacity for invite-only hunts
  'accepted',
  'ready',
  'active',
  'paused',
  'completed',
]);

/**
 * Statuses that open a slot (participant is no longer active).
 * Used when checking whether capacity can reopen after withdrawal/removal.
 */
export const SLOT_RELEASING_STATUSES: ReadonlySet<ParticipantStatus> = new Set([
  'declined',
  'removed',
  'left',
  'expired',
]);

// ─── Participation status machine ─────────────────────────────────────────────
/**
 * Valid participant status transitions.
 * Reject any attempt to move to a status not in this list for the current status.
 */
export const PARTICIPANT_ALLOWED_TRANSITIONS: Record<ParticipantStatus, ParticipantStatus[]> = {
  invited:    ['accepted', 'declined', 'expired'],
  accepted:   ['ready', 'active', 'left', 'expired'],
  ready:      ['active', 'left', 'removed', 'expired'],
  active:     ['paused', 'completed', 'left', 'removed', 'expired'],
  paused:     ['active', 'left', 'removed', 'expired'],
  withdrawn:  [],
  cancelled:  [],
  // Terminal states
  completed:  [],
  declined:   [],
  removed:    [],
  left:       [],
  expired:    [],
};

/**
 * Transitions that may ONLY be performed by trusted server logic.
 * The mobile client may never request these directly.
 */
export const TRUSTED_ONLY_PARTICIPANT_TRANSITIONS: ReadonlySet<ParticipantStatus> = new Set([
  'completed',
  'removed',
  'expired',
]);

/**
 * Statuses from which a participant MAY withdraw themselves.
 */
export const WITHDRAWABLE_STATUSES: ReadonlySet<ParticipantStatus> = new Set([
  'joined' as any, // alias for accepted
  'accepted',
  'ready',
  'active',
  'paused',
]);

// ─── Stop progress status machine ─────────────────────────────────────────────
export const STOP_ALLOWED_TRANSITIONS: Record<StopProgressStatus, StopProgressStatus[]> = {
  not_started:         ['available', 'locked'],
  locked:              ['available'],
  available:           ['in_progress', 'awaiting_proof', 'completed', 'skipped'],
  in_progress:         ['awaiting_proof', 'completed', 'available'],
  awaiting_proof:      ['under_review'],
  under_review:        ['completed', 'needs_resubmission', 'rejected'],
  needs_resubmission:  ['under_review', 'awaiting_proof'],
  completed:           [],
  rejected:            [],
  skipped:             [],
  expired:             [],
};

/**
 * Stop status transitions that require trusted server authorization.
 */
export const TRUSTED_ONLY_STOP_TRANSITIONS: ReadonlySet<StopProgressStatus> = new Set([
  'completed',
  'rejected',
  'under_review',
  'needs_resubmission',
]);

// ─── Invitation status machine ────────────────────────────────────────────────
export const INVITATION_ALLOWED_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
  pending:   ['accepted', 'declined', 'revoked', 'expired'],
  accepted:  [], // terminal — cannot be silently re-declined
  declined:  [], // terminal
  revoked:   [], // terminal
  expired:   [], // terminal
};

/** Invitation statuses that cannot be accepted */
export const NON_ACCEPTABLE_INVITATION_STATUSES: ReadonlySet<InvitationStatus> = new Set([
  'accepted',
  'declined',
  'revoked',
  'expired',
]);

// ─── Hunt content status machine ──────────────────────────────────────────────
export const HUNT_CONTENT_ALLOWED_TRANSITIONS: Record<HuntStatus, HuntStatus[]> = {
  draft:          ['pending_review', 'rejected'],
  pending_review: ['ready', 'rejected'],
  ready:          ['scheduled', 'active', 'rejected'],
  scheduled:      ['active', 'paused', 'cancelled', 'archived'],
  active:         ['paused', 'completed', 'cancelled', 'expired', 'archived'],
  paused:         ['active', 'cancelled', 'archived'],
  completed:      ['archived'],
  cancelled:      ['archived'],
  expired:        ['archived'],
  rejected:       ['draft'],
  archived:       [],
};

/**
 * Hunt statuses from which users may join.
 */
export const JOINABLE_HUNT_STATUSES: ReadonlySet<HuntStatus> = new Set([
  'active',
]);

/**
 * Hunt statuses where participation can be started.
 */
export const STARTABLE_HUNT_STATUSES: ReadonlySet<HuntStatus> = new Set([
  'active',
  'scheduled', // when individual start model allows early start
]);

// ─── Invitation permissions ───────────────────────────────────────────────────
/**
 * Participant roles that may invite others (in addition to the Hunt owner).
 * Ordinary 'player' roles cannot invite unless the Hunt configuration permits it.
 */
export const INVITE_AUTHORIZED_ROLES = new Set([
  'creator',
  'co_host',
]);

// ─── Removal permissions ──────────────────────────────────────────────────────
/** Roles that may remove other participants */
export const REMOVAL_AUTHORIZED_ROLES = new Set([
  'creator',
  'co_host',
]);

// ─── Expiration config keys ───────────────────────────────────────────────────
/** Occurrence configuration keys for expiration behavior */
export const EXPIRATION_CONFIG = {
  JOIN_UNTIL:                'join_until',
  START_UNTIL:               'start_until',
  COMPLETE_UNTIL:            'complete_until',
  STARTED_USERS_MAY_FINISH:  'started_users_may_finish',
  HARD_EXPIRATION:           'hard_expiration',
} as const;

// ─── User-safe messages for eligibility codes ─────────────────────────────────
export const ELIGIBILITY_USER_MESSAGES: Record<HuntEligibilityReasonCode, string> = {
  ELIGIBLE:                   '',
  NOT_AUTHENTICATED:          'Sign in to join hunts.',
  ACCOUNT_RESTRICTED:         'Your account is restricted. Contact support.',
  ONBOARDING_INCOMPLETE:      'Complete onboarding to join hunts.',
  HUNT_NOT_PUBLISHED:         "This hunt isn't available yet.",
  HUNT_UPCOMING:              'This hunt starts soon. Check back when it opens.',
  HUNT_EXPIRED:               'This hunt has ended.',
  HUNT_PAUSED:                'This hunt is temporarily paused.',
  HUNT_CANCELLED:             'This hunt has been cancelled.',
  HUNT_FULL:                  "This hunt is full. No more spots are available.",
  INVITATION_REQUIRED:        'An invitation is required to join this hunt.',
  INVITATION_EXPIRED:         'Your invitation has expired.',
  ALREADY_JOINED:             "You've already joined this hunt.",
  ALREADY_COMPLETED:          "You've already completed this hunt.",
  BLOCK_RELATIONSHIP:         "You can't join this hunt.",
  PREREQUISITE_NOT_MET:       'You need to meet requirements before joining this hunt.',
  REGION_UNAVAILABLE:         'This hunt is not available in your region.',
  MINIMUM_PARTICIPANTS_NOT_MET: 'This hunt needs more participants before it can start.',
  INVALID_PARTICIPATION_MODE: 'This hunt requires a different participation mode.',
  OCCURRENCE_NOT_AVAILABLE:   'No active occurrence is available for this hunt.',
  START_WINDOW_CLOSED:        "The start window for this hunt has passed.",
  NOT_AUTHORIZED:             "You're not authorized to perform this action.",
};

// ─── Proof constraints ────────────────────────────────────────────────────────
export const MAX_HUNT_PROOF_IMAGES = 5;
export const MAX_HUNT_PROOF_TEXT_LENGTH = 2000;
export const MIN_HUNT_PROOF_TEXT_LENGTH = 10;
export const MAX_HUNT_RESUBMISSIONS = 3;

// ─── Default Hunt configuration ───────────────────────────────────────────────
export const HUNT_DEFAULTS = {
  MIN_PARTICIPANTS: 1,
  GRACE_PERIOD_MINUTES: 60,          // started users get 60 min after expiry
  DEFAULT_INVITATION_EXPIRY_DAYS: 7,
  MAX_PARTICIPANTS_DEFAULT: null,    // unlimited
  PROOF_CONFIG_VERSION: 1,
  HUNT_VERSION: 1,
} as const;
