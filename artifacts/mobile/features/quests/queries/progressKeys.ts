/**
 * Progress Query Keys — Worlds
 *
 * Centralized React Query key factory for all Quest Progress queries.
 * Separate from questKeys to keep In Action / Completed / Leaderboard caches
 * distinct from quest-browse caches.
 *
 * Rules:
 * - All progress queries must use these keys.
 * - Keys include userId so multi-account scenarios are safe.
 * - Leaderboard keys include period so period changes flush the cache.
 * - Filter objects are JSON-serializable; do not include functions.
 */

import type { LeaderboardPeriod, CompletedFilter } from '../types/questProgress.types';

export const progressKeys = {
  /** Root — invalidates all progress queries */
  all: ['quest-progress'] as const,

  // ── In Action ────────────────────────────────────────────────────────────

  inAction: (userId: string) =>
    [...progressKeys.all, 'in-action', userId] as const,

  // ── Completed ─────────────────────────────────────────────────────────────

  completed: (userId: string, filter?: CompletedFilter) =>
    [...progressKeys.all, 'completed', userId, filter ?? null] as const,

  // ── Other Activity ────────────────────────────────────────────────────────

  otherActivity: (userId: string) =>
    [...progressKeys.all, 'other-activity', userId] as const,

  // ── Completion Detail ─────────────────────────────────────────────────────

  completionDetail: (participationId: string) =>
    [...progressKeys.all, 'completion-detail', participationId] as const,

  // ── Submission History ────────────────────────────────────────────────────

  submissionHistory: (participationId: string) =>
    [...progressKeys.all, 'submission-history', participationId] as const,

  // ── Point History ─────────────────────────────────────────────────────────

  pointHistory: (userId: string) =>
    [...progressKeys.all, 'point-history', userId] as const,

  // ── Leaderboard ───────────────────────────────────────────────────────────

  leaderboard: (period: LeaderboardPeriod, page: number) =>
    [...progressKeys.all, 'leaderboard', period, page] as const,

  currentRank: (userId: string, period: LeaderboardPeriod) =>
    [...progressKeys.all, 'current-rank', userId, period] as const,

  // ── Personal Summary ──────────────────────────────────────────────────────

  summary: (userId: string) =>
    [...progressKeys.all, 'summary', userId] as const,
} as const;

// ─── Invalidation helpers ─────────────────────────────────────────────────────

/** Keys to invalidate after proof is submitted or a decision is received. */
export function getProofDecisionInvalidationKeys(userId: string, period: LeaderboardPeriod) {
  return [
    progressKeys.inAction(userId),
    progressKeys.completed(userId),
    progressKeys.pointHistory(userId),
    progressKeys.leaderboard(period, 1),
    progressKeys.currentRank(userId, period),
    progressKeys.summary(userId),
  ];
}

/** Keys to invalidate after quest completion. */
export function getQuestCompletionProgressKeys(userId: string, participationId: string) {
  return [
    progressKeys.inAction(userId),
    progressKeys.completed(userId),
    progressKeys.completionDetail(participationId),
    progressKeys.pointHistory(userId),
    progressKeys.summary(userId),
  ];
}
