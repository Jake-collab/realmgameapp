/**
 * Progression Repository — Worlds (Prompt 15)
 *
 * Data access for the shared progression layer via SECURITY DEFINER RPCs:
 *   - My Achievements (by category)
 *   - Achievement History (paginated)
 *   - My Titles + set active title
 *   - My Badges
 *   - My Milestones
 *   - Combined Statistics
 *   - Progress Overview
 *
 * Rules:
 * - Never expose rule_key or internal engine expressions to the UI layer.
 * - All writes (title selection) go through server RPCs.
 * - Statistics are always server-computed.
 * - No Quest/Hunt gameplay logic here.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/supabase/helpers';
import type {
  UserAchievement,
  AchievementHistoryRow,
  UserTitle,
  UserBadge,
  UserMilestone,
  CombinedStatistics,
  ProgressOverview,
  AchievementCategory,
} from '../types/progression.types';
import { ACHIEVEMENT_PAGE_SIZE } from '../types/progression.types';

// ─── Achievements ─────────────────────────────────────────────────────────────

/**
 * Fetch the current user's unlocked achievements.
 * Optionally filtered by category.
 * Requirement details are summarised — raw rule expressions never returned.
 */
export async function fetchMyAchievements(
  userId: string,
  category?: AchievementCategory,
): Promise<UserAchievement[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any).rpc('get_my_achievements', {
    p_user_id: userId,
    p_category: category ?? null,
  });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): UserAchievement => ({
    achievementId:       row.achievement_id,
    slug:                row.slug,
    name:                row.name,
    subtitle:            row.subtitle ?? null,
    description:         row.description,
    category:            row.category as AchievementCategory,
    iconName:            row.icon_name ?? 'award',
    artworkUrl:          row.artwork_url ?? null,
    isHidden:            Boolean(row.is_hidden),
    isSecret:            Boolean(row.is_secret),
    isManual:            Boolean(row.is_manual),
    displayPriority:     Number(row.display_priority ?? 100),
    awardedAt:           row.awarded_at,
    awardedBy:           (row.awarded_by as any) ?? 'engine',
    triggerEvent:        row.trigger_event ?? null,
    // Summarise requirement without exposing rule_key
    requirementSummary: buildRequirementSummary(row),
  }));
}

function buildRequirementSummary(row: any): string | null {
  if (!row.rule_key || !row.rule_threshold) return null;
  const threshold = row.rule_threshold;
  const mode = row.rule_mode;
  switch (row.rule_key) {
    case 'quests_completed':    return `Complete ${threshold} Quest${threshold !== 1 ? 's' : ''}`;
    case 'hunts_completed':     return `Complete ${threshold} Hunt${threshold !== 1 ? 's' : ''}`;
    case 'total_activities':    return `Complete ${threshold} total Quest${threshold !== 1 ? 's' : ''} or Hunt${threshold !== 1 ? 's' : ''}`;
    case 'combined_points':     return `Earn ${threshold.toLocaleString()} combined Worlds points`;
    case 'quest_points':        return `Earn ${threshold.toLocaleString()} Quest points`;
    case 'hunt_points':         return `Earn ${threshold.toLocaleString()} Hunt points`;
    case 'both_modes_completed':return 'Complete at least one Quest and one Hunt';
    case 'perfect_hunt':        return 'Complete a Hunt with all stops, no resubmissions';
    case 'daily_streak':        return `Complete a Quest or Hunt every day for ${threshold} day${threshold !== 1 ? 's' : ''}`;
    default:                    return null;
  }
}

// ─── Achievement History ──────────────────────────────────────────────────────

export async function fetchAchievementHistory(
  userId: string,
  page = 1,
  pageSize = ACHIEVEMENT_PAGE_SIZE,
): Promise<{ items: AchievementHistoryRow[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const offset = (page - 1) * pageSize;

  const { data, error } = await (client as any).rpc('get_achievement_history', {
    p_user_id: userId,
    p_limit:   pageSize + 1,
    p_offset:  offset,
  });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const items = (data as any[]).slice(0, pageSize).map((row): AchievementHistoryRow => ({
    achievementId: row.achievement_id,
    slug:          row.slug,
    name:          row.name,
    description:   row.description,
    category:      row.category as AchievementCategory,
    iconName:      row.icon_name ?? 'award',
    isHidden:      Boolean(row.is_hidden),
    awardedAt:     row.awarded_at,
    triggerEvent:  row.trigger_event ?? null,
  }));

  return { items, hasMore };
}

// ─── Titles ───────────────────────────────────────────────────────────────────

export async function fetchMyTitles(userId: string): Promise<UserTitle[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any).rpc('get_my_titles', { p_user_id: userId });
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): UserTitle => ({
    titleId:         row.title_id,
    slug:            row.slug,
    name:            row.name,
    description:     row.description,
    unlockSource:    row.unlock_source as any,
    displayPriority: Number(row.display_priority ?? 100),
    unlockedAt:      row.unlocked_at,
    isActive:        Boolean(row.is_active),
  }));
}

/** Atomically set the user's active title. Returns updated title list. */
export async function setActiveTitle(
  userId: string,
  titleId: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await (client as any).rpc('set_active_title', {
    p_user_id: userId,
    p_title_id: titleId,
  });
  if (error) throw normalizeError(error);
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export async function fetchMyBadges(userId: string): Promise<UserBadge[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any).rpc('get_my_badges', { p_user_id: userId });
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): UserBadge => ({
    badgeId:         row.badge_id,
    slug:            row.slug,
    name:            row.name,
    description:     row.description,
    iconName:        row.icon_name ?? 'shield',
    artworkUrl:      row.artwork_url ?? null,
    category:        row.category ?? 'general',
    displayPriority: Number(row.display_priority ?? 100),
    unlockedAt:      row.unlocked_at,
    isPinned:        Boolean(row.is_pinned),
  }));
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export async function fetchMyMilestones(userId: string): Promise<UserMilestone[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any).rpc('get_my_milestones', { p_user_id: userId });
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): UserMilestone => ({
    milestoneId:  row.milestone_id,
    slug:         row.slug,
    name:         row.name,
    description:  row.description,
    category:     row.category as any,
    metricKey:    row.metric_key,
    threshold:    Number(row.threshold ?? 0),
    reachedAt:    row.reached_at,
    valueAtAward: Number(row.value_at_award ?? 0),
  }));
}

// ─── Combined Statistics ──────────────────────────────────────────────────────

export async function fetchCombinedStatistics(
  userId: string,
): Promise<CombinedStatistics | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data, error } = await (client as any).rpc('get_combined_statistics', {
    p_user_id: userId,
  });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as any;
  return {
    questsCompleted:      Number(row.quests_completed ?? 0),
    huntsCompleted:       Number(row.hunts_completed ?? 0),
    totalActivities:      Number(row.total_activities ?? 0),
    questPoints:          Number(row.quest_points ?? 0),
    huntPoints:           Number(row.hunt_points ?? 0),
    combinedPoints:       Number(row.combined_points ?? 0),
    achievementsUnlocked: Number(row.achievements_unlocked ?? 0),
    titlesUnlocked:       Number(row.titles_unlocked ?? 0),
    badgesUnlocked:       Number(row.badges_unlocked ?? 0),
    accountAgeDays:       Number(row.account_age_days ?? 0),
  };
}

// ─── Progress Overview ────────────────────────────────────────────────────────

export async function fetchProgressOverview(
  userId: string,
): Promise<ProgressOverview | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data, error } = await (client as any).rpc('get_progress_overview', {
    p_user_id: userId,
  });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as any;
  return {
    activeTitleName:   row.active_title_name ?? null,
    activeTitleSlug:   row.active_title_slug ?? null,
    pinnedBadgeName:   row.pinned_badge_name ?? null,
    pinnedBadgeIcon:   row.pinned_badge_icon ?? null,
    achievementsCount: Number(row.achievements_count ?? 0),
    combinedPoints:    Number(row.combined_points ?? 0),
    totalActivities:   Number(row.total_activities ?? 0),
  };
}
