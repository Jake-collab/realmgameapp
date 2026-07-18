/**
 * Hunt Service — Worlds
 *
 * Handles hunt discovery, participation, invitations, and stop progress.
 * hunt_stop_geofences are NEVER queried from this service.
 * Stop reveal and completion validation are performed server-side (Build 5+).
 *
 * Security:
 *   - Private/invite-only hunts require participant or invitee status (RLS).
 *   - completed_at on hunt_stop_progress is set by server validation only.
 *   - awarded_points on hunt_participants is set by server logic only.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, paginationRange, queryKeys } from '@/lib/supabase/helpers';
import type {
  HuntRow,
  HuntStopRow,
  HuntClueRow,
  HuntParticipantRow,
  HuntInvitationRow,
  HuntStopProgressRow,
  HuntType,
  HuntPrivacy,
  HuntStatus,
  Difficulty,
} from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HuntListParams {
  huntType?: HuntType;
  privacy?: HuntPrivacy;
  status?: HuntStatus;
  difficulty?: Difficulty;
  page?: number;
  pageSize?: number;
}

export interface HuntWithStops extends HuntRow {
  hunt_stops: HuntStopRow[];
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Fetch publicly visible hunts (public + unlisted, active/ready/scheduled).
 * Private and invite-only hunts are returned only for participants via the
 * hunt_participant_select RLS policy.
 */
export async function getAvailableHunts(params: HuntListParams = {}): Promise<HuntRow[]> {
  const client = requireSupabase();
  const { from, to } = paginationRange(params.page, params.pageSize ?? 20);

  let query = client
    .from('hunts')
    .select('*')
    .in('status', ['ready', 'active', 'scheduled'])
    .order('starts_at', { ascending: true })
    .range(from, to);

  if (params.huntType) query = query.eq('hunt_type', params.huntType);
  if (params.difficulty) query = query.eq('difficulty', params.difficulty);

  const { data, error } = await query;
  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Fetch a hunt by ID. Returns null if not accessible to the current user.
 */
export async function getHuntById(huntId: string): Promise<HuntWithStops | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunts')
    .select(`
      *,
      hunt_stops(
        id, sort_order, title, description,
        is_ordered, is_required, is_hidden, stop_role,
        estimated_radius_meters, completion_method,
        proof_required, server_reveal_state, created_at
      )
    `)
    .eq('id', huntId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data as HuntWithStops | null;
}

/**
 * Fetch revealed clues for a stop.
 * Only returns clues where server_reveal_state IN ('revealed_to_participant', 'public').
 * RLS enforces this server-side.
 */
export async function getRevealedClues(huntStopId: string): Promise<HuntClueRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_clues')
    .select('*')
    .eq('hunt_stop_id', huntStopId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw normalizeError(error);
  return data ?? [];
}

// ─── Participation ────────────────────────────────────────────────────────────

/**
 * Fetch all hunts the user is a participant of.
 */
export async function getMyHunts(userId: string): Promise<HuntRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_participants')
    .select('hunt_id, hunts(*)')
    .eq('user_id', userId)
    .not('status', 'in', '(declined,removed,expired)')
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map((row: any) => row.hunts).filter(Boolean);
}

export async function getMyHuntParticipant(
  userId: string,
  huntId: string
): Promise<HuntParticipantRow | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_participants')
    .select('*')
    .eq('user_id', userId)
    .eq('hunt_id', huntId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Join an open, public hunt. Blocked for private/invite-only by RLS.
 */
export async function joinHunt(userId: string, huntId: string): Promise<HuntParticipantRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_participants')
    .insert({ hunt_id: huntId, user_id: userId })
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Update participant status (e.g. ready, left, paused).
 * Cannot set awarded_points, started_at, or completed_at — server-only.
 */
export async function updateParticipantStatus(
  participantId: string,
  status: 'ready' | 'left' | 'paused',
  extra?: { ready_at?: string; left_at?: string }
): Promise<HuntParticipantRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_participants')
    .update({ status, ...extra })
    .eq('id', participantId)
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

// ─── Invitations ───────────────────────────────────────────────────────────────

export async function getMyInvitations(userId: string): Promise<HuntInvitationRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_invitations')
    .select('*')
    .eq('invitee_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Send an invitation. Service layer must check are_users_blocked() before calling.
 */
export async function sendInvitation(
  huntId: string,
  inviterUserId: string,
  inviteeUserId: string,
  message?: string
): Promise<HuntInvitationRow> {
  const client = requireSupabase();

  // Check block status before sending
  const { data: blocked } = await client
    .rpc('are_users_blocked', { p_user_a: inviterUserId, p_user_b: inviteeUserId });
  if (blocked) {
    throw { message: 'You cannot invite this user.' };
  }

  const { data, error } = await client
    .from('hunt_invitations')
    .insert({
      hunt_id: huntId,
      inviter_user_id: inviterUserId,
      invitee_user_id: inviteeUserId,
      ...(message ? { message } : {}),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

export async function respondToInvitation(
  invitationId: string,
  response: 'accepted' | 'declined'
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('hunt_invitations')
    .update({ status: response, responded_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) throw normalizeError(error);
}

// ─── Stop progress ─────────────────────────────────────────────────────────────

export async function getStopProgress(
  participantId: string
): Promise<HuntStopProgressRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunt_stop_progress')
    .select('*')
    .eq('hunt_participant_id', participantId);

  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Record device-reported arrival at a stop.
 * Server will decide whether to mark the stop as completed (Build 5+).
 */
export async function recordArrival(
  participantId: string,
  huntStopId: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('hunt_stop_progress')
    .upsert({
      hunt_participant_id: participantId,
      hunt_stop_id: huntStopId,
      arrived_at: new Date().toISOString(),
      attempt_count: 1,
    }, { onConflict: 'hunt_participant_id,hunt_stop_id' });

  if (error) throw normalizeError(error);
}

// ─── Custom Game creation ─────────────────────────────────────────────────────

export async function createCustomGame(
  creatorUserId: string,
  payload: {
    slug: string;
    title: string;
    summary: string;
    description: string;
    points_reward: number;
    privacy?: 'public' | 'unlisted' | 'invite_only' | 'private';
    max_participants?: number;
    starts_at?: string;
    ends_at?: string;
    difficulty?: string;
    estimated_duration_minutes?: number;
  }
): Promise<HuntRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('hunts')
    .insert({
      ...payload,
      hunt_type: 'custom',
      status: 'draft',
      creator_user_id: creatorUserId,
    })
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

export { queryKeys };
