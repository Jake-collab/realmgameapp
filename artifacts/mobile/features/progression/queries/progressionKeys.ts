/**
 * Progression Query Keys — Worlds (Prompt 15)
 *
 * Centralized React Query key factory for all Progression queries.
 * Namespace: 'progression' — separate from 'hunt-progress' and quest keys.
 */

import type { AchievementCategory } from '../types/progression.types';

export const progressionKeys = {
  /** Root — invalidates all Progression queries */
  all: ['progression'] as const,

  // ── Achievements ──────────────────────────────────────────────────────────

  achievements: (userId: string, category?: AchievementCategory) =>
    [...progressionKeys.all, 'achievements', userId, category ?? null] as const,

  achievementHistory: (userId: string) =>
    [...progressionKeys.all, 'achievement-history', userId] as const,

  achievementDetail: (achievementId: string) =>
    [...progressionKeys.all, 'achievement-detail', achievementId] as const,

  // ── Titles ────────────────────────────────────────────────────────────────

  titles: (userId: string) =>
    [...progressionKeys.all, 'titles', userId] as const,

  activeTitle: (userId: string) =>
    [...progressionKeys.all, 'active-title', userId] as const,

  // ── Badges ────────────────────────────────────────────────────────────────

  badges: (userId: string) =>
    [...progressionKeys.all, 'badges', userId] as const,

  // ── Milestones ────────────────────────────────────────────────────────────

  milestones: (userId: string) =>
    [...progressionKeys.all, 'milestones', userId] as const,

  // ── Statistics ────────────────────────────────────────────────────────────

  statistics: (userId: string) =>
    [...progressionKeys.all, 'statistics', userId] as const,

  // ── Overview ──────────────────────────────────────────────────────────────

  overview: (userId: string) =>
    [...progressionKeys.all, 'overview', userId] as const,

} as const;

// ─── Invalidation helpers ─────────────────────────────────────────────────────

/**
 * Keys to invalidate when a new achievement is awarded.
 * Do NOT include Quest/Hunt gameplay keys.
 */
export function getAchievementAwardedInvalidationKeys(userId: string) {
  return [
    progressionKeys.achievements(userId),
    progressionKeys.achievementHistory(userId),
    progressionKeys.statistics(userId),
    progressionKeys.overview(userId),
    progressionKeys.milestones(userId),
    // Titles and badges may unlock alongside an achievement
    progressionKeys.titles(userId),
    progressionKeys.activeTitle(userId),
    progressionKeys.badges(userId),
  ];
}

/**
 * Keys to invalidate when the user changes their active title.
 */
export function getTitleChangeInvalidationKeys(userId: string) {
  return [
    progressionKeys.titles(userId),
    progressionKeys.activeTitle(userId),
    progressionKeys.overview(userId),
  ];
}

/**
 * Keys to invalidate when a badge is pinned.
 */
export function getBadgePinInvalidationKeys(userId: string) {
  return [
    progressionKeys.badges(userId),
    progressionKeys.overview(userId),
  ];
}
