/**
 * Progression Domain Types — Worlds (Prompt 15)
 *
 * Covers the shared progression layer:
 *   Achievements | Milestones | Titles | Badges | Statistics | Overview
 *
 * Rules:
 * - No internal rule expressions exposed to client (rule_key used for engine only)
 * - Hidden achievements show as ??? until unlocked
 * - Secret achievement requirements never revealed
 * - Titles and badges require server-verified unlock
 * - Statistics computed server-side — never derive client-side
 * - No paid achievements, titles, or badges
 */

// ─── Achievement Categories ───────────────────────────────────────────────────

export type AchievementCategory =
  | 'quest'
  | 'hunt'
  | 'worlds'
  | 'community'
  | 'exploration'
  | 'consistency'
  | 'special';

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'quest', 'hunt', 'worlds', 'community', 'exploration', 'consistency', 'special',
];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  quest:       'Quest',
  hunt:        'Hunt',
  worlds:      'Worlds',
  community:   'Community',
  exploration: 'Exploration',
  consistency: 'Consistency',
  special:     'Special',
};

// ─── Achievement ──────────────────────────────────────────────────────────────

/**
 * A single unlocked achievement for the current user.
 * Hidden achievements are revealed in full after unlock.
 */
export interface UserAchievement {
  achievementId: string;
  slug: string;
  /** Display name — shown as "???" while locked and hidden */
  name: string;
  subtitle: string | null;
  description: string;
  category: AchievementCategory;
  /** Feather icon name */
  iconName: string;
  artworkUrl: string | null;
  isHidden: boolean;
  isSecret: boolean;
  isManual: boolean;
  displayPriority: number;
  awardedAt: string;
  awardedBy: 'engine' | 'admin' | 'system';
  triggerEvent: string | null;
  /** Never exposes raw rule expression */
  requirementSummary: string | null;
}

/** Compact achievement for history list rows. */
export interface AchievementHistoryRow {
  achievementId: string;
  slug: string;
  name: string;
  description: string;
  category: AchievementCategory;
  iconName: string;
  isHidden: boolean;
  awardedAt: string;
  triggerEvent: string | null;
}

/** Paginated achievement history. */
export interface AchievementHistoryPage {
  items: AchievementHistoryRow[];
  page: number;
  hasMore: boolean;
}

// ─── Titles ───────────────────────────────────────────────────────────────────

export interface UserTitle {
  titleId: string;
  slug: string;
  name: string;
  description: string;
  unlockSource: 'achievement' | 'milestone' | 'admin' | 'launch' | 'special';
  displayPriority: number;
  unlockedAt: string;
  isActive: boolean;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export interface UserBadge {
  badgeId: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  artworkUrl: string | null;
  category: string;
  displayPriority: number;
  unlockedAt: string;
  isPinned: boolean;
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneCategory = 'quest' | 'hunt' | 'combined' | 'points' | 'special';

export interface UserMilestone {
  milestoneId: string;
  slug: string;
  name: string;
  description: string;
  category: MilestoneCategory;
  metricKey: string;
  threshold: number;
  reachedAt: string;
  valueAtAward: number;
}

// ─── Combined Statistics ──────────────────────────────────────────────────────

/**
 * Cross-mode aggregate stats. Always server-computed — never derived on client.
 */
export interface CombinedStatistics {
  questsCompleted: number;
  huntsCompleted: number;
  totalActivities: number;
  questPoints: number;
  huntPoints: number;
  combinedPoints: number;
  achievementsUnlocked: number;
  titlesUnlocked: number;
  badgesUnlocked: number;
  accountAgeDays: number;
}

// ─── Progress Overview ────────────────────────────────────────────────────────

/** Compact summary for the Profile header. */
export interface ProgressOverview {
  activeTitleName: string | null;
  activeTitleSlug: string | null;
  pinnedBadgeName: string | null;
  pinnedBadgeIcon: string | null;
  achievementsCount: number;
  combinedPoints: number;
  totalActivities: number;
}

// ─── Progression Section ──────────────────────────────────────────────────────

export type ProgressionSection =
  | 'overview'
  | 'categories'
  | 'history'
  | 'titles'
  | 'badges'
  | 'statistics';

export const PROGRESSION_SECTIONS: { key: ProgressionSection; label: string }[] = [
  { key: 'overview',    label: 'Overview' },
  { key: 'history',     label: 'History' },
  { key: 'titles',      label: 'Titles' },
  { key: 'badges',      label: 'Badges' },
  { key: 'statistics',  label: 'Statistics' },
];

// ─── Achievement Event Types ──────────────────────────────────────────────────

export type AchievementEventType =
  | 'quest_completed'
  | 'hunt_completed'
  | 'point_milestone'
  | 'combined_milestone'
  | 'profile_updated'
  | 'account_age'
  | 'admin_action'
  | 'manual_award';

// ─── Pagination ───────────────────────────────────────────────────────────────

export const ACHIEVEMENT_PAGE_SIZE = 20;

// ─── Future Combined Leaderboard (interface only — not implemented) ───────────

/**
 * Document-only interface for the future combined leaderboard.
 * Not implemented in Prompt 15. See docs/PROGRESSION.md#future.
 */
export interface CombinedLeaderboardEntry {
  rank: number;
  userId: string | null;
  displayName: string;
  username: string | null;
  combinedPoints: number;
  questsCompleted: number;
  huntsCompleted: number;
  isCurrentUser: boolean;
  isAnonymous: boolean;
}

// ─── Privacy ──────────────────────────────────────────────────────────────────

/** Which sections of the profile the user has made visible. */
export interface ProgressionPrivacy {
  achievementsVisible: boolean;
  titlesVisible: boolean;
  badgesVisible: boolean;
  statisticsVisible: boolean;
}
