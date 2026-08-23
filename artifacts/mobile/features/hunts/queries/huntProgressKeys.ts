/**
 * Hunt Progress Query Keys — Worlds (Prompt 14)
 *
 * Centralized React Query key factory for all Hunt Progress queries.
 * Separate from huntKeys to keep Progress caches distinct from hunt-browse caches.
 *
 * Rules:
 * - Do NOT mix with Quest progress keys (namespace: 'hunt-progress')
 * - All user-scoped keys include userId
 * - Leaderboard keys include period
 * - Filter objects must be JSON-serializable (no functions)
 * - Deep-screen keys (completion-detail, stop-history, etc.) use participationId
 */

import type { LeaderboardPeriod, HuntCompletedFilter } from '../types/huntProgress.types';

export const huntProgressKeys = {
  /** Root — invalidates all Hunt Progress queries */
  all: ['hunt-progress'] as const,

  // ── Summary ───────────────────────────────────────────────────────────────

  summary: (userId: string) =>
    [...huntProgressKeys.all, 'summary', userId] as const,

  // ── In Action ─────────────────────────────────────────────────────────────

  inAction: (userId: string) =>
    [...huntProgressKeys.all, 'in-action', userId] as const,

  // ── Completed ─────────────────────────────────────────────────────────────

  completed: (userId: string, filter?: HuntCompletedFilter) =>
    [...huntProgressKeys.all, 'completed', userId, filter ?? null] as const,

  // ── Completion Detail ─────────────────────────────────────────────────────

  completionDetail: (participationId: string) =>
    [...huntProgressKeys.all, 'completion-detail', participationId] as const,

  // ── Stop History ──────────────────────────────────────────────────────────

  stopHistory: (participationId: string) =>
    [...huntProgressKeys.all, 'stop-history', participationId] as const,

  // ── Submission History ────────────────────────────────────────────────────

  submissionHistory: (participationId: string) =>
    [...huntProgressKeys.all, 'submission-history', participationId] as const,

  // ── Point History ─────────────────────────────────────────────────────────

  pointHistory: (userId: string) =>
    [...huntProgressKeys.all, 'point-history', userId] as const,

  // ── Other Activity ────────────────────────────────────────────────────────

  otherActivity: (userId: string) =>
    [...huntProgressKeys.all, 'other-activity', userId] as const,

  // ── Leaderboard ───────────────────────────────────────────────────────────

  leaderboard: (period: LeaderboardPeriod, page: number) =>
    [...huntProgressKeys.all, 'leaderboard', period, page] as const,

  currentRank: (userId: string, period: LeaderboardPeriod) =>
    [...huntProgressKeys.all, 'current-rank', userId, period] as const,

} as const;

// ─── Invalidation helpers ─────────────────────────────────────────────────────

/** Keys to invalidate after proof submission or decision. */
export function getHuntProofDecisionInvalidationKeys(
  userId: string,
  period: LeaderboardPeriod,
  participationId?: string,
) {
  const keys: Array<readonly unknown[]> = [
    huntProgressKeys.inAction(userId),
    huntProgressKeys.completed(userId),
    huntProgressKeys.pointHistory(userId),
    huntProgressKeys.leaderboard(period, 1),
    huntProgressKeys.currentRank(userId, period),
    huntProgressKeys.summary(userId),
  ];
  if (participationId) {
    keys.push(
      huntProgressKeys.submissionHistory(participationId),
      huntProgressKeys.completionDetail(participationId),
    );
  }
  return keys;
}

/** Keys to invalidate after a stop is completed. */
export function getHuntStopCompleteInvalidationKeys(
  userId: string,
  participationId: string,
) {
  return [
    huntProgressKeys.inAction(userId),
    huntProgressKeys.stopHistory(participationId),
    huntProgressKeys.completionDetail(participationId),
    huntProgressKeys.summary(userId),
  ];
}

/** Keys to invalidate after hunt completion. */
export function getHuntCompletionInvalidationKeys(
  userId: string,
  participationId: string,
  period: LeaderboardPeriod,
) {
  return [
    huntProgressKeys.inAction(userId),
    huntProgressKeys.completed(userId),
    huntProgressKeys.completionDetail(participationId),
    huntProgressKeys.stopHistory(participationId),
    huntProgressKeys.pointHistory(userId),
    huntProgressKeys.summary(userId),
    huntProgressKeys.leaderboard(period, 1),
    huntProgressKeys.currentRank(userId, period),
  ];
}

/** Keys to invalidate after a reward reversal. */
export function getHuntReversalInvalidationKeys(
  userId: string,
  participationId: string,
  period: LeaderboardPeriod,
) {
  return [
    huntProgressKeys.pointHistory(userId),
    huntProgressKeys.completionDetail(participationId),
    huntProgressKeys.summary(userId),
    huntProgressKeys.leaderboard(period, 1),
    huntProgressKeys.currentRank(userId, period),
  ];
}
