/**
 * Hunt Domain Types — Worlds
 *
 * Centralized domain types for the Hunt system. Builds on raw Supabase enum
 * types from lib/supabase/database.types and adds rich app-layer interfaces.
 *
 * Rules:
 * - Never include private validation geometry in any type returned to the UI.
 * - Never include locked clue content.
 * - Never include internal moderation notes.
 * - Never include another participant's private proof or invitation data.
 */

// ─── Re-export database enum types ────────────────────────────────────────────
// These come from generated Supabase types. Listed here for domain clarity.

export type HuntType     = 'official' | 'custom' | 'community';
export type HuntStatus   =
  | 'draft' | 'pending_review' | 'ready' | 'scheduled' | 'active'
  | 'paused' | 'completed' | 'cancelled' | 'expired' | 'archived' | 'rejected';
export type HuntPrivacy  = 'public' | 'unlisted' | 'invite_only' | 'private';
export type HuntJoinPolicy = 'open' | 'approval_required' | 'invite_only';

/** Hunt-level lifecycle statuses, mapped to the Prompt 11 vocabulary */
export type HuntContentStatus = HuntStatus;
/**
 * Status → Prompt 11 vocabulary mapping:
 *   draft           → Draft
 *   pending_review  → Pending Review
 *   ready           → Approved (approved but not yet scheduled/active)
 *   scheduled       → Scheduled
 *   active          → Published / Available
 *   paused          → Paused
 *   cancelled       → Cancelled
 *   expired         → Expired
 *   archived        → Archived
 *   rejected        → Rejected
 *   completed       → (internal: all occurrences completed)
 */

export type ParticipantRole   = 'creator' | 'player' | 'co_host';
export type ParticipantStatus =
  | 'invited' | 'accepted' | 'ready' | 'active' | 'paused'
  | 'completed' | 'declined' | 'removed' | 'left' | 'expired';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
export type Difficulty       = 'very_easy' | 'easy' | 'medium' | 'hard' | 'epic';

// ─── Participation mode ────────────────────────────────────────────────────────
/**
 * Configured at the Hunt level.
 * solo            — each player participates individually
 * group           — players form groups, group progress is shared
 * solo_or_group   — Hunt supports either mode
 */
export type ParticipationMode = 'solo' | 'group' | 'solo_or_group';

// ─── Start model ───────────────────────────────────────────────────────────────
/**
 * Determines when/how a Hunt becomes active.
 * individual       — each eligible participant starts independently
 * scheduled        — Hunt becomes active at occurrence.starts_at automatically
 * host_controlled  — a co_host must trigger the start after requirements are met
 */
export type HuntStartModel = 'individual' | 'scheduled' | 'host_controlled';

// ─── Stop ordering ─────────────────────────────────────────────────────────────
/**
 * Hunt-level stop-ordering mode.
 * ordered   — stops must be completed in sort_order sequence
 * unordered — stops may be completed in any order (subject to unlock conditions)
 */
export type StopOrdering = 'ordered' | 'unordered';

// ─── Stop roles ───────────────────────────────────────────────────────────────
export type StopRole = 'start' | 'waypoint' | 'final';

// ─── Stop completion method ───────────────────────────────────────────────────
/**
 * How a participant completes a stop.
 * none                — no validation required (just tap "Mark arrived")
 * manual_confirmation — participant self-confirms; no server proof required
 * text                — text proof submitted for review
 * image               — image proof submitted for review
 * location            — server-side geospatial validation
 * image_and_location  — image proof + location validation required
 * text_and_image      — both text and image proof required
 * trusted_code        — server-validated one-time code (future)
 */
export type StopCompletionMethod =
  | 'none'
  | 'manual_confirmation'
  | 'text'
  | 'image'
  | 'location'
  | 'image_and_location'
  | 'text_and_image'
  | 'trusted_code';

// ─── Stop progress status ──────────────────────────────────────────────────────
/**
 * Per-participant stop progress states.
 * Maps to the database step_status enum plus extended domain states.
 *
 * Allowed transitions (see huntConstants.STOP_ALLOWED_TRANSITIONS):
 *   locked         → available
 *   available      → in_progress | awaiting_proof | completed (auto)
 *   in_progress    → awaiting_proof | completed (auto)
 *   awaiting_proof → under_review
 *   under_review   → completed | needs_resubmission | rejected
 *   needs_resubmission → under_review
 */
export type StopProgressStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'awaiting_proof'
  | 'under_review'
  | 'needs_resubmission'
  | 'completed'
  | 'rejected'
  | 'skipped'
  | 'expired';

// ─── Clue visibility ───────────────────────────────────────────────────────────
export type ClueVisibilityState = 'hidden' | 'available' | 'revealed' | 'completed' | 'expired';

// ─── Clue reveal rule ─────────────────────────────────────────────────────────
export type ClueRevealRule = 'on_stop_reveal' | 'on_request' | 'timed';

// ─── Owner type ───────────────────────────────────────────────────────────────
export type HuntOwnerType = 'platform' | 'administrator' | 'user_creator';

// ─── Hunt availability state ──────────────────────────────────────────────────
/**
 * One authoritative state describing a Hunt's availability to a specific user.
 * Used by HuntAvailabilityResult — never duplicated across Map/Detail/My Hunts.
 */
export type HuntAvailabilityState =
  | 'upcoming'
  | 'available'
  | 'invitation_required'
  | 'invited'
  | 'ready'
  | 'active'
  | 'full'
  | 'joined'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'private'
  | 'ineligible';

// ─── Eligibility reason codes ─────────────────────────────────────────────────
export type HuntEligibilityReasonCode =
  | 'ELIGIBLE'
  | 'NOT_AUTHENTICATED'
  | 'ACCOUNT_RESTRICTED'
  | 'ONBOARDING_INCOMPLETE'
  | 'HUNT_NOT_PUBLISHED'
  | 'HUNT_UPCOMING'
  | 'HUNT_EXPIRED'
  | 'HUNT_PAUSED'
  | 'HUNT_CANCELLED'
  | 'HUNT_FULL'
  | 'INVITATION_REQUIRED'
  | 'INVITATION_EXPIRED'
  | 'ALREADY_JOINED'
  | 'ALREADY_COMPLETED'
  | 'BLOCK_RELATIONSHIP'
  | 'PREREQUISITE_NOT_MET'
  | 'REGION_UNAVAILABLE'
  | 'MINIMUM_PARTICIPANTS_NOT_MET'
  | 'INVALID_PARTICIPATION_MODE'
  | 'OCCURRENCE_NOT_AVAILABLE'
  | 'START_WINDOW_CLOSED'
  | 'NOT_AUTHORIZED';

// ─── Completion readiness state ────────────────────────────────────────────────
export type CompletionReadinessState =
  | 'ready'
  | 'missing_required_stop'
  | 'proof_pending'
  | 'proof_rejected'
  | 'location_validation_required'
  | 'expired'
  | 'removed'
  | 'already_completed'
  | 'invalid_state';

// ─── Hunt action types ────────────────────────────────────────────────────────
export type HuntActionType =
  | 'view_hunt'
  | 'join_hunt'
  | 'invitation_required'
  | 'accept_invitation'
  | 'decline_invitation'
  | 'ready'
  | 'start_hunt'
  | 'continue_hunt'
  | 'submit_proof'
  | 'resubmit_proof'
  | 'view_submission'
  | 'view_completion'
  | 'full'
  | 'upcoming'
  | 'cancelled'
  | 'expired'
  | 'unavailable';

// ─── Domain event types ────────────────────────────────────────────────────────
export type HuntEventType =
  | 'hunt_published'
  | 'hunt_invitation_created'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'invitation_revoked'
  | 'hunt_joined'
  | 'hunt_ready'
  | 'hunt_started'
  | 'participant_removed'
  | 'participant_withdrew'
  | 'stop_unlocked'
  | 'stop_completed'
  | 'proof_submitted'
  | 'proof_approved'
  | 'proof_rejected'
  | 'resubmission_requested'
  | 'hunt_completed'
  | 'hunt_cancelled'
  | 'hunt_expired';

// ─── Hunt occurrence ───────────────────────────────────────────────────────────
/**
 * A scheduled instance of a Hunt definition.
 * One Hunt definition may have many occurrences (e.g., weekly runs).
 *
 * Occurrence keys follow the format:
 *   hunt:{hunt-slug}:{ISO-date}   → scheduled occurrence
 *   hunt:{hunt-slug}:open          → open / rolling Hunt
 */
export interface HuntOccurrence {
  id: string;
  huntId: string;
  occurrenceKey: string;
  status: HuntStatus;
  startsAt: string | null;
  endsAt: string | null;
  joinUntil: string | null;
  startUntil: string | null;
  completeUntil: string | null;
  startedUsersGracePeriodMinutes: number | null;
  hardExpiresAt: string | null;
  maxParticipants: number | null;
  minParticipants: number | null;
  participantCount: number;
  rewardOverridePoints: number | null;
  startModel: HuntStartModel;
  publicMeetingInfo: string | null;
  hostUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Hunt prerequisite ────────────────────────────────────────────────────────
/**
 * Typed, non-executable prerequisite model.
 * All prerequisites in a list use AND logic (all must be satisfied).
 * No executable code or expressions are stored.
 */
export interface HuntPrerequisite {
  id: string;
  huntId: string;
  type:
    | 'quest_completion'
    | 'hunt_completion'
    | 'minimum_points'
    | 'achievement'
    | 'invitation'
    | 'admin_access';
  requiredQuestId: string | null;
  requiredHuntId: string | null;
  requiredAchievementId: string | null;
  minimumPoints: number | null;
  createdAt: string;
}

// ─── Reward snapshot ──────────────────────────────────────────────────────────
/**
 * Stored at join or start time. Later edits to the Hunt do not silently
 * change active participant rewards.
 */
export interface HuntRewardSnapshot {
  huntVersion: number;
  occurrenceId: string | null;
  pointsReward: number;
  requiredStopCount: number;
  proofConfigVersion: number;
  completionDeadline: string | null;
  participationMode: ParticipationMode;
  groupRewardRule: 'individual_full_reward' | 'shared_pool' | 'contribution_based';
  snapshotAt: string;
}

// ─── Hunt creator public identity ─────────────────────────────────────────────
export interface HuntCreatorIdentity {
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

// ─── Hunt capacity state ──────────────────────────────────────────────────────
export interface HuntCapacityState {
  maxParticipants: number | null;
  currentCount: number;
  isUnlimited: boolean;
  isFull: boolean;
  availableSlots: number | null;
  /** Pending invitations do NOT reserve capacity in Build 1 */
  pendingInvitationCount: number;
}

// ─── Hunt moderation state ────────────────────────────────────────────────────
/** Safe moderation summary — no internal notes exposed to ordinary clients */
export interface HuntModerationState {
  contentStatus: HuntStatus;
  isModerationPending: boolean;
  isPublished: boolean;
  /** Never include reviewer identity or notes here */
}

// ─── Hunt summary (map / list view) ──────────────────────────────────────────
/**
 * Lightweight Hunt representation for map markers and list views.
 * No private geometry. No locked clue content.
 */
export interface HuntSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  huntType: HuntType;
  privacy: HuntPrivacy;
  difficulty: Difficulty;
  estimatedDurationMinutes: number | null;
  pointsReward: number;
  stopCount: number;
  isOrdered: boolean;
  participationMode: ParticipationMode;
  availabilityState: HuntAvailabilityState;
  participationStatus: ParticipantStatus | null;
  participationId: string | null;
  invitationId: string | null;
  invitationStatus: InvitationStatus | null;
  thumbnailUrl: string | null;
  occurrenceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacityState: HuntCapacityState;
  /** Display coordinate — NOT validation geometry */
  displayLat: number | null;
  displayLng: number | null;
  publicLocationLabel: string | null;
}

// ─── Hunt detail ──────────────────────────────────────────────────────────────
/**
 * Full Hunt content for the Hunt Detail screen.
 * No private stop geometry. No locked clue content. No other user's private proof.
 */
export interface HuntDetail extends HuntSummary {
  description: string;
  safetyNote: string | null;
  accessibilityNote: string | null;
  publicMeetingInfo: string | null;
  venueHoursNote: string | null;
  creator: HuntCreatorIdentity | null;
  occurrence: HuntOccurrence | null;
  prerequisites: HuntPrerequisite[];
  primaryAction: HuntAction;
  /** Stops visible at detail time (no locked clue content) */
  stops: HuntStopPreview[];
  rewardSnapshot: HuntRewardSnapshot | null;
}

// ─── Hunt stop preview (for detail view — no private geometry) ────────────────
export interface HuntStopPreview {
  id: string;
  sortOrder: number;
  title: string;
  description: string | null;
  stopRole: StopRole;
  isRequired: boolean;
  estimatedDurationMinutes: number | null;
  safetyNote: string | null;
  accessibilityNote: string | null;
  completionMethod: StopCompletionMethod;
  /** Display coordinate only — NOT validation point */
  publicLat: number | null;
  publicLng: number | null;
  publicRadius: number | null;
}

// ─── Active hunt stop (with authorized clue content) ─────────────────────────
export interface ActiveHuntStop extends HuntStopPreview {
  progressStatus: StopProgressStatus;
  progressId: string;
  revealedAt: string | null;
  /** Clue content — only included when server_reveal_state = 'revealed_to_participant' */
  clue: ActiveHuntClue | null;
  /** Proof submission ID if in progress */
  proofSubmissionId: string | null;
  attemptCount: number;
}

// ─── Active hunt clue ─────────────────────────────────────────────────────────
/**
 * Authorized clue content — included only when the stop has been revealed.
 * Hint text requires a separate explicit request (future: with penalty).
 */
export interface ActiveHuntClue {
  id: string;
  clueText: string | null;
  imageUrl: string | null;
  visibilityState: ClueVisibilityState;
  /** True when a hint is available to request (hint_text not included in this type) */
  hintAvailable: boolean;
  revealRule: ClueRevealRule;
}

// ─── Active hunt (full authorized state) ─────────────────────────────────────
/**
 * Authorized active Hunt state for a specific participant.
 * Returned by get_active_hunt RPC.
 * No locked future clue content. No private validation geometry.
 */
export interface ActiveHunt {
  huntId: string;
  huntTitle: string;
  occurrenceId: string | null;
  participationId: string;
  participationStatus: ParticipantStatus;
  participantRole: ParticipantRole;
  startedAt: string | null;
  completionDeadline: string | null;
  /** Authorized current stops — NOT all stops, NOT locked stops */
  currentStops: ActiveHuntStop[];
  completedStopCount: number;
  requiredStopCount: number;
  totalStopCount: number;
  rewardSnapshot: HuntRewardSnapshot | null;
  primaryAction: HuntAction;
  /** Public map locations for revealed stops only */
  revealedStopLocations: HuntStopPublicLocation[];
  /** Minimal group summary (participant count only — no private member data) */
  groupSummary: HuntGroupSummary | null;
}

// ─── Public stop location ─────────────────────────────────────────────────────
export interface HuntStopPublicLocation {
  stopId: string;
  publicLat: number;
  publicLng: number;
  publicRadius: number;
  stopTitle: string;
  stopRole: StopRole;
}

// ─── Group summary ────────────────────────────────────────────────────────────
/** Safe group context — no private member profiles or proof content */
export interface HuntGroupSummary {
  activeCount: number;
  completedCount: number;
  totalMemberCount: number;
  isReady: boolean;
}

// ─── Hunt participant ─────────────────────────────────────────────────────────
export interface HuntParticipant {
  id: string;
  huntId: string;
  occurrenceId: string | null;
  userId: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt: string | null;
  readyAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  removedAt: string | null;
  awardedPoints: number | null;
  rewardSnapshot: HuntRewardSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Hunt invitation ──────────────────────────────────────────────────────────
/**
 * Visible only to inviter, invitee, hunt creator, and authorized staff.
 * Never includes invitee email, private location history, or moderation data.
 */
export interface HuntInvitation {
  id: string;
  huntId: string;
  occurrenceId: string | null;
  inviterUserId: string;
  inviteeUserId: string;
  status: InvitationStatus;
  message: string | null;
  roleOffered: ParticipantRole | null;
  expiresAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  /** Public summary of the hunt for display */
  huntSummary: HuntSummary | null;
}

// ─── Hunt stop progress record ────────────────────────────────────────────────
export interface HuntStopProgress {
  id: string;
  huntParticipantId: string;
  huntStopId: string;
  status: StopProgressStatus;
  revealedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  proofSubmissionId: string | null;
  attemptCount: number;
  unlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Hunt availability result ─────────────────────────────────────────────────
/**
 * Authoritative single result for whether/how a user can interact with a Hunt.
 * Used by Map, Detail, My Hunts, Invitations — never duplicated.
 */
export interface HuntAvailabilityResult {
  state: HuntAvailabilityState;
  canView: boolean;
  canJoin: boolean;
  canStart: boolean;
  reasonCode: HuntEligibilityReasonCode;
  userMessage?: string;
  occurrenceId?: string;
  participationId?: string;
  invitationId?: string;
  availableFrom?: string;
  availableUntil?: string;
  primaryAction: HuntAction;
}

// ─── Hunt eligibility result ──────────────────────────────────────────────────
export interface HuntEligibilityResult {
  eligible: boolean;
  reasonCode: HuntEligibilityReasonCode;
  userMessage: string;
}

// ─── Hunt action ──────────────────────────────────────────────────────────────
/**
 * Resolved primary action for a Hunt in a given context.
 * Consumed by Map markers, Detail header, and My Hunts cards.
 * Never scattered — always from huntActionResolver.
 */
export interface HuntAction {
  actionType: HuntActionType;
  label: string;
  isEnabled: boolean;
  requiresConfirmation: boolean;
  confirmationMessage: string | null;
  reasonCode: HuntEligibilityReasonCode | null;
  loadingBehavior: 'replace_label' | 'spinner' | 'none';
}

// ─── Operation results ────────────────────────────────────────────────────────

export interface HuntJoinResult {
  success: boolean;
  participationId: string | null;
  participationStatus: ParticipantStatus | null;
  reasonCode: HuntEligibilityReasonCode | null;
  userMessage: string;
}

export interface HuntStartResult {
  success: boolean;
  participationId: string | null;
  participationStatus: ParticipantStatus | null;
  currentStops: ActiveHuntStop[];
  reasonCode: HuntEligibilityReasonCode | null;
  userMessage: string;
}

export interface HuntInviteResult {
  success: boolean;
  invitationId: string | null;
  reasonCode: HuntEligibilityReasonCode | null;
  userMessage: string;
}

export interface HuntInvitationActionResult {
  success: boolean;
  participationId: string | null;
  reasonCode: HuntEligibilityReasonCode | null;
  userMessage: string;
}

export interface HuntStopCompletionResult {
  success: boolean;
  stopId: string;
  newStatus: StopProgressStatus;
  nextStops: ActiveHuntStop[];
  huntCompletionReady: boolean;
  reasonCode: string | null;
  userMessage: string;
}

export interface HuntCompletionResult {
  success: boolean;
  participationId: string | null;
  awardedPoints: number | null;
  completedAt: string | null;
  reasonCode: CompletionReadinessState | null;
  userMessage: string;
}

export interface HuntWithdrawalResult {
  success: boolean;
  participationId: string | null;
  reasonCode: string | null;
  userMessage: string;
}

export interface HuntCancellationResult {
  success: boolean;
  huntId: string;
  occurrenceId: string | null;
  cancelledAt: string | null;
  reasonCode: string | null;
  userMessage: string;
}

// ─── Completion readiness ─────────────────────────────────────────────────────
export interface HuntCompletionReadiness {
  state: CompletionReadinessState;
  isReady: boolean;
  missingStopIds: string[];
  pendingProofStopIds: string[];
  rejectedProofStopIds: string[];
  userMessage: string;
}

// ─── My Hunts summary entries ─────────────────────────────────────────────────
export interface MyHuntsSummaryEntry {
  participationId: string;
  huntId: string;
  occurrenceId: string | null;
  huntTitle: string;
  huntSlug: string;
  thumbnailUrl: string | null;
  difficulty: Difficulty;
  participationStatus: ParticipantStatus;
  participantRole: ParticipantRole;
  completedStopCount: number;
  requiredStopCount: number;
  awardedPoints: number | null;
  startsAt: string | null;
  endsAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  primaryAction: HuntAction;
}

export interface MyHuntsSummary {
  active: MyHuntsSummaryEntry[];
  ready: MyHuntsSummaryEntry[];
  completed: MyHuntsSummaryEntry[];
  invitations: HuntInvitation[];
  totalActiveCount: number;
}

// ─── Hunt map result (public-safe) ────────────────────────────────────────────
/**
 * Data returned for a Hunt in map viewport results.
 * No private stop geometry. No invitee lists. No proof. No moderation notes.
 */
export interface HuntMapItem {
  huntId: string;
  occurrenceId: string | null;
  title: string;
  shortDescription: string;
  /** Display coordinate (start stop or hunt centroid — NOT validation geometry) */
  displayLat: number | null;
  displayLng: number | null;
  publicLocationLabel: string | null;
  availabilityState: HuntAvailabilityState;
  privacy: HuntPrivacy;
  pointsReward: number;
  estimatedDurationMinutes: number | null;
  difficulty: Difficulty;
  participantCount: number;
  capacityState: HuntCapacityState;
  participationStatus: ParticipantStatus | null;
  thumbnailUrl: string | null;
  stopCount: number;
  isFeatured: boolean;
}

// ─── Domain event ─────────────────────────────────────────────────────────────
/**
 * Typed domain event payload for Hunt actions.
 * Consumed by analytics and future notification infrastructure.
 *
 * Rules:
 * - Never include private clue content.
 * - Never include exact validation geometry.
 * - Never include proof contents.
 * - Never include sensitive moderation details.
 * - Never include access tokens.
 */
export interface HuntDomainEvent {
  type: HuntEventType;
  userId: string;
  huntId: string;
  participationId?: string;
  occurrenceId?: string;
  invitationId?: string;
  stopId?: string;
  timestamp: string;
  /** Safe scalar metadata — no geometry, no proof content */
  metadata?: Record<string, string | number | boolean>;
}

// ─── Analytics event names ────────────────────────────────────────────────────
export type HuntAnalyticsEvent =
  | 'hunt_map_viewed'
  | 'hunt_detail_viewed'
  | 'join_attempted'
  | 'hunt_joined'
  | 'invitation_viewed'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'hunt_started'
  | 'clue_viewed'
  | 'stop_started'
  | 'stop_completed'
  | 'proof_started'
  | 'proof_submitted'
  | 'hunt_completed'
  | 'hunt_withdrawn'
  | 'hunt_cancelled';
