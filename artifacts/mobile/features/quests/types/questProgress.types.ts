/**
 * Quest Progress Domain Types — Worlds
 *
 * App-level types for the Quest Progress experience: leaderboards, In Action,
 * Completed history, proof history, and point history.
 *
 * Rules:
 * - Never expose internal review notes, reviewer identity, or moderation payloads.
 * - Never expose precise geofence geometry.
 * - Proof is private to the owner; only the owner may see their own proof summary.
 * - Points are only shown after server confirmation (awarded_points from participation).
 */

import type {
  ParticipationStatus,
  ProofSubmissionStatus,
  QuestType,
  Difficulty,
  ProofType,
} from '@/lib/supabase/database.types';

// ─── Leaderboard types ────────────────────────────────────────────────────────

/** Period for leaderboard queries.
 *  Weeks start Monday UTC. Months start the 1st UTC. */
export type LeaderboardPeriod = 'week' | 'month' | 'all_time';

/** Leaderboard source type — Quest only in this prompt. */
export type LeaderboardScope = 'quest';

/** A single leaderboard entry returned by the RPC. */
export interface QuestLeaderboardEntry {
  rank: number;
  userId: string | null;       // null for anonymous entries
  displayName: string;
  username: string | null;     // null for anonymous entries
  avatarPath: string | null;
  points: number;
  isCurrentUser: boolean;
  isAnonymous: boolean;
}

/** Paginated result of the leaderboard RPC. */
export interface QuestLeaderboardPage {
  entries: QuestLeaderboardEntry[];
  period: LeaderboardPeriod;
  page: number;
  hasMore: boolean;
}

/** Current user's rank and qualifying stats for a period. */
export interface QuestCurrentRank {
  qualifies: boolean;
  rank: number | null;        // null if user has no qualifying points
  points: number;
  totalRankedUsers: number;
  period: LeaderboardPeriod;
}

// ─── Progress section ─────────────────────────────────────────────────────────

export type ProgressSection = 'leaderboards' | 'in_action' | 'completed';

// ─── In Action types ──────────────────────────────────────────────────────────

/** Participation statuses that belong in the In Action section. */
export const IN_ACTION_STATUSES: ParticipationStatus[] = [
  'started',
  'in_progress',
  'awaiting_proof',
  'under_review',
  'needs_resubmission',
  'rejected',
];

/** Statuses for the Other Activity (archived) section. */
export const OTHER_ACTIVITY_STATUSES: ParticipationStatus[] = [
  'abandoned',
  'expired',
  'rejected', // final rejection with no resubmission path
];

/** Priority rank for In Action grouping (highest = most urgent). */
export const IN_ACTION_GROUP_PRIORITY: Record<string, number> = {
  needs_resubmission: 50,
  awaiting_proof:     40,
  in_progress:        30,
  started:            20,
  under_review:       10,
  rejected:            0,
};

/** Quest data embedded in a progress item (safe public fields only). */
export interface InActionQuestMeta {
  id: string;
  title: string;
  quest_type: QuestType;
  difficulty: Difficulty;
  points_reward: number;
  proof_type: ProofType;
  completion_mode: 'auto' | 'manual_review';
}

/** A single In Action participation item (for all active/proof states). */
export interface InActionItem {
  participationId: string;
  questId: string;
  status: ParticipationStatus;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  rewardSnapshotPoints: number | null;
  occurrenceKey: string | null;
  quest: InActionQuestMeta | null;
  /** Safe user-visible note (only for needs_resubmission). Never the raw review_notes. */
  safeReviewNote: string | null;
  /** Latest proof submission status, if any. */
  latestProofStatus: ProofSubmissionStatus | null;
}

/** Summary counts for the In Action section header. */
export interface InActionSummary {
  totalActive: number;
  awaitingProof: number;
  underReview: number;
  needsResubmission: number;
  hasExpiringToday: boolean;
}

// ─── Completed types ──────────────────────────────────────────────────────────

/** A single completed quest history row. */
export interface CompletedQuestItem {
  participationId: string;
  questId: string;
  completedAt: string;
  awardedPoints: number | null;
  rewardSnapshotPoints: number | null;
  occurrenceKey: string | null;
  quest: {
    title: string;
    quest_type: QuestType;
    difficulty: Difficulty;
    slug: string;
  } | null;
}

/** Filter options for the Completed section. */
export interface CompletedFilter {
  questType: QuestType | 'all';
  sortOrder: 'newest' | 'oldest' | 'highest_points';
}

export const DEFAULT_COMPLETED_FILTER: CompletedFilter = {
  questType: 'all',
  sortOrder: 'newest',
};

// ─── Completion detail types ───────────────────────────────────────────────────

/** Full detail for a single completed participation. */
export interface CompletionDetail {
  participationId: string;
  questId: string;
  completedAt: string;
  awardedPoints: number | null;
  rewardSnapshotPoints: number | null;
  occurrenceKey: string | null;
  quest: {
    title: string;
    summary: string;
    quest_type: QuestType;
    difficulty: Difficulty;
    proof_type: ProofType;
    completion_mode: 'auto' | 'manual_review';
    is_repeatable: boolean;
    slug: string;
  } | null;
  /** Step progress for completed objectives. */
  completedSteps: CompletedStepSummary[];
  /** Latest approved proof summary (owner-only). */
  proofSummary: ProofSummary | null;
  /** Whether a reversal has occurred for the awarded points. */
  hasReversal: boolean;
}

export interface CompletedStepSummary {
  stepId: string;
  title: string;
  instructions: string;
  isRequired: boolean;
  completedAt: string | null;
}

export interface ProofSummary {
  submissionId: string;
  status: ProofSubmissionStatus;
  submittedAt: string | null;
  submissionType: ProofType;
  /** Owner's own text response. Safe to display. */
  textResponse: string | null;
  /** Whether a location was provided. Never exposes coordinates. */
  locationVerified: boolean;
  /** Whether an image was submitted. Signed URL access handled separately. */
  hasImage: boolean;
}

// ─── Other Activity (archived) types ─────────────────────────────────────────

/** A single archived participation (abandoned, expired, or final rejection). */
export interface OtherActivityItem {
  participationId: string;
  questId: string;
  status: ParticipationStatus;
  startedAt: string;
  /** Date the participation reached its final state. */
  finalizedAt: string | null;
  occurrenceKey: string | null;
  quest: {
    title: string;
    quest_type: QuestType;
    slug: string;
    is_repeatable: boolean;
  } | null;
  /** Whether the user can restart the quest. Determined by is_repeatable and status. */
  canRestart: boolean;
}

/** Full detail for an archived participation. */
export interface OtherActivityDetail extends OtherActivityItem {
  completedSteps: CompletedStepSummary[];
  /** Safe explanation for why points were not awarded. */
  noPointsReason: string;
}

// ─── Submission history types ─────────────────────────────────────────────────

/** A single proof submission history entry (owner-only). */
export interface SubmissionHistoryItem {
  submissionId: string;
  submissionNumber: number;  // 1-indexed position in submission history
  participationId: string;
  status: ProofSubmissionStatus;
  submittedAt: string | null;
  submissionType: ProofType;
  textResponse: string | null;
  locationVerified: boolean;
  hasImage: boolean;
  /** Safe user-visible review response. Never the raw reviewer notes. */
  safeDecisionNote: string | null;
  isLatest: boolean;
}

// ─── Point history types ──────────────────────────────────────────────────────

/** A quest-related point ledger transaction (owner-only). */
export interface QuestPointTransaction {
  id: string;
  amount: number;
  transactionType: 'quest_reward' | 'reversal' | 'admin_adjustment';
  /** Safe label for display. Never the raw reason field. */
  displayLabel: string;
  questParticipationId: string | null;
  /** Quest title, if resolvable. */
  questTitle: string | null;
  createdAt: string;
  /** Whether this transaction was reversed by another entry. */
  isReversed: boolean;
  /** Whether this is the reversal of another transaction. */
  isReversal: boolean;
  /** Reference ID of the original transaction being reversed (if this is a reversal). */
  reversedTransactionId: string | null;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface ProgressPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const PROGRESS_PAGE_SIZE = 20;
export const LEADERBOARD_PAGE_SIZE = 50;

// ─── Streak (prepared, not yet displayed) ────────────────────────────────────

/**
 * Quest completion streak summary.
 *
 * Streak rule (when implemented): consecutive calendar days (UTC) on which
 * the user completed at least one Quest. Must be confirmed by server-side
 * ledger; never calculated client-side.
 *
 * Hidden until backend provides authoritative streak data.
 */
export interface QuestStreakSummary {
  currentStreak: number | null;
  longestStreak: number | null;
  lastCompletionDate: string | null;
  /** True only when the backend confirms streak data is available and accurate. */
  isAvailable: boolean;
}
