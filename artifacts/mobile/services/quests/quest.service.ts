/**
 * Quest Service — Worlds
 *
 * Handles quest discovery, participation lifecycle, and step progress.
 * All Supabase queries are isolated here — UI components use React Query
 * hooks that call these functions.
 *
 * Security:
 *   - Only published + available quests are returned to mobile clients (RLS).
 *   - awarded_points is set by server logic only; clients cannot write it.
 *   - quest_geofences are never queried from this service.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, paginationRange, queryKeys } from '@/lib/supabase/helpers';
import type {
  QuestRow,
  QuestObjectiveRow,
  QuestCategoryRow,
  QuestLocationRow,
  QuestParticipationRow,
  QuestStepProgressRow,
  QuestType,
  Difficulty,
  ParticipationStatus,
} from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestListParams {
  questType?: QuestType;
  difficulty?: Difficulty;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export interface QuestWithObjectives extends QuestRow {
  quest_objectives: QuestObjectiveRow[];
  quest_locations: QuestLocationRow[];
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Fetch published, currently-available quests visible to mobile users.
 * RLS enforces the published + availability window constraint.
 */
export async function getAvailableQuests(params: QuestListParams = {}): Promise<QuestRow[]> {
  const client = requireSupabase();
  const { from, to } = paginationRange(params.page, params.pageSize ?? 20);

  let query = client
    .from('quests')
    .select('*')
    .order('available_from', { ascending: false })
    .range(from, to);

  if (params.questType) {
    query = query.eq('quest_type', params.questType);
  }
  if (params.difficulty) {
    query = query.eq('difficulty', params.difficulty);
  }

  const { data, error } = await query;
  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Fetch a single quest with its objectives and public location.
 * Does NOT return geofence data.
 */
export async function getQuestById(questId: string): Promise<QuestWithObjectives | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quests')
    .select(`
      *,
      quest_objectives(*),
      quest_locations(*)
    `)
    .eq('id', questId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data as QuestWithObjectives | null;
}

export async function getQuestCategories(): Promise<QuestCategoryRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw normalizeError(error);
  return data ?? [];
}

// ─── Participation lifecycle ───────────────────────────────────────────────────

/**
 * Start a quest. Creates a new participation record.
 * Server will reject if the user already has an active participation
 * and the quest is non-repeatable (unique index constraint).
 */
export async function startQuest(
  userId: string,
  questId: string,
  expiresAt?: string
): Promise<QuestParticipationRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .insert({
      quest_id: questId,
      user_id: userId,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    })
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Fetch the user's active or historical participation for a specific quest.
 */
export async function getMyParticipation(
  userId: string,
  questId: string
): Promise<QuestParticipationRow | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Fetch all quest participations for the current user.
 * Ordered by most recent activity.
 */
export async function getMyParticipations(
  userId: string,
  statusFilter?: ParticipationStatus[]
): Promise<QuestParticipationRow[]> {
  const client = requireSupabase();
  let query = client
    .from('quest_participations')
    .select('*')
    .eq('user_id', userId)
    .order('last_progress_at', { ascending: false, nullsFirst: false });

  if (statusFilter?.length) {
    query = query.in('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Update participation status (e.g. in_progress → awaiting_proof, or abandoned).
 * awarded_points cannot be set here — server-only.
 */
export async function updateParticipationStatus(
  participationId: string,
  updates: {
    status: ParticipationStatus;
    last_progress_at?: string;
    submitted_at?: string;
    abandoned_at?: string;
  }
): Promise<QuestParticipationRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .update(updates)
    .eq('id', participationId)
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

// ─── Step progress ─────────────────────────────────────────────────────────────

export async function getStepProgress(
  participationId: string
): Promise<QuestStepProgressRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_step_progress')
    .select('*')
    .eq('participation_id', participationId);

  if (error) throw normalizeError(error);
  return data ?? [];
}

export async function upsertStepProgress(
  participationId: string,
  questStepId: string,
  updates: {
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
    completed_at?: string;
    progress_value?: Record<string, unknown>;
    notes?: string;
  }
): Promise<QuestStepProgressRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_step_progress')
    .upsert({
      participation_id: participationId,
      quest_step_id: questStepId,
      ...updates,
    }, { onConflict: 'participation_id,quest_step_id' })
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

export { queryKeys };
