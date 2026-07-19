/**
 * Quest Domain Types — Worlds
 *
 * App-level domain types for the Quest system. These build on the raw database
 * row types from lib/supabase/database.types.ts and provide richer, safer
 * interfaces for service and UI layers.
 *
 * Rule: Never expose private validation geometry or admin-only fields through
 * these types. Geo validation lives in quest_geofences (server-only).
 */

import type {
  QuestRow,
  QuestObjectiveRow,
  QuestLocationRow,
  QuestParticipationRow,
  QuestStepProgressRow,
  ProofSubmissionRow,
  QuestType,
  QuestStatus,
  Difficulty,
  ProofType,
  LocationRequirementType,
  ParticipationStatus,
  ProofSubmissionStatus,
  IndoorOutdoor,
} from '@/lib/supabase/database.types';

export type {
  QuestType,
  QuestStatus,
  Difficulty,
  ProofType,
  LocationRequirementType,
  ParticipationStatus,
  ProofSubmissionStatus,
  IndoorOutdoor,
};

// ─── Completion mode ──────────────────────────────────────────────────────────
/**
 * auto          — Quest completes automatically once all required steps are done
 *                 (no proof review required).
 * manual_review — Quest requires proof submission and reviewer approval before
 *                 completion is confirmed and points are awarded.
 */
export type QuestCompletionMode = 'auto' | 'manual_review';

// ─── Expiration behavior ──────────────────────────────────────────────────────
/**
 * Defines what happens to active participations when quest content expires.
 *
 * hard                  — All participations expire immediately when available_until passes.
 * started_users_may_finish — Active participations continue but no new starts allowed.
 *
 * Build 1 default: started_users_may_finish
 */
export type QuestExpirationBehavior = 'hard' | 'started_users_may_finish';

// ─── Prerequisite model ───────────────────────────────────────────────────────
/**
 * A prerequisite requirement for starting a quest.
 * All prerequisites in a quest's list must be satisfied (AND logic).
 */
export interface QuestPrerequisite {
  id: string;
  quest_id: string;
  prerequisite_type: 'quest_completion' | 'minimum_points' | 'achievement';
  required_quest_id: string | null;
  required_achievement_id: string | null;
  minimum_points: number | null;
  created_at: string;
}

// ─── Quest occurrence ─────────────────────────────────────────────────────────
/**
 * A scheduled occurrence of a repeatable quest definition.
 *
 * occurrence_key examples:
 *   daily:{quest-slug}:{YYYY-MM-DD}      → daily quest occurrence
 *   monthly:{quest-slug}:{YYYY-MM}       → monthly drop occurrence
 *
 * Uniqueness for repeatable quests is tracked on (user_id, occurrence_key)
 * in quest_participations, not (user_id, quest_id).
 */
export interface QuestOccurrence {
  id: string;
  quest_id: string;
  occurrence_key: string;
  available_from: string;
  available_until: string;
  is_published: boolean;
  reward_override_points: number | null;
  admin_priority: number;
  created_at: string;
  updated_at: string;
}

// ─── Quest summary (list view) ────────────────────────────────────────────────
/**
 * Lightweight quest representation for list and home views.
 * Does NOT include objectives, geofence data, or admin fields.
 */
export interface QuestSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  quest_type: QuestType;
  status: QuestStatus;
  difficulty: Difficulty;
  estimated_duration_minutes: number | null;
  points_reward: number;
  indoor_outdoor: IndoorOutdoor;
  proof_type: ProofType;
  location_requirement_type: LocationRequirementType;
  available_from: string | null;
  available_until: string | null;
  is_repeatable: boolean;
  completion_mode: QuestCompletionMode;
  expiration_behavior: QuestExpirationBehavior;
  home_priority: number;
  public_location: QuestPublicLocation | null;
}

// ─── Quest detail (full view) ─────────────────────────────────────────────────
/**
 * Full quest representation for the detail screen.
 * Includes objectives but NOT geofence validation data.
 */
export interface QuestDetail extends QuestSummary {
  description: string;
  accessibility_notes: string | null;
  safety_notes: string | null;
  objectives: QuestObjective[];
  prerequisites: QuestPrerequisite[];
  occurrence: QuestOccurrence | null; // if a specific occurrence is loaded
}

// ─── Quest objective (step) ───────────────────────────────────────────────────
export interface QuestObjective {
  id: string;
  quest_id: string;
  sort_order: number;
  title: string;
  instructions: string;
  is_required: boolean;
  is_optional: boolean;
  proof_type: ProofType;
  location_requirement_type: LocationRequirementType;
  completion_rule: string;
  completion_mode: QuestCompletionMode;
}

// ─── Public location (safe for client) ───────────────────────────────────────
/**
 * Approximate location for map display.
 * Never includes precise validation geometry from quest_geofences.
 */
export interface QuestPublicLocation {
  id: string;
  quest_id: string;
  display_name: string;
  public_lat: number | null;
  public_lng: number | null;
  public_radius_meters: number | null;
  address_hint: string | null;
}

// ─── Quest availability result ────────────────────────────────────────────────
/**
 * The authoritative availability state for a quest + user combination.
 * Used by NavigationGuard, Home, Quests list, and Quest detail.
 * Do NOT duplicate this calculation across screens.
 */
export type QuestAvailabilityState =
  | 'upcoming'           // scheduled, not yet available
  | 'available'          // can be started
  | 'active'             // user has an active participation
  | 'awaiting_proof'     // user must submit proof
  | 'under_review'       // proof submitted, awaiting review
  | 'needs_resubmission' // reviewer requested resubmission
  | 'completed'          // user successfully completed this quest/occurrence
  | 'expired'            // quest or participation window has closed
  | 'paused'             // temporarily unavailable
  | 'ineligible';        // user cannot start (see reasonCode)

export interface QuestAvailabilityResult {
  state: QuestAvailabilityState;
  canStart: boolean;
  reasonCode?: EligibilityReasonCode;
  userMessage?: string;
  availableFrom?: string;
  availableUntil?: string;
  activeParticipationId?: string;
  occurrenceKey?: string;
  currentOccurrenceId?: string;
}

// ─── Eligibility reason codes ─────────────────────────────────────────────────
export type EligibilityReasonCode =
  | 'NOT_AUTHENTICATED'
  | 'ACCOUNT_RESTRICTED'
  | 'ACCOUNT_SUSPENDED'
  | 'ONBOARDING_INCOMPLETE'
  | 'QUEST_NOT_PUBLISHED'
  | 'QUEST_NOT_STARTED_YET'
  | 'QUEST_EXPIRED'
  | 'QUEST_PAUSED'
  | 'ALREADY_COMPLETED'
  | 'ACTIVE_PARTICIPATION_EXISTS'
  | 'REPEAT_COOLDOWN'
  | 'LOCATION_PERMISSION_REQUIRED'
  | 'OUTSIDE_AVAILABLE_REGION'
  | 'PREREQUISITE_NOT_MET'
  | 'NO_OCCURRENCE_AVAILABLE'
  | 'ELIGIBLE'; // used as explicit "no issue" code

export interface QuestEligibilityResult {
  eligible: boolean;
  reasonCode: EligibilityReasonCode;
  /** Human-readable message for display in UI */
  userMessage: string;
  /** Remaining cooldown in seconds, if applicable */
  cooldownRemainingSeconds?: number;
  /** ID of existing active participation, if applicable */
  activeParticipationId?: string;
}

// ─── Quest start result ───────────────────────────────────────────────────────
export interface QuestStartResult {
  success: boolean;
  participation: QuestParticipationRow | null;
  firstObjective: QuestObjective | null;
  /** True if an existing active participation was returned (idempotent) */
  wasExisting: boolean;
  error?: QuestDomainError;
}

// ─── Quest completion result ──────────────────────────────────────────────────
export interface QuestCompletionResult {
  success: boolean;
  participationId: string;
  awardedPoints: number;
  completedAt: string;
  /** True if reward was already issued (idempotent) */
  wasAlreadyCompleted: boolean;
  error?: QuestDomainError;
}

// ─── Quest point reward ───────────────────────────────────────────────────────
export interface QuestPointReward {
  questId: string;
  participationId: string;
  /** Points at time of start — used for completion, not current quest value */
  snapshotPoints: number;
  awardedAt: string | null;
}

/** Suggested reward range from point_reward_guidelines */
export interface PointRewardGuideline {
  difficulty: Difficulty;
  minimumMinutes: number;
  maximumMinutes: number;
  suggestedMinPoints: number;
  suggestedMaxPoints: number;
}

// ─── Active participation view ────────────────────────────────────────────────
/**
 * Rich view of a user's active participation, combining participation +
 * quest data + step progress + current proof state.
 * Only authorized data — no geofence details, no other users' proof.
 */
export interface ActiveQuestView {
  participation: QuestParticipationRow & {
    reward_snapshot_points: number | null;
    occurrence_key: string | null;
  };
  quest: QuestSummary;
  objectives: QuestObjective[];
  stepProgress: QuestStepProgressRow[];
  currentProof: ProofSubmissionRow | null;
  /** Computed helper fields */
  helpers: QuestProgressHelpers;
}

export interface QuestProgressHelpers {
  requiredStepsCompleted: number;
  totalRequiredSteps: number;
  completionReadiness: 'ready' | 'steps_incomplete' | 'proof_required' | 'awaiting_review';
  currentStep: QuestObjective | null;
  nextAvailableStep: QuestObjective | null;
  progressPercent: number | null; // null when not meaningfully measurable
}

// ─── Quest expiration result ──────────────────────────────────────────────────
export interface QuestExpirationResult {
  expired: boolean;
  expiredAt: string | null;
  participationExpired: boolean;
  questContentExpired: boolean;
  /** Whether user was allowed to continue after content expiry */
  allowedToFinish: boolean;
}

// ─── Proof requirement config ─────────────────────────────────────────────────
export interface ProofRequirementConfig {
  proofType: ProofType;
  requiresProof: boolean;
  requiresLocation: boolean;
  requiresManualReview: boolean;
  allowsAutoApproval: boolean;
  minImageCount: number;
  maxImageCount: number;
  minTextLength: number;
  maxTextLength: number;
  maxResubmissions: number;
}

// ─── Quest domain error ───────────────────────────────────────────────────────
export interface QuestDomainError {
  code: QuestErrorCode;
  message: string;   // user-facing, safe
  technical?: string; // dev-only, never shown to users
  canRetry: boolean;
  reasonCode?: EligibilityReasonCode;
}

export type QuestErrorCode =
  | 'QUEST_NOT_FOUND'
  | 'QUEST_UNAVAILABLE'
  | 'QUEST_EXPIRED'
  | 'QUEST_PAUSED'
  | 'ALREADY_COMPLETED'
  | 'ACTIVE_PARTICIPATION_EXISTS'
  | 'REPEAT_COOLDOWN_ACTIVE'
  | 'NOT_ELIGIBLE'
  | 'LOCATION_REQUIRED'
  | 'LOCATION_VALIDATION_FAILED'
  | 'PROOF_REQUIRED'
  | 'PROOF_ALREADY_SUBMITTED'
  | 'PROOF_UNDER_REVIEW'
  | 'INVALID_STATE_TRANSITION'
  | 'REWARD_ALREADY_ISSUED'
  | 'ACCOUNT_RESTRICTED'
  | 'NETWORK_UNAVAILABLE'
  | 'SERVER_ERROR';

// ─── Notification event payloads ──────────────────────────────────────────────
/**
 * Domain events emitted by Quest services. These are not sent to users directly —
 * they are consumed by notification and analytics infrastructure (Prompt 21+).
 */
export type QuestEventType =
  | 'quest_became_available'
  | 'monthly_drop_published'
  | 'quest_started'
  | 'step_completed'
  | 'proof_started'
  | 'proof_submitted'
  | 'proof_approved'
  | 'proof_rejected'
  | 'resubmission_requested'
  | 'quest_completed'
  | 'quest_expired'
  | 'quest_abandoned'
  | 'quest_list_viewed'
  | 'quest_detail_viewed'
  | 'quest_start_attempted';

export interface QuestEvent {
  type: QuestEventType;
  userId: string;
  questId: string;
  participationId?: string;
  occurrenceKey?: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
}

// ─── Filter types for list queries ───────────────────────────────────────────
export interface QuestListFilter {
  questType?: QuestType;
  difficulty?: Difficulty;
  categoryId?: string;
  indoor_outdoor?: IndoorOutdoor;
  locationAvailable?: boolean;
  hasActiveParticipation?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GeoFilter {
  /** Approximate user position for distance-aware sorting */
  userLat?: number;
  userLng?: number;
  /** Maximum radius in meters for location-based availability */
  radiusMeters?: number;
}
