/**
 * Quest Repository — Worlds
 *
 * Typed database access layer for all quest-related reads.
 * Never includes geofence (quest_geofences) data — validation geometry
 * is server-only and never returned to mobile clients.
 *
 * UI components → hooks → services → repository (this file) → Supabase
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type {
  QuestRow,
  QuestObjectiveRow,
  QuestLocationRow,
  QuestParticipationRow,
  QuestStepProgressRow,
  QuestType,
  ParticipationStatus,
} from '@/lib/supabase/database.types';
import type { QuestListFilter, QuestOccurrence, QuestPrerequisite } from '../types/quest.types';
import { normalizeQuestError } from '../utils/questErrors';

// ─── Extended row types (with new migration 017 columns) ──────────────────────

export interface QuestRowExtended extends QuestRow {
  completion_mode: 'auto' | 'manual_review';
  expiration_behavior: 'hard' | 'started_users_may_finish';
  home_priority: number;
  /** Public targeting metadata used by the server-selected Daily Quest. */
  interest_bubble_ids?: string[];
  interest_targeting_mode?: 'ANY_MATCH' | 'PREFER_COMBINATION' | 'REQUIRE_COMBINATION';
}

export interface QuestParticipationRowExtended extends QuestParticipationRow {
  reward_snapshot_points: number | null;
  occurrence_key: string | null;
}

export interface QuestVerificationTimerResult {
  participation_id: string;
  verification_started_at: string;
  verification_earliest_completion_at: string;
}

export interface QuestIntegrityConfirmationResult {
  participation_id: string;
  integrity_confirmed_at: string;
}

export interface QuestWithRelations extends QuestRowExtended {
  quest_objectives: QuestObjectiveRow[];
  quest_locations: QuestLocationRow[];
}

// ─── Quest reads ───────────────────────────────────────────────────────────────

/**
 * Fetch published, available quests with optional filters.
 * RLS ensures only published quests within availability windows are returned.
 */
export async function fetchAvailableQuests(filter: QuestListFilter = {}): Promise<QuestRowExtended[]> {
  const client = requireSupabase();
  const from = ((filter.page ?? 0) * (filter.pageSize ?? 20));
  const to = from + (filter.pageSize ?? 20) - 1;

  let query = client
    .from('quests')
    .select('*')
    .order('home_priority', { ascending: false })
    .order('available_from', { ascending: false })
    .range(from, to);

  if (filter.questType) query = query.eq('quest_type', filter.questType);
  if (filter.difficulty) query = query.eq('difficulty', filter.difficulty);
  if (filter.indoor_outdoor) query = query.eq('indoor_outdoor', filter.indoor_outdoor);
  if (filter.categoryId) {
    // Filter via join table (quest_category_assignments)
    query = query.in('id',
      client.from('quest_category_assignments')
        .select('quest_id')
        .eq('category_id', filter.categoryId) as unknown as string[]
    );
  }

  const { data, error } = await query;
  if (error) throw normalizeQuestError(error);
  return (data ?? []) as unknown as QuestRowExtended[];
}

/**
 * Fetch a single quest with objectives and public location (no geofences).
 */
export async function fetchQuestById(questId: string): Promise<QuestWithRelations | null> {
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

  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestWithRelations | null;
}

/**
 * Fetch quests by type for list screens.
 * Returns full quest rows sorted by home_priority desc, available_from desc.
 */
export async function fetchQuestsByType(
  questType: QuestType,
  page = 0,
  pageSize = 20
): Promise<QuestRowExtended[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quests')
    .select('*, quest_interest_tags(interest_id, targeting_mode)')
    .eq('quest_type', questType)
    .order('home_priority', { ascending: false })
    .order('available_from', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw normalizeQuestError(error);
  return (data ?? []).map((row: any) => ({
    ...row,
    interest_bubble_ids: (row.quest_interest_tags ?? []).map((tag: { interest_id: string }) => tag.interest_id),
    interest_targeting_mode: (row.quest_interest_tags ?? []).some((tag: { targeting_mode?: string }) => tag.targeting_mode === 'REQUIRE_COMBINATION')
      ? 'REQUIRE_COMBINATION'
      : (row.quest_interest_tags ?? []).some((tag: { targeting_mode?: string }) => tag.targeting_mode === 'PREFER_COMBINATION')
        ? 'PREFER_COMBINATION'
        : 'ANY_MATCH',
  })) as unknown as QuestRowExtended[];
}

/**
 * Fetch geo quests with optional approximate location data.
 * Never includes precise geofence validation coordinates.
 */
export async function fetchGeoQuests(page = 0, pageSize = 20): Promise<QuestWithRelations[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('quests')
    .select(`
      *,
      quest_objectives(*),
      quest_locations(*)
    `)
    .eq('quest_type', 'geo')
    .order('home_priority', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw normalizeQuestError(error);
  return (data ?? []) as unknown as QuestWithRelations[];
}

// ─── Occurrence reads ──────────────────────────────────────────────────────────

/**
 * Fetch the current active occurrence for a quest.
 * An occurrence is "active" if published and within its availability window.
 */
export async function fetchCurrentOccurrence(questId: string): Promise<QuestOccurrence | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('quest_occurrences')
    .select('*')
    .eq('quest_id', questId)
    .eq('is_published', true)
    .lte('available_from', now)
    .gt('available_until', now)
    .order('admin_priority', { ascending: false })
    .order('available_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeQuestError(error);
  return data as QuestOccurrence | null;
}

/**
 * Fetch the most recent published occurrence regardless of availability window.
 * Used for display purposes when no active occurrence exists.
 */
export async function fetchLatestOccurrence(questId: string): Promise<QuestOccurrence | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_occurrences')
    .select('*')
    .eq('quest_id', questId)
    .eq('is_published', true)
    .order('available_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeQuestError(error);
  return data as QuestOccurrence | null;
}

// ─── Prerequisite reads ────────────────────────────────────────────────────────

export async function fetchQuestPrerequisites(questId: string): Promise<QuestPrerequisite[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_prerequisites')
    .select('*')
    .eq('quest_id', questId);

  if (error) throw normalizeQuestError(error);
  return (data ?? []) as QuestPrerequisite[];
}

// ─── Participation reads ───────────────────────────────────────────────────────

/**
 * Fetch the most recent participation for a user+quest combo.
 * Returns the active one first, then falls back to most recent.
 */
export async function fetchUserParticipation(
  userId: string,
  questId: string
): Promise<QuestParticipationRowExtended | null> {
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

  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestParticipationRowExtended | null;
}

/**
 * Fetch ALL participations for a user+quest combo (history).
 */
export async function fetchUserParticipationHistory(
  userId: string,
  questId: string
): Promise<QuestParticipationRowExtended[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeQuestError(error);
  return (data ?? []) as unknown as QuestParticipationRowExtended[];
}

/**
 * Fetch participation by occurrence key — handles repeatable quests.
 */
export async function fetchParticipationByOccurrenceKey(
  userId: string,
  occurrenceKey: string
): Promise<QuestParticipationRowExtended | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .select('*')
    .eq('user_id', userId)
    .eq('occurrence_key', occurrenceKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestParticipationRowExtended | null;
}

/**
 * Fetch a participation by its ID (must belong to the user — RLS enforced).
 */
export async function fetchParticipationById(
  participationId: string
): Promise<QuestParticipationRowExtended | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_participations')
    .select('*')
    .eq('id', participationId)
    .maybeSingle();

  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestParticipationRowExtended | null;
}

/**
 * Fetch all user participations with optional status filter.
 */
export async function fetchUserParticipations(
  userId: string,
  statusFilter?: ParticipationStatus[]
): Promise<QuestParticipationRowExtended[]> {
  if (!isSupabaseConfigured()) return [];
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
  if (error) throw normalizeQuestError(error);
  return (data ?? []) as unknown as QuestParticipationRowExtended[];
}

/**
 * Fetch active participations for the home screen (most recent first).
 */
export async function fetchActiveParticipations(
  userId: string
): Promise<QuestParticipationRowExtended[]> {
  return fetchUserParticipations(userId, [
    'started', 'in_progress', 'awaiting_proof',
    'under_review', 'needs_resubmission',
  ]);
}

// ─── Step progress reads ────────────────────────────────────────────────────────

export async function fetchStepProgress(
  participationId: string
): Promise<QuestStepProgressRow[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('quest_step_progress')
    .select('*')
    .eq('participation_id', participationId);

  if (error) throw normalizeQuestError(error);
  return data ?? [];
}

// ─── Point reward guidelines reads ────────────────────────────────────────────

export async function fetchPointRewardGuidelines() {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('point_reward_guidelines')
    .select('*')
    .eq('is_active', true)
    .eq('activity_type', 'quest');

  if (error) throw normalizeQuestError(error);
  return data ?? [];
}

// ─── Writes (participation lifecycle) ─────────────────────────────────────────

/**
 * Create a new participation record.
 * reward_snapshot_points captures the current quest reward at start time.
 */
export async function insertParticipation(payload: {
  quest_id: string;
  user_id: string;
  expires_at?: string;
  reward_snapshot_points: number;
  occurrence_key?: string;
}): Promise<QuestParticipationRowExtended> {
  const client = requireSupabase();
  const insertPayload = {
    quest_id: payload.quest_id,
    user_id: payload.user_id,
    ...(payload.expires_at ? { expires_at: payload.expires_at } : {}),
    reward_snapshot_points: payload.reward_snapshot_points,
    ...(payload.occurrence_key ? { occurrence_key: payload.occurrence_key } : {}),
  };
  const { data, error } = await client
    .from('quest_participations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestParticipationRowExtended;
}

export async function startQuestVerificationTimer(
  participationId: string,
  userId: string,
): Promise<QuestVerificationTimerResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('start_quest_verification_timer' as never, {
    p_participation_id: participationId,
    p_user_id: userId,
  } as never);
  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestVerificationTimerResult;
}

export async function confirmQuestIntegrity(
  participationId: string,
  userId: string,
): Promise<QuestIntegrityConfirmationResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('confirm_quest_integrity' as never, {
    p_participation_id: participationId,
    p_user_id: userId,
  } as never);
  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestIntegrityConfirmationResult;
}

/**
 * Update participation status. Only client-permitted fields.
 * Completion and rejection require trusted server RPCs.
 */
export async function updateParticipationStatus(
  participationId: string,
  updates: {
    status: ParticipationStatus;
    last_progress_at?: string;
    submitted_at?: string;
    abandoned_at?: string;
  }
): Promise<QuestParticipationRowExtended> {
  const client = requireSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('quest_participations') as any)
    .update(updates)
    .eq('id', participationId)
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data as unknown as QuestParticipationRowExtended;
}

/**
 * Upsert step progress (idempotent).
 */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(
      { participation_id: participationId, quest_step_id: questStepId, ...updates } as any,
      { onConflict: 'participation_id,quest_step_id' }
    )
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data;
}

/**
 * Initialize step progress records for all required objectives.
 */
export async function initializeStepProgress(
  participationId: string,
  objectives: QuestObjectiveRow[]
): Promise<QuestStepProgressRow[]> {
  if (objectives.length === 0) return [];
  const client = requireSupabase();
  const rows = objectives.map((obj) => ({
    participation_id: participationId,
    quest_step_id: obj.id,
    status: 'not_started' as const,
  }));

  const { data, error } = await client
    .from('quest_step_progress')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as any, { onConflict: 'participation_id,quest_step_id', ignoreDuplicates: true })
    .select();

  if (error) throw normalizeQuestError(error);
  return data ?? [];
}
