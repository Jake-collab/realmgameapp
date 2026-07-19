/**
 * Hunt Feature — Public API
 *
 * This barrel export defines the public surface of the Hunt domain.
 * Do not import from internal modules directly.
 *
 * Rules:
 * - Never re-export private repository internals.
 * - Never re-export database row types.
 * - Never re-export fixture data from production code paths.
 * - Dev fixtures are exported only for test files and __DEV__ guards.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  HuntType,
  HuntStatus,
  HuntPrivacy,
  HuntJoinPolicy,
  HuntContentStatus,
  ParticipantRole,
  ParticipantStatus,
  InvitationStatus,
  Difficulty,
  ParticipationMode,
  HuntStartModel,
  StopOrdering,
  StopRole,
  StopCompletionMethod,
  StopProgressStatus,
  ClueVisibilityState,
  ClueRevealRule,
  HuntOwnerType,
  HuntAvailabilityState,
  HuntEligibilityReasonCode,
  CompletionReadinessState,
  HuntActionType,
  HuntEventType,
  // Domain models
  HuntOccurrence,
  HuntPrerequisite,
  HuntRewardSnapshot,
  HuntCreatorIdentity,
  HuntCapacityState,
  HuntSummary,
  HuntDetail,
  HuntStopPreview,
  ActiveHuntStop,
  ActiveHuntClue,
  ActiveHunt,
  HuntStopPublicLocation,
  HuntGroupSummary,
  HuntParticipant,
  HuntInvitation,
  HuntStopProgress,
  HuntAvailabilityResult,
  HuntEligibilityResult,
  HuntAction,
  HuntJoinResult,
  HuntStartResult,
  HuntInviteResult,
  HuntInvitationActionResult,
  HuntStopCompletionResult,
  HuntCompletionResult,
  HuntWithdrawalResult,
  HuntCancellationResult,
  HuntCompletionReadiness,
  MyHuntsSummaryEntry,
  MyHuntsSummary,
  HuntMapItem,
  HuntDomainEvent,
} from './types/hunt.types';

// ─── Constants ────────────────────────────────────────────────────────────────
export {
  DEFAULT_EXPIRATION_BEHAVIOR,
  DEFAULT_GROUP_REWARD_RULE,
  DEFAULT_STOP_ORDERING,
  DEFAULT_START_MODEL,
  DEFAULT_PARTICIPATION_MODE,
  SCHEDULED_OCCURRENCE_FORMAT,
  OPEN_OCCURRENCE_FORMAT,
  OCCURRENCE_KEY_PREFIX,
  HUNT_COMPLETION_IDEMPOTENCY_FORMAT,
  HUNT_JOIN_IDEMPOTENCY_FORMAT,
  MIN_HUNT_POINTS,
  MAX_HUNT_POINTS,
  CAPACITY_COUNTING_STATUSES,
  SLOT_RELEASING_STATUSES,
  PARTICIPANT_ALLOWED_TRANSITIONS,
  TRUSTED_ONLY_PARTICIPANT_TRANSITIONS,
  WITHDRAWABLE_STATUSES,
  STOP_ALLOWED_TRANSITIONS,
  TRUSTED_ONLY_STOP_TRANSITIONS,
  INVITATION_ALLOWED_TRANSITIONS,
  NON_ACCEPTABLE_INVITATION_STATUSES,
  HUNT_CONTENT_ALLOWED_TRANSITIONS,
  JOINABLE_HUNT_STATUSES,
  STARTABLE_HUNT_STATUSES,
  INVITE_AUTHORIZED_ROLES,
  REMOVAL_AUTHORIZED_ROLES,
  ELIGIBILITY_USER_MESSAGES,
  MAX_HUNT_PROOF_IMAGES,
  MAX_HUNT_PROOF_TEXT_LENGTH,
  HUNT_DEFAULTS,
} from './constants';

// ─── Query keys ───────────────────────────────────────────────────────────────
export {
  huntKeys,
  getJoinHuntInvalidationKeys,
  getStartHuntInvalidationKeys,
  getAcceptInvitationInvalidationKeys,
  getDeclineInvitationInvalidationKeys,
  getCompleteStopInvalidationKeys,
  getCompleteHuntInvalidationKeys,
  getWithdrawHuntInvalidationKeys,
} from './queries/huntKeys';

// ─── Repository (internal — accessed via hooks) ───────────────────────────────
// Not re-exported: hunt.repository.ts is accessed via hooks only.

// ─── Services ─────────────────────────────────────────────────────────────────
export {
  evaluateHuntEligibility,
  evaluateStartEligibility,
} from './services/huntEligibility.service';
export type {
  HuntEligibilityContext,
  HuntEligibilityInput,
} from './services/huntEligibility.service';

export { evaluateHuntAvailability } from './services/huntAvailability.service';
export type { HuntAvailabilityInput } from './services/huntAvailability.service';

export { resolveHuntAction, resolveSecondaryActions } from './services/huntActionResolver';
export type { HuntActionResolverInput } from './services/huntActionResolver';

export {
  evaluateCompletionReadiness,
  completeHunt,
} from './services/huntCompletion.service';
export type { StopReadinessSummary } from './services/huntCompletion.service';

export {
  isStopAccessible,
  canStartStop,
  canManuallyCompleteStop,
  isProofRequired,
  shouldShowClue,
  isStopTransitionAllowed,
  getStopDisplayPriority,
  completeHuntStop,
  getStopStatusLabel,
  getCompletionMethodLabel,
} from './services/huntStop.service';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useHuntAvailability }    from './hooks/useHuntAvailability';
export { useHuntDetail }          from './hooks/useHuntDetail';
export { useMyHunts }             from './hooks/useMyHunts';
export { useHuntInvitations }     from './hooks/useHuntInvitations';
export { useActiveHunt }          from './hooks/useActiveHunt';
export { useJoinHunt }            from './hooks/useJoinHunt';
export { useStartHunt }           from './hooks/useStartHunt';
export { useAcceptHuntInvitation, useDeclineHuntInvitation } from './hooks/useHuntInvitationActions';
export { useWithdrawFromHunt }    from './hooks/useWithdrawFromHunt';
export { useCompleteHuntStop }    from './hooks/useCompleteHuntStop';
export { useCompleteHunt }        from './hooks/useCompleteHunt';
export { useInviteToHunt }        from './hooks/useInviteToHunt';

// ─── Events ───────────────────────────────────────────────────────────────────
export {
  onHuntMapViewed,
  onHuntDetailViewed,
  onHuntInvitationCreated,
  onInvitationAccepted,
  onInvitationDeclined,
  onJoinAttempted,
  onHuntJoined,
  onHuntStarted,
  onParticipantWithdrew,
  onStopCompleted,
  onHuntCompleted,
  onHuntCancelled,
} from './events/huntEvents';

// ─── Errors ───────────────────────────────────────────────────────────────────
export { HuntDomainError, HuntErrors, normalizeHuntError } from './utils/huntErrors';
export type { HuntErrorCode } from './utils/huntErrors';
