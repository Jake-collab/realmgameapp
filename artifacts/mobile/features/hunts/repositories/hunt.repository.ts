/**
 * Hunt Repository — Worlds
 *
 * Typed persistence layer for Hunt data. All database access for Hunts
 * goes through this module. RLS-aware.
 *
 * Rules:
 * - Never return private validation geometry.
 * - Never return locked clue content.
 * - Never return internal moderation notes.
 * - SECURITY DEFINER RPCs handle sensitive operations.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  HuntSummary,
  HuntDetail,
  HuntParticipant,
  HuntInvitation,
  HuntOccurrence,
  HuntStopProgress,
  ActiveHunt,
  MyHuntsSummary,
  HuntJoinResult,
  HuntStartResult,
  HuntInviteResult,
  HuntInvitationActionResult,
  HuntStopCompletionResult,
  HuntCompletionResult,
  HuntWithdrawalResult,
  HuntCancellationResult,
  HuntAvailabilityResult,
  HuntMapItem,
} from '../types/hunt.types';
import { normalizeHuntError, HuntErrors } from '../utils/huntErrors';
import { normalizeError } from '@/lib/errors/normalizeError';

// ─── Supabase client ──────────────────────────────────────────────────────────

function db() {
  const client = getSupabaseClient();
  if (!client) throw HuntErrors.unavailable();
  return client;
}

// ─── Hunt queries ─────────────────────────────────────────────────────────────

/**
 * Fetch a Hunt's public detail — no private geometry, no locked clues.
 * Combines hunt + stops + public occurrence + participation state.
 */
export async function fetchHuntDetail(
  huntId: string,
  userId?: string,
): Promise<HuntDetail | null> {
  const supabase = db();

  const { data, error } = await supabase
    .from('hunts')
    .select(`
      id, slug, title, summary, description, hunt_type, status, privacy,
      join_policy, points_reward, estimated_duration_minutes, difficulty,
      max_participants, min_participants, starts_at, ends_at, participation_mode,
      stop_ordering, start_model, is_featured, safety_note, accessibility_note,
      public_meeting_info, venue_hours_note, version,
      hunt_stops (
        id, sort_order, title, description, stop_role, is_required,
        estimated_duration_minutes, safety_note, accessibility_note, completion_method
      ),
      hunt_occurrences (
        id, occurrence_key, status, starts_at, ends_at, join_until, start_until,
        complete_until, max_participants, min_participants, participant_count,
        reward_override_points, start_model, public_meeting_info, host_user_id,
        cancelled_at, cancellation_reason
      )
    `)
    .eq('id', huntId)
    .single();

  if (error || !data) return null;

  // Fetch user participation if authenticated
  let participation: HuntParticipant | null = null;
  let invitation: HuntInvitation | null = null;
  if (userId) {
    const [partResult, invResult] = await Promise.all([
      supabase
        .from('hunt_participants')
        .select('id, status, role, joined_at, started_at, completed_at, awarded_points')
        .eq('hunt_id', huntId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('hunt_invitations')
        .select('id, status, message, expires_at, created_at')
        .eq('hunt_id', huntId)
        .eq('invitee_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle(),
    ]);
    participation = partResult.data as any;
    invitation = invResult.data as any;
  }

  // Build capacity state
  const occurrences = (data as any).hunt_occurrences ?? [];
  const activeOccurrence = occurrences.find(
    (o: any) => o.status === 'active' || o.status === 'scheduled'
  ) ?? occurrences[0] ?? null;

  const maxParticipants =
    activeOccurrence?.max_participants ?? (data as any).max_participants ?? null;
  const currentCount = activeOccurrence?.participant_count ?? 0;

  const result: HuntDetail = {
    id: data.id,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    description: (data as any).description ?? '',
    huntType: (data as any).hunt_type,
    privacy: data.privacy,
    difficulty: data.difficulty,
    estimatedDurationMinutes: data.estimated_duration_minutes ?? null,
    pointsReward: data.points_reward,
    stopCount: ((data as any).hunt_stops ?? []).length,
    isOrdered: (data as any).stop_ordering === 'ordered',
    participationMode: (data as any).participation_mode ?? 'solo',
    availabilityState: 'available', // resolved by availability evaluator
    participationStatus: (participation as any)?.status ?? null,
    participationId: (participation as any)?.id ?? null,
    invitationId: (invitation as any)?.id ?? null,
    invitationStatus: (invitation as any)?.status ?? null,
    thumbnailUrl: null,
    occurrenceId: activeOccurrence?.id ?? null,
    startsAt: activeOccurrence?.starts_at ?? (data as any).starts_at ?? null,
    endsAt: activeOccurrence?.ends_at ?? (data as any).ends_at ?? null,
    capacityState: {
      maxParticipants,
      currentCount,
      isUnlimited: maxParticipants === null,
      isFull: maxParticipants !== null && currentCount >= maxParticipants,
      availableSlots: maxParticipants !== null ? Math.max(0, maxParticipants - currentCount) : null,
      pendingInvitationCount: 0,
    },
    displayLat: null,
    displayLng: null,
    publicLocationLabel: null,
    safetyNote: (data as any).safety_note ?? null,
    accessibilityNote: (data as any).accessibility_note ?? null,
    publicMeetingInfo: (data as any).public_meeting_info ?? null,
    venueHoursNote: (data as any).venue_hours_note ?? null,
    creator: null,
    occurrence: activeOccurrence ? mapOccurrence(activeOccurrence) : null,
    prerequisites: [],
    primaryAction: {
      actionType: 'view_hunt',
      label: 'View Hunt',
      isEnabled: true,
      requiresConfirmation: false,
      confirmationMessage: null,
      reasonCode: null,
      loadingBehavior: 'none',
    },
    stops: ((data as any).hunt_stops ?? []).map((s: any) => ({
      id: s.id,
      sortOrder: s.sort_order,
      title: s.title,
      description: s.description ?? null,
      stopRole: s.stop_role,
      isRequired: s.is_required,
      estimatedDurationMinutes: s.estimated_duration_minutes ?? null,
      safetyNote: s.safety_note ?? null,
      accessibilityNote: s.accessibility_note ?? null,
      completionMethod: s.completion_method,
      publicLat: null,
      publicLng: null,
      publicRadius: null,
    })),
    rewardSnapshot: null,
  };

  return result;
}

function mapOccurrence(o: any): HuntOccurrence {
  return {
    id: o.id,
    huntId: o.hunt_id ?? '',
    occurrenceKey: o.occurrence_key ?? '',
    status: o.status,
    startsAt: o.starts_at ?? null,
    endsAt: o.ends_at ?? null,
    joinUntil: o.join_until ?? null,
    startUntil: o.start_until ?? null,
    completeUntil: o.complete_until ?? null,
    startedUsersGracePeriodMinutes: o.started_users_grace_period_minutes ?? 60,
    hardExpiresAt: o.hard_expires_at ?? null,
    maxParticipants: o.max_participants ?? null,
    minParticipants: o.min_participants ?? 1,
    participantCount: o.participant_count ?? 0,
    rewardOverridePoints: o.reward_override_points ?? null,
    startModel: o.start_model ?? 'individual',
    publicMeetingInfo: o.public_meeting_info ?? null,
    hostUserId: o.host_user_id ?? null,
    cancelledAt: o.cancelled_at ?? null,
    cancellationReason: o.cancellation_reason ?? null,
    createdAt: o.created_at ?? '',
    updatedAt: o.updated_at ?? '',
  };
}

// ─── Hunt availability ────────────────────────────────────────────────────────

export async function fetchHuntAvailability(
  huntId: string,
  occurrenceId?: string | null,
): Promise<HuntAvailabilityResult | null> {
  const supabase = db();

  const { data, error } = await supabase.rpc('get_hunt_availability', {
    p_hunt_id: huntId,
    p_occurrence_id: occurrenceId ?? null,
  });

  if (error) throw normalizeError(error);

  // Map RPC JSONB response to domain type
  const r = data as any;
  return {
    state: r.state,
    canView: r.canView ?? false,
    canJoin: r.canJoin ?? false,
    canStart: r.canStart ?? false,
    reasonCode: r.reasonCode ?? 'ELIGIBLE',
    userMessage: r.userMessage ?? '',
    occurrenceId: r.occurrenceId ?? undefined,
    participationId: r.participationId ?? undefined,
    invitationId: r.invitationId ?? undefined,
    availableFrom: r.availableFrom ?? undefined,
    availableUntil: r.availableUntil ?? undefined,
    primaryAction: {
      actionType: 'view_hunt',
      label: 'View Hunt',
      isEnabled: true,
      requiresConfirmation: false,
      confirmationMessage: null,
      reasonCode: null,
      loadingBehavior: 'none',
    },
  };
}

// ─── My Hunts summary ─────────────────────────────────────────────────────────

export async function fetchMyHuntsSummary(): Promise<MyHuntsSummary> {
  const supabase = db();

  const { data, error } = await supabase.rpc('get_my_hunts_summary');

  if (error) throw normalizeError(error);

  const r = data as any;
  return {
    active:           r.active          ?? [],
    ready:            r.ready           ?? [],
    completed:        r.completed       ?? [],
    invitations:      r.invitations     ?? [],
    totalActiveCount: (r.active ?? []).length,
  };
}

// ─── Active hunt ──────────────────────────────────────────────────────────────

export async function fetchActiveHunt(participationId: string): Promise<ActiveHunt | null> {
  const supabase = db();

  // Load participation + stops + clues (authorized only)
  const { data: participant, error: partErr } = await supabase
    .from('hunt_participants')
    .select(`
      id, hunt_id, occurrence_id, status, role, started_at, reward_snapshot,
      hunt_stop_progress (
        id, hunt_stop_id, status, revealed_at, completed_at,
        proof_submission_id, attempt_count, unlocked_at,
        hunt_stops (
          id, sort_order, title, description, stop_role, is_required,
          estimated_duration_minutes, safety_note, accessibility_note,
          completion_method,
          hunt_clues ( id, clue_text, image_media_id, hint_text, reveal_rule, is_active )
        )
      )
    `)
    .eq('id', participationId)
    .single();

  if (partErr || !participant) return null;

  const p = participant as any;

  // Only return authorized (non-locked) stops and clues
  const authorizedProgress = (p.hunt_stop_progress ?? [])
    .filter((prog: any) => prog.status !== 'not_started' && prog.status !== 'locked')
    .map((prog: any) => {
      const stop = prog.hunt_stops;
      const clue = stop?.hunt_clues?.[0] ?? null;
      const isRevealed = prog.status !== 'not_started';

      return {
        id: stop?.id ?? prog.hunt_stop_id,
        sortOrder: stop?.sort_order ?? 0,
        title: stop?.title ?? '',
        description: stop?.description ?? null,
        stopRole: stop?.stop_role ?? 'waypoint',
        isRequired: stop?.is_required ?? true,
        estimatedDurationMinutes: stop?.estimated_duration_minutes ?? null,
        safetyNote: stop?.safety_note ?? null,
        accessibilityNote: stop?.accessibility_note ?? null,
        completionMethod: stop?.completion_method ?? 'manual_confirmation',
        publicLat: null,
        publicLng: null,
        publicRadius: null,
        progressStatus: prog.status,
        progressId: prog.id,
        revealedAt: prog.revealed_at ?? null,
        // Only include clue content when stop is revealed — never send locked clue text
        clue: isRevealed && clue ? {
          id: clue.id,
          clueText: clue.clue_text ?? null,
          imageUrl: null, // resolved from media_assets in a separate query
          visibilityState: prog.status === 'completed' ? 'completed' : 'revealed',
          hintAvailable: !!clue.hint_text,
          revealRule: clue.reveal_rule,
        } : null,
        proofSubmissionId: prog.proof_submission_id ?? null,
        attemptCount: prog.attempt_count ?? 0,
      };
    });

  const completedCount = authorizedProgress.filter((s: any) => s.progressStatus === 'completed').length;

  // Load hunt for total stop count
  const { data: hunt } = await supabase
    .from('hunts')
    .select('title, points_reward')
    .eq('id', p.hunt_id)
    .single();

  const totalRequired = await supabase
    .from('hunt_stops')
    .select('id', { count: 'exact', head: true })
    .eq('hunt_id', p.hunt_id)
    .eq('is_required', true);

  return {
    huntId: p.hunt_id,
    huntTitle: (hunt as any)?.title ?? '',
    occurrenceId: p.occurrence_id ?? null,
    participationId,
    participationStatus: p.status,
    participantRole: p.role,
    startedAt: p.started_at ?? null,
    completionDeadline: (p.reward_snapshot as any)?.completionDeadline ?? null,
    currentStops: authorizedProgress,
    completedStopCount: completedCount,
    requiredStopCount: totalRequired.count ?? 0,
    totalStopCount: (p.hunt_stop_progress ?? []).length,
    rewardSnapshot: p.reward_snapshot ?? null,
    primaryAction: {
      actionType: 'continue_hunt',
      label: 'Continue Hunt',
      isEnabled: true,
      requiresConfirmation: false,
      confirmationMessage: null,
      reasonCode: null,
      loadingBehavior: 'spinner',
    },
    revealedStopLocations: [], // populated from hunt_stop_geofences in a future prompt
    groupSummary: null,
  };
}

// ─── Stop progress ────────────────────────────────────────────────────────────

export async function fetchStopProgress(participationId: string): Promise<HuntStopProgress[]> {
  const supabase = db();

  const { data, error } = await supabase
    .from('hunt_stop_progress')
    .select('*')
    .eq('hunt_participant_id', participationId)
    .order('created_at', { ascending: true });

  if (error) throw normalizeError(error);
  return (data ?? []).map(mapStopProgress);
}

function mapStopProgress(r: any): HuntStopProgress {
  return {
    id: r.id,
    huntParticipantId: r.hunt_participant_id,
    huntStopId: r.hunt_stop_id,
    status: r.status,
    revealedAt: r.revealed_at ?? null,
    arrivedAt: r.arrived_at ?? null,
    completedAt: r.completed_at ?? null,
    proofSubmissionId: r.proof_submission_id ?? null,
    attemptCount: r.attempt_count ?? 0,
    unlockedAt: r.unlocked_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Pending invitations ──────────────────────────────────────────────────────

export async function fetchMyPendingInvitations(): Promise<HuntInvitation[]> {
  const supabase = db();

  const { data, error } = await supabase
    .from('hunt_invitations')
    .select(`
      id, hunt_id, inviter_user_id, invitee_user_id, status,
      message, expires_at, responded_at, created_at
    `)
    .eq('status', 'pending')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map((r: any): HuntInvitation => ({
    id: r.id,
    huntId: r.hunt_id,
    occurrenceId: null,
    inviterUserId: r.inviter_user_id,
    inviteeUserId: r.invitee_user_id,
    status: r.status,
    message: r.message ?? null,
    roleOffered: null,
    expiresAt: r.expires_at ?? null,
    respondedAt: r.responded_at ?? null,
    createdAt: r.created_at,
    huntSummary: null,
  }));
}

// ─── RPC-backed mutations ─────────────────────────────────────────────────────

export async function rpcJoinHunt(
  huntId: string,
  occurrenceId?: string | null,
): Promise<HuntJoinResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('join_hunt', {
    p_hunt_id: huntId,
    p_occurrence_id: occurrenceId ?? null,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    participationId: r.participationId ?? null,
    participationStatus: r.participationStatus ?? null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcStartHunt(participationId: string): Promise<HuntStartResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('start_hunt', {
    p_participation_id: participationId,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    participationId: r.participationId ?? null,
    participationStatus: r.participationStatus ?? null,
    currentStops: [],
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcInviteToHunt(
  huntId: string,
  inviteeId: string,
  occurrenceId?: string | null,
  message?: string | null,
): Promise<HuntInviteResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('invite_to_hunt', {
    p_hunt_id: huntId,
    p_invitee_id: inviteeId,
    p_occurrence_id: occurrenceId ?? null,
    p_message: message ?? null,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    invitationId: r.invitationId ?? null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcAcceptHuntInvitation(
  invitationId: string,
): Promise<HuntInvitationActionResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('accept_hunt_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    participationId: r.participationId ?? null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcDeclineHuntInvitation(
  invitationId: string,
): Promise<HuntInvitationActionResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('decline_hunt_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    participationId: null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcWithdrawFromHunt(
  participationId: string,
  reason?: string,
): Promise<HuntWithdrawalResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('withdraw_from_hunt', {
    p_participation_id: participationId,
    p_reason: reason ?? null,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    participationId: r.participationId ?? null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcCompleteHuntStop(
  participationId: string,
  stopId: string,
  validationMethod?: string,
): Promise<HuntStopCompletionResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('complete_hunt_stop', {
    p_participation_id: participationId,
    p_stop_id: stopId,
    p_validation_method: validationMethod ?? 'manual_confirmation',
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    stopId: r.stopId ?? stopId,
    newStatus: r.newStatus ?? 'completed',
    nextStops: [],
    huntCompletionReady: r.huntCompletionReady ?? false,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcCompleteHunt(participationId: string): Promise<HuntCompletionResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('complete_hunt', {
    p_participation_id: participationId,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    participationId: r.participationId ?? null,
    awardedPoints: r.awardedPoints ?? null,
    completedAt: r.completedAt ?? null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}

export async function rpcCancelHuntOccurrence(
  occurrenceId: string,
  reason?: string,
): Promise<HuntCancellationResult> {
  const supabase = db();
  const { data, error } = await supabase.rpc('cancel_hunt_occurrence', {
    p_occurrence_id: occurrenceId,
    p_reason: reason ?? null,
  });
  if (error) throw normalizeError(error);
  const r = data as any;
  return {
    success: r.success,
    huntId: r.huntId ?? '',
    occurrenceId: r.occurrenceId ?? null,
    cancelledAt: r.cancelledAt ?? null,
    reasonCode: r.reasonCode ?? null,
    userMessage: r.userMessage ?? '',
  };
}
