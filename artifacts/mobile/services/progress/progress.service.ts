/**
 * Progress Service — Worlds
 *
 * Aggregates a user's quest and hunt progress for the Progress tab.
 * Combines data from quest_participations, hunt_participants,
 * user_achievements, and user_point_totals.
 *
 * Does NOT award points — that is server-only logic.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, queryKeys } from '@/lib/supabase/helpers';
import type {
  QuestParticipationRow,
  HuntParticipantRow,
  UserAchievementRow,
  AchievementRow,
} from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProgressSummary {
  totalPoints: number;
  globalRank: number | null;
  questsCompleted: number;
  huntsCompleted: number;
  achievementsEarned: number;
}

export interface AchievementWithDetails extends UserAchievementRow {
  achievement: AchievementRow;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Fetch a lightweight progress summary for the profile header.
 * Falls back to zeros when Supabase is not configured.
 */
export async function getProgressSummary(userId: string): Promise<UserProgressSummary> {
  if (!isSupabaseConfigured()) {
    return {
      totalPoints: 0,
      globalRank: null,
      questsCompleted: 0,
      huntsCompleted: 0,
      achievementsEarned: 0,
    };
  }

  const client = requireSupabase();

  const [pointsResult, questsResult, huntsResult, achievementsResult, rankResult] =
    await Promise.allSettled([
      client
        .from('user_point_totals')
        .select('total_points')
        .eq('user_id', userId)
        .maybeSingle(),
      client
        .from('quest_participations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),
      client
        .from('hunt_participants')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),
      client
        .from('user_achievements')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      client.rpc('get_user_rank', { p_user_id: userId }),
    ]);

  return {
    totalPoints:
      pointsResult.status === 'fulfilled' && !pointsResult.value.error
        ? (pointsResult.value.data?.total_points ?? 0)
        : 0,
    questsCompleted:
      questsResult.status === 'fulfilled' && !questsResult.value.error
        ? (questsResult.value.count ?? 0)
        : 0,
    huntsCompleted:
      huntsResult.status === 'fulfilled' && !huntsResult.value.error
        ? (huntsResult.value.count ?? 0)
        : 0,
    achievementsEarned:
      achievementsResult.status === 'fulfilled' && !achievementsResult.value.error
        ? (achievementsResult.value.count ?? 0)
        : 0,
    globalRank:
      rankResult.status === 'fulfilled' && !rankResult.value.error
        ? (rankResult.value.data as number)
        : null,
  };
}

// ─── Quests ────────────────────────────────────────────────────────────────────

export async function getCompletedQuests(userId: string): Promise<QuestParticipationRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) throw normalizeError(error);
  return data ?? [];
}

export async function getActiveQuests(userId: string): Promise<QuestParticipationRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission'])
    .order('last_progress_at', { ascending: false, nullsFirst: false });

  if (error) throw normalizeError(error);
  return data ?? [];
}

// ─── Hunts ─────────────────────────────────────────────────────────────────────

export async function getCompletedHunts(userId: string): Promise<HuntParticipantRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_participants')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) throw normalizeError(error);
  return data ?? [];
}

// ─── Achievements ──────────────────────────────────────────────────────────────

export async function getMyAchievements(userId: string): Promise<AchievementWithDetails[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_achievements')
    .select(`
      *,
      achievement:achievements(*)
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []) as AchievementWithDetails[];
}

export async function getAllAchievements(): Promise<AchievementRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('achievements')
    .select('*')
    .eq('is_active', true)
    .eq('is_hidden', false)
    .order('category')
    .order('name');

  if (error) throw normalizeError(error);
  return data ?? [];
}

export { queryKeys };
