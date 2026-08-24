/**
 * Quest Selection Service — Worlds
 *
 * Selects the best quest for each type (daily, monthly, geo) for a given user.
 *
 * Daily Quest selection (Build 1 — deterministic):
 *  1. Published, within availability window
 *  2. Highest home_priority first
 *  3. Not completed by the user in the current daily window
 *  4. Matching user interests and targeting mode
 *  5. Fallback to most recently published
 *
 * Monthly Quest Drop selection:
 *  - The monthly quest is determined by availability window + highest home_priority.
 *  - There is one canonical monthly drop per period.
 *
 * Geo-Quest selection:
 *  - All available geo quests are returned for the map view.
 *  - Filtering by approximate distance is handled in the map layer.
 *
 * Never use opaque random selection — results must be stable across refreshes.
 */

import {
  fetchQuestsByType,
  type QuestRowExtended,
} from '../repositories/quest.repository';
import { isWithinAvailabilityWindow, buildDailyOccurrenceKey, buildMonthlyOccurrenceKey } from './questScheduling.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { requireSupabase } from '@/lib/supabase/client';

// ─── Daily quest selection ────────────────────────────────────────────────────

export interface DailyQuestSelectionInput {
  userId: string;
  completedOccurrenceKeys: Set<string>;
  userInterestIds?: string[];
  now?: Date;
}

export function rankDailyQuestCandidates(
  quests: QuestRowExtended[],
  userInterestIds: string[],
): QuestRowExtended[] {
  const interests = new Set(userInterestIds);
  const scored = quests.map((quest, index) => {
    const tags = quest.interest_bubble_ids ?? [];
    const matches = tags.filter((id) => interests.has(id)).length;
    const allMatch = tags.length > 0 && matches === tags.length;
    const mode = quest.interest_targeting_mode ?? 'ANY_MATCH';
    const excluded = mode === 'REQUIRE_COMBINATION' && !allMatch;
    const combinationBonus = mode === 'PREFER_COMBINATION' && allMatch ? 1000 : 0;
    // Matching tagged content wins, then an untagged fallback, then unrelated tagged content.
    const targetingTier = matches > 0 ? 10000 : tags.length === 0 ? 1000 : 0;
    const matchScore = tags.length === 0 ? 0 : (matches / tags.length) * 100;
    return {
      quest,
      excluded,
      score: targetingTier + combinationBonus + matchScore + (quest.home_priority ?? 0),
      index,
    };
  });

  return scored
    .filter((item) => !item.excluded)
    .sort((a, b) => b.score - a.score || (b.quest.home_priority ?? 0) - (a.quest.home_priority ?? 0) || a.index - b.index)
    .map((item) => item.quest);
}

/**
 * Select the prioritized Daily Quest for the Home screen.
 *
 * Returns the highest-priority daily quest that the user hasn't completed today.
 * Falls back to the highest-priority quest if all have been completed.
 */
export async function selectDailyQuest(
  input: DailyQuestSelectionInput
): Promise<QuestRowExtended | null> {
  if (!isSupabaseConfigured()) return buildMockDailyQuest();

  const now = input.now ?? new Date();
  // The RPC owns the assignment. A configured app must not silently swap in a
  // locally-ranked alternative if that trusted assignment is unavailable.
  try {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_daily_quest_assignment', {
      p_user_id: input.userId,
      p_occurrence_date: now.toISOString().slice(0, 10),
    } as never);
    if (!error) return data ? data as unknown as QuestRowExtended : null;
  } catch {
    return null;
  }
  return null;
}

// ─── Monthly quest drop selection ─────────────────────────────────────────────

export interface MonthlyQuestSelectionInput {
  userId: string;
  completedOccurrenceKeys: Set<string>;
  now?: Date;
}

/**
 * Select the current Monthly Quest Drop.
 * Returns the highest-priority monthly quest within the current monthly window.
 */
export async function selectMonthlyQuest(
  input: MonthlyQuestSelectionInput
): Promise<QuestRowExtended | null> {
  if (!isSupabaseConfigured()) return buildMockMonthlyQuest();

  const now = input.now ?? new Date();
  let quests: QuestRowExtended[];
  try {
    quests = await fetchQuestsByType('monthly', 0, 10);
  } catch {
    return null;
  }

  const available = quests.filter(q => isWithinAvailabilityWindow(q, now));
  if (available.length === 0) return null;

  return available.sort((a, b) => (b.home_priority ?? 0) - (a.home_priority ?? 0))[0] ?? null;
}

// ─── Geo quest selection ─────────────────────────────────────────────────────

/**
 * Fetch all currently available geo quests.
 * Used by the Map screen and the Quests → Geo section.
 * Distance filtering is applied at the map layer.
 */
export async function getAvailableGeoQuests(
  page = 0,
  pageSize = 20,
  now: Date = new Date()
): Promise<QuestRowExtended[]> {
  if (!isSupabaseConfigured()) return [buildMockGeoQuest()];

  let quests: QuestRowExtended[];
  try {
    quests = await fetchQuestsByType('geo', page, pageSize);
  } catch {
    return [];
  }

  return quests.filter(q => isWithinAvailabilityWindow(q, now));
}

// ─── Home screen selection ────────────────────────────────────────────────────

/**
 * Summarized quest type availability for the Home screen preview panel.
 * Returns counts/presence for each quest type.
 */
export interface HomeQuestSummary {
  hasDailyQuest: boolean;
  hasMonthlyQuest: boolean;
  geoQuestCount: number;
  dailyQuest: QuestRowExtended | null;
  monthlyQuest: QuestRowExtended | null;
}

export async function getHomeQuestSummary(
  userId: string,
  completedOccurrenceKeys: Set<string>,
  now: Date = new Date()
): Promise<HomeQuestSummary> {
  const [daily, monthly, geo] = await Promise.allSettled([
    selectDailyQuest({ userId, completedOccurrenceKeys, now }),
    selectMonthlyQuest({ userId, completedOccurrenceKeys, now }),
    getAvailableGeoQuests(0, 50, now),
  ]);

  return {
    hasDailyQuest: daily.status === 'fulfilled' && daily.value !== null,
    hasMonthlyQuest: monthly.status === 'fulfilled' && monthly.value !== null,
    geoQuestCount: geo.status === 'fulfilled' ? geo.value.length : 0,
    dailyQuest: daily.status === 'fulfilled' ? daily.value : null,
    monthlyQuest: monthly.status === 'fulfilled' ? monthly.value : null,
  };
}

// ─── Point guideline helper ───────────────────────────────────────────────────

import type { Difficulty } from '@/lib/supabase/database.types';
import type { PointRewardGuideline } from '../types/quest.types';
import { fetchPointRewardGuidelines } from '../repositories/quest.repository';

/**
 * Returns the suggested point range for a quest based on difficulty and duration.
 * Used by the admin panel (Prompt 17) and AI suggestion (Prompt 18).
 * Mobile clients receive the baked-in points_reward — they never choose the value.
 */
export async function getPointRewardGuideline(
  difficulty: Difficulty
): Promise<PointRewardGuideline | null> {
  try {
    const guidelines = await fetchPointRewardGuidelines();
    type GuidelineRecord = {
      difficulty: Difficulty;
      minimum_minutes: number;
      maximum_minutes: number;
      suggested_min_points: number;
      suggested_max_points: number;
    };
    const match = (guidelines as GuidelineRecord[]).find(g => g.difficulty === difficulty);
    if (!match) return null;
    return {
      difficulty: match.difficulty,
      minimumMinutes: match.minimum_minutes,
      maximumMinutes: match.maximum_minutes,
      suggestedMinPoints: match.suggested_min_points,
      suggestedMaxPoints: match.suggested_max_points,
    };
  } catch {
    return null;
  }
}

// ─── Dev mode mocks ───────────────────────────────────────────────────────────

function buildMockDailyQuest(): QuestRowExtended {
  const now = new Date().toISOString();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400 * 1000);

  return {
    id: 'dev-daily-001',
    slug: 'morning-walk',
    title: 'Morning Walk',
    summary: 'Take a 15-minute walk outdoors.',
    description: 'Head outside for a refreshing morning walk. Notice three things you find beautiful.',
    quest_type: 'daily',
    status: 'published',
    difficulty: 'easy',
    estimated_duration_minutes: 15,
    points_reward: 100,
    indoor_outdoor: 'outdoor',
    accessibility_notes: 'Wheelchair accessible routes available.',
    safety_notes: 'Stay on designated paths.',
    proof_type: 'none',
    location_requirement_type: 'none',
    available_from: today.toISOString(),
    available_until: tomorrow.toISOString(),
    published_at: now,
    created_by: null,
    approved_by: null,
    source_type: 'admin',
    ai_generation_id: null,
    is_repeatable: true,
    repeat_cooldown_hours: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
    completion_mode: 'auto',
    expiration_behavior: 'hard',
    home_priority: 10,
  };
}

function buildMockMonthlyQuest(): QuestRowExtended {
  const now = new Date().toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const nextMonth = new Date(monthStart.getTime());
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  return {
    id: 'dev-monthly-001',
    slug: 'local-landmark-explorer',
    title: 'Local Landmark Explorer',
    summary: 'Visit and photograph five landmarks in your city.',
    description: 'Discover the history of your city by visiting five significant landmarks and documenting your journey.',
    quest_type: 'monthly',
    status: 'published',
    difficulty: 'medium',
    estimated_duration_minutes: 120,
    points_reward: 500,
    indoor_outdoor: 'both',
    accessibility_notes: null,
    safety_notes: 'Use pedestrian crossings. Respect private property.',
    proof_type: 'photo',
    location_requirement_type: 'none',
    available_from: monthStart.toISOString(),
    available_until: nextMonth.toISOString(),
    published_at: now,
    created_by: null,
    approved_by: null,
    source_type: 'admin',
    ai_generation_id: null,
    is_repeatable: false,
    repeat_cooldown_hours: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
    completion_mode: 'manual_review',
    expiration_behavior: 'started_users_may_finish',
    home_priority: 20,
  };
}

function buildMockGeoQuest(): QuestRowExtended {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

  return {
    id: 'dev-geo-001',
    slug: 'riverside-discovery',
    title: 'Riverside Discovery',
    summary: 'Find the riverside mural near the old bridge.',
    description: 'Head to the river district and locate the famous riverside mural. Take a photo with the mural visible.',
    quest_type: 'geo',
    status: 'published',
    difficulty: 'easy',
    estimated_duration_minutes: 30,
    points_reward: 100,
    indoor_outdoor: 'outdoor',
    accessibility_notes: 'Paved path. Suitable for wheelchairs.',
    safety_notes: 'Stay on the riverside path. Do not enter the water.',
    proof_type: 'photo',
    location_requirement_type: 'approximate',
    available_from: now,
    available_until: until,
    published_at: now,
    created_by: null,
    approved_by: null,
    source_type: 'admin',
    ai_generation_id: null,
    is_repeatable: false,
    repeat_cooldown_hours: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
    completion_mode: 'manual_review',
    expiration_behavior: 'started_users_may_finish',
    home_priority: 5,
  };
}
