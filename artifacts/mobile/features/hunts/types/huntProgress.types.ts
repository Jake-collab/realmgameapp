/**
 * Hunt Progress Domain Types — Worlds (Prompt 14)
 *
 * App-level types for the Hunt Progress experience:
 *   Leaderboards | In Action | Completed | Other Activity
 *   Stop History | Submission History | Point History
 *
 * Rules:
 * - No private validation geometry (geofence coords/radius)
 * - No reviewer identity or raw review_notes
 * - No locked clue content
 * - Points only shown after server confirmation
 * - Proof remains owner-private
 * - Do NOT mix Hunt and Quest point totals
 */

import type { ParticipantStatus, StopCompletionMethod } from './hunt.types';

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/** Time period for Hunt leaderboard. Week starts Monday UTC. */
export type LeaderboardPeriod = 'week' | 'month' | 'all_time';

/** Single Hunt leaderboard entry. */
export interface HuntLeaderboardEntry {
  rank: number;
  /** null for anonymous entries — do not display or profile */
  userId: string | null;
  displayName: string;
  username: string | null;
  avatarPath: string | null;
  huntPoints: number;
  huntsCompleted: number;
  isCurrentUser: boolean;
  isAnonymous: boolean;
}

/** Paginated result from the Hunt leaderboard RPC. */
export interface HuntLeaderboardPage {
  entries: HuntLeaderboardEntry[];
  period: LeaderboardPeriod;
  page: number;
  hasMore: boolean;
}

/** Current user's Hunt rank and qualifying stats. */
export interface HuntCurrentRank {
  qualifies: boolean;
  rank: number | null;
  points: number;
  totalRankedUsers: number;
  period: LeaderboardPeriod;
  visibilityMode: 'visible' | 'anonymous' | 'hidden';
  noRankReason: string | null;
}

// ─── Progress section ─────────────────────────────────────────────────────────

export type HuntProgressSection = 'leaderboards' | 'in_action' | 'completed';

// ─── In Action ────────────────────────────────────────────────────────────────

/**
 * Priority rank for In Action groups (higher = more urgent).
 * Mapped from server stop-level status.
 */
export const HUNT_IN_ACTION_PRIORITY: Record<string, number> = {
  needs_resubmission:  60,  // most urgent
  awaiting_proof:      50,
  active_proof_ready:  40,  // active hunt with ready-to-submit draft
  active:              30,
  under_review:        20,
  rejected_final:      10,  // final rejection needing acknowledgment
  ready_starting_soon: 10,
  paused:               5,
};

/** Participation statuses shown in the In Action section. */
export const HUNT_IN_ACTION_STATUSES: ParticipantStatus[] = [
  'active',
  'paused',
];

/** Participation statuses shown in the Other Activity section. */
export const HUNT_OTHER_ACTIVITY_STATUSES: ParticipantStatus[] = [
  'withdrawn',
  'removed',
  'cancelled',
  'expired',
];

/** A single In Action Hunt card entry. */
export interface HuntInActionItem {
  participationId: string;
  huntId: string;
  huntTitle: string;
  occurrenceId: string | null;
  status: ParticipantStatus;
  startedAt: string | null;
  completionDeadline: string | null;
  awardedPoints: number | null;
  rewardSnapshot: HuntRewardInfo | null;
  stopsCompleted: number;
  stopsRequired: number;
  /** Most urgent pending stop for this hunt */
  pendingStop: HuntInActionStop | null;
}

/** Pending stop summary within an In Action card. */
export interface HuntInActionStop {
  stopId: string;
  stopTitle: string;
  stopStatus: string;
  /** Safe user-facing review explanation — never raw review_notes */
  safeReviewNote: string | null;
  lastSubmittedAt: string | null;
}

/** Compact reward info extracted from reward_snapshot. */
export interface HuntRewardInfo {
  pointsReward: number;
}

/** Summary counts shown at the top of In Action. */
export interface HuntInActionSummary {
  activeHunts: number;
  stopsUnderReview: number;
  stopsNeedingResubmission: number;
  stopsAwaitingProof: number;
  hasApproachingDeadline: boolean;
  earliestDeadline: string | null;
}

// ─── Completed ────────────────────────────────────────────────────────────────

/** Filter options for the Completed section. */
export interface HuntCompletedFilter {
  mode: 'all' | 'solo' | 'group' | 'ordered' | 'unordered';
  sortOrder: 'newest' | 'oldest' | 'highest_points' | 'most_stops';
}

export const DEFAULT_HUNT_COMPLETED_FILTER: HuntCompletedFilter = {
  mode: 'all',
  sortOrder: 'newest',
};

/** A single completed Hunt history row. */
export interface CompletedHuntItem {
  participationId: string;
  huntId: string;
  huntTitle: string;
  occurrenceId: string | null;
  occurrenceLabel: string | null;
  completedAt: string;
  awardedPoints: number | null;
  rewardSnapshot: HuntRewardInfo | null;
  stopsCompleted: number;
  optionalCompleted: number;
  stopsRequired: number;
  isGroup: boolean;
  stopOrdering: 'ordered' | 'unordered' | null;
}

// ─── Completion detail ────────────────────────────────────────────────────────

/** Full completion detail for a single Hunt participation. */
export interface HuntCompletionDetail {
  participationId: string;
  huntId: string;
  huntTitle: string;
  huntSummary: string | null;
  occurrenceId: string | null;
  occurrenceLabel: string | null;
  completedAt: string;
  startedAt: string | null;
  awardedPoints: number | null;
  rewardSnapshot: HuntRewardInfo | null;
  hasReversal: boolean;
  isGroup: boolean;
  participationMode: string;
  stopOrdering: string;
  stopsRequired: number;
  stopsCompleted: number;
  optionalCompleted: number;
  groupMemberCount: number;
}

/** Stop history entry within Completion Detail. */
export interface HuntStopHistoryEntry {
  stopProgressId: string;
  huntStopId: string;
  stopTitle: string;
  stopNumber: number | null;
  isRequired: boolean;
  stopStatus: string;
  completionMethod: StopCompletionMethod | null;
  completedAt: string | null;
  /** Proof summary — safe fields only */
  proofStatus: string | null;
  proofType: string | null;
  hasTextResponse: boolean;
  hasImage: boolean;
  locationVerified: boolean;
  proofApprovedAt: string | null;
}

// ─── Submission history ───────────────────────────────────────────────────────

/** A single proof submission history entry (owner-only). */
export interface HuntSubmissionHistoryItem {
  submissionId: string;
  stopProgressId: string;
  huntStopId: string;
  stopTitle: string;
  submissionNumber: number;
  status: string;
  submittedAt: string | null;
  submissionType: string;
  hasTextResponse: boolean;
  hasImage: boolean;
  locationVerified: boolean;
  /** Safe user-visible explanation. Never exposes reviewer identity or raw notes. */
  safeReviewExplanation: string | null;
  isLatest: boolean;
  previousSubmissionId: string | null;
}

// ─── Point history ────────────────────────────────────────────────────────────

/** A single Hunt-related point ledger row (owner-only). */
export interface HuntPointTransaction {
  ledgerId: string;
  amount: number;
  transactionType: 'hunt_reward' | 'reversal' | 'admin_adjustment';
  /** Safe display label. Never raw reason field. */
  displayLabel: string;
  huntParticipationId: string | null;
  huntTitle: string | null;
  createdAt: string;
  /** True when this transaction has been reversed (a reversal entry exists). */
  isReversed: boolean;
  /** True when this is the reversal of another transaction. */
  isReversal: boolean;
  reversedLedgerId: string | null;
}

// ─── Other Activity ───────────────────────────────────────────────────────────

/** A single archived Hunt participation (withdrawn/removed/cancelled/expired). */
export interface HuntOtherActivityItem {
  participationId: string;
  huntId: string;
  huntTitle: string;
  status: ParticipantStatus;
  joinedAt: string | null;
  startedAt: string | null;
  finalizedAt: string | null;
  stopsCompleted: number;
  stopsRequired: number;
  awardedPoints: number;
  /** Safe user-facing explanation — no internal removal reasons */
  safeStatusNote: string;
}

// ─── Progress summary ────────────────────────────────────────────────────────

/** Compact personal Hunt progress summary (shown at top of progress screen). */
export interface HuntProgressSummary {
  totalHuntPoints: number;
  huntsCompleted: number;
  activeHunts: number;
  readyHunts: number;
  proofUnderReview: number;
  stopsNeedingResubmission: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface HuntProgressPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const HUNT_PROGRESS_PAGE_SIZE = 20;
export const HUNT_LEADERBOARD_PAGE_SIZE = 50;

// ─── Default section selection ────────────────────────────────────────────────

/**
 * Determines which section to show by default on mount.
 *
 * Priority (highest first):
 * 1. In Action when needs_resubmission stop exists
 * 2. In Action when awaiting_proof stop exists
 * 3. In Action when active hunt exists
 * 4. In Action when under_review stop exists
 * 5. In Action when ready hunt is approaching start
 * 6. Completed when arriving from a newly-completed hunt
 * 7. Last stored section
 * 8. Leaderboards (default)
 */
export function resolveDefaultHuntProgressSection(
  inActionSummary: HuntInActionSummary | null,
  arrivedFromCompletion: boolean,
  lastSection: HuntProgressSection | null,
): HuntProgressSection {
  if (inActionSummary) {
    if (inActionSummary.stopsNeedingResubmission > 0) return 'in_action';
    if (inActionSummary.stopsAwaitingProof > 0)       return 'in_action';
    if (inActionSummary.activeHunts > 0)              return 'in_action';
    if (inActionSummary.stopsUnderReview > 0)         return 'in_action';
  }
  if (arrivedFromCompletion) return 'completed';
  if (lastSection)           return lastSection;
  return 'leaderboards';
}
