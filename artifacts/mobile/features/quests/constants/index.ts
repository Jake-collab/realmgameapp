/**
 * Quest Domain Constants — Worlds
 *
 * Centralized constants for quest business rules.
 * Never hard-code these values in components or services.
 */

// ─── Default expiration behavior ─────────────────────────────────────────────
/**
 * Build 1 default: active participants may finish even after quest content expires.
 * Hard expiration (immediate cutoff) must be explicitly configured per-quest.
 */
export const DEFAULT_EXPIRATION_BEHAVIOR = 'started_users_may_finish' as const;

// ─── Default completion mode ──────────────────────────────────────────────────
/** Build 1 default: proof required and manually reviewed */
export const DEFAULT_COMPLETION_MODE = 'manual_review' as const;

// ─── Occurrence key formats ───────────────────────────────────────────────────
/** Format: daily:{quest-slug}:{YYYY-MM-DD} */
export const DAILY_OCCURRENCE_FORMAT = 'daily:{slug}:{date}';
/** Format: monthly:{quest-slug}:{YYYY-MM} */
export const MONTHLY_OCCURRENCE_FORMAT = 'monthly:{slug}:{yearMonth}';
/** Format: geo:{quest-slug} (geo quests typically have a single occurrence unless repeatable) */
export const GEO_OCCURRENCE_FORMAT = 'geo:{slug}';

// ─── Participation expiration defaults ────────────────────────────────────────
/** Daily quest: participation expires after 24 hours of inactivity */
export const DAILY_QUEST_PARTICIPATION_EXPIRY_HOURS = 24;
/** Monthly quest: participation expires with the monthly window */
export const MONTHLY_QUEST_PARTICIPATION_EXPIRY_DAYS = 31;
/** Geo quest: participation deadline — 7 days after start (configurable) */
export const GEO_QUEST_PARTICIPATION_EXPIRY_DAYS = 7;

// ─── Cooldown limits ──────────────────────────────────────────────────────────
/** Maximum repeat cooldown allowed (30 days) */
export const MAX_REPEAT_COOLDOWN_HOURS = 30 * 24;

// ─── Point constraints ────────────────────────────────────────────────────────
export const MIN_QUEST_POINTS = 1;
export const MAX_QUEST_POINTS = 10000;

// ─── Proof constraints ────────────────────────────────────────────────────────
export const MAX_PROOF_IMAGES = 10;
export const MAX_PROOF_TEXT_LENGTH = 2000;
export const MIN_PROOF_TEXT_LENGTH = 10;
export const MAX_RESUBMISSIONS = 3;

// ─── Daily selection ─────────────────────────────────────────────────────────
/**
 * Build 1 daily quest selection priority order.
 * Used by questSelection.service.ts.
 */
export const DAILY_SELECTION_CRITERIA = [
  'home_priority',         // highest admin priority first
  'interest_match',        // matching user interests
  'not_recently_completed', // not done in last 30 days
  'difficulty_match',      // medium difficulty first
  'sort_by_available_from', // most recently published
] as const;

// ─── Idempotency key formats ──────────────────────────────────────────────────
/**
 * Format for quest completion idempotency keys in points_ledger.
 * Example: quest_completion:part-uuid-here:user-uuid-here
 */
export const QUEST_COMPLETION_IDEMPOTENCY_FORMAT = 'quest_completion:{participationId}';

// ─── State machine: allowed participation status transitions ──────────────────
/**
 * Only these transitions are permitted. Any attempt to move to a status
 * not in the allowed list for the current status is rejected.
 */
export const PARTICIPATION_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  started:             ['in_progress', 'awaiting_proof', 'abandoned', 'expired'],
  in_progress:         ['awaiting_proof', 'abandoned', 'expired'],
  awaiting_proof:      ['under_review', 'abandoned', 'expired'],
  under_review:        ['completed', 'rejected', 'needs_resubmission'],
  needs_resubmission:  ['under_review', 'abandoned'],
  // Terminal states — no transitions out
  completed:           [],
  rejected:            [],
  abandoned:           [],
  expired:             [],
};

// ─── State machine: allowed proof status transitions ──────────────────────────
export const PROOF_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:               ['uploading', 'submitted'],
  uploading:           ['draft', 'submitted'],
  submitted:           ['under_review'],
  under_review:        ['approved', 'rejected', 'needs_resubmission'],
  needs_resubmission:  ['submitted'],
  // Terminal states
  approved:            [],
  rejected:            [],
};

// ─── State machine: allowed quest content status transitions ──────────────────
export const QUEST_CONTENT_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:          ['pending_review', 'rejected'],
  pending_review: ['approved', 'rejected'],
  approved:       ['scheduled', 'published', 'rejected'],
  scheduled:      ['published', 'paused', 'archived'],
  published:      ['paused', 'expired', 'archived'],
  paused:         ['published', 'archived'],
  expired:        ['archived'],
  rejected:       ['draft'],
  archived:       [], // terminal
};

// ─── Trusted-only transitions (require server/admin role) ─────────────────────
/**
 * These participation status transitions may ONLY be set by trusted server logic.
 * The mobile client may never request these directly.
 */
export const TRUSTED_ONLY_PARTICIPATION_TRANSITIONS = new Set([
  'completed',
  'rejected',
]);

/**
 * These proof status transitions may ONLY be set by trusted reviewers.
 */
export const TRUSTED_ONLY_PROOF_TRANSITIONS = new Set([
  'approved',
  'rejected',
  'needs_resubmission',
]);

// ─── Home screen selection config ────────────────────────────────────────────
/**
 * Priority order for the home screen's "active quest" panel.
 * The first matching condition wins.
 */
export const HOME_ACTIVE_QUEST_PRIORITY = [
  'NEEDS_RESUBMISSION',  // resubmission requested — most urgent
  'ACTIVE_IMMEDIATE',    // started or in_progress
  'UNDER_REVIEW',        // submitted, waiting
  'AWAITING_PROOF',      // user must act
  'MOST_RECENT_ACTIVE',  // fallback: most recently touched
] as const;
