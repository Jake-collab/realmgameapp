/**
 * Hunt Progress Repository — Worlds (Prompt 14)
 *
 * Data access for the Hunt Progress experience via SECURITY DEFINER RPCs
 * and direct Supabase queries (RLS-enforced):
 *   - In Action
 *   - Completed history
 *   - Completion detail
 *   - Stop history
 *   - Submission history
 *   - Point history
 *   - Other Activity
 *   - Hunt Leaderboard
 *   - Current-user Hunt rank
 *   - Progress summary
 *
 * Rules:
 * - Never expose review_notes, reviewer_id, or moderation metadata.
 * - Never expose validation geometry (geofence coords/radius).
 * - Never expose locked clue content through history routes.
 * - All private participation data validates auth.uid() via RLS.
 * - Leaderboard queries go through get_hunt_leaderboard RPC.
 * - Do NOT mix Hunt and Quest point totals.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, paginationRange } from '@/lib/supabase/helpers';
import type {
  HuntInActionItem,
  HuntInActionStop,
  HuntRewardInfo,
  CompletedHuntItem,
  HuntCompletionDetail,
  HuntStopHistoryEntry,
  HuntSubmissionHistoryItem,
  HuntPointTransaction,
  HuntOtherActivityItem,
  HuntProgressSummary,
  HuntLeaderboardEntry,
  HuntCurrentRank,
  LeaderboardPeriod,
  HuntCompletedFilter,
} from '../types/huntProgress.types';
import {
  HUNT_PROGRESS_PAGE_SIZE,
  HUNT_LEADERBOARD_PAGE_SIZE,
} from '../types/huntProgress.types';
import type { ParticipantStatus } from '../types/hunt.types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function rewardInfo(snapshot: any): HuntRewardInfo | null {
  if (!snapshot) return null;
  const pts = snapshot.pointsReward ?? snapshot.points_reward ?? snapshot.amount ?? null;
  return typeof pts === 'number' ? { pointsReward: pts } : null;
}

// ─── In Action ────────────────────────────────────────────────────────────────

/**
 * Fetch active/paused Hunt participations with pending stop info.
 * Calls get_hunt_in_action RPC (SECURITY DEFINER — validates auth.uid()).
 */
export async function fetchHuntInAction(userId: string): Promise<HuntInActionItem[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_hunt_in_action', { p_user_id: userId });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): HuntInActionItem => {
    const pendingStop: HuntInActionStop | null = row.pending_stop_id
      ? {
          stopId:          row.pending_stop_id,
          stopTitle:       row.pending_stop_title ?? 'Stop',
          stopStatus:      row.pending_stop_status ?? 'in_progress',
          safeReviewNote:  row.safe_review_note ?? null,
          lastSubmittedAt: row.last_submitted_at ?? null,
        }
      : null;

    return {
      participationId:    row.participation_id,
      huntId:             row.hunt_id,
      huntTitle:          row.hunt_title ?? 'Hunt',
      occurrenceId:       row.occurrence_id ?? null,
      status:             row.status as ParticipantStatus,
      startedAt:          row.started_at ?? null,
      completionDeadline: row.completion_deadline ?? null,
      awardedPoints:      row.awarded_points ?? null,
      rewardSnapshot:     rewardInfo(row.reward_snapshot),
      stopsCompleted:     Number(row.stops_completed ?? 0),
      stopsRequired:      Number(row.stops_required ?? 0),
      pendingStop,
    };
  });
}

// ─── Completed history ────────────────────────────────────────────────────────

/**
 * Fetch paginated completed Hunt history.
 * Calls get_hunt_completed RPC (SECURITY DEFINER).
 */
export async function fetchHuntCompleted(
  userId: string,
  filter: HuntCompletedFilter,
  page = 1,
  pageSize = HUNT_PROGRESS_PAGE_SIZE,
): Promise<{ items: CompletedHuntItem[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const offset = (page - 1) * pageSize;

  const { data, error } = await (client as any)
    .rpc('get_hunt_completed', {
      p_user_id:    userId,
      p_limit:      pageSize + 1,
      p_offset:     offset,
      p_sort_order: filter.sortOrder,
      p_mode_filter: filter.mode,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const items = (data as any[]).slice(0, pageSize).map((row): CompletedHuntItem => ({
    participationId:   row.participation_id,
    huntId:            row.hunt_id,
    huntTitle:         row.hunt_title ?? 'Hunt',
    occurrenceId:      row.occurrence_id ?? null,
    occurrenceLabel:   row.occurrence_label ?? null,
    completedAt:       row.completed_at,
    awardedPoints:     row.awarded_points ?? null,
    rewardSnapshot:    rewardInfo(row.reward_snapshot),
    stopsCompleted:    Number(row.stops_completed ?? 0),
    optionalCompleted: Number(row.optional_completed ?? 0),
    stopsRequired:     Number(row.stops_required ?? 0),
    isGroup:           Boolean(row.is_group),
    stopOrdering:      (row.stop_ordering as any) ?? null,
  }));

  return { items, hasMore };
}

// ─── Completion detail ────────────────────────────────────────────────────────

/**
 * Fetch full completion detail for a single participation.
 * Validates ownership via RPC (SECURITY DEFINER).
 * Returns null if not found or unauthorized.
 */
export async function fetchHuntCompletionDetail(
  participationId: string,
  userId: string,
): Promise<HuntCompletionDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_hunt_completion_detail', {
      p_participation_id: participationId,
      p_user_id:          userId,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as any;
  return {
    participationId:   row.participation_id,
    huntId:            row.hunt_id,
    huntTitle:         row.hunt_title ?? 'Hunt',
    huntSummary:       row.hunt_summary ?? null,
    occurrenceId:      row.occurrence_id ?? null,
    occurrenceLabel:   row.occurrence_label ?? null,
    completedAt:       row.completed_at,
    startedAt:         row.started_at ?? null,
    awardedPoints:     row.awarded_points ?? null,
    rewardSnapshot:    rewardInfo(row.reward_snapshot),
    hasReversal:       Boolean(row.has_reversal),
    isGroup:           Boolean(row.is_group),
    participationMode: row.participation_mode ?? 'solo',
    stopOrdering:      row.stop_ordering ?? 'ordered',
    stopsRequired:     Number(row.stops_required ?? 0),
    stopsCompleted:    Number(row.stops_completed ?? 0),
    optionalCompleted: Number(row.optional_completed ?? 0),
    groupMemberCount:  Number(row.group_member_count ?? 1),
  };
}

// ─── Stop history ─────────────────────────────────────────────────────────────

/**
 * Fetch stop-by-stop history for a participation.
 * Never exposes locked clue content or private geometry.
 */
export async function fetchHuntStopHistory(
  participationId: string,
  userId: string,
): Promise<HuntStopHistoryEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_hunt_stop_history', {
      p_participation_id: participationId,
      p_user_id:          userId,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): HuntStopHistoryEntry => ({
    stopProgressId:  row.stop_progress_id,
    huntStopId:      row.hunt_stop_id,
    stopTitle:       row.stop_title ?? 'Stop',
    stopNumber:      row.stop_number ?? null,
    isRequired:      Boolean(row.is_required),
    stopStatus:      row.stop_status ?? 'completed',
    completionMethod: (row.completion_method as any) ?? null,
    completedAt:     row.completed_at ?? null,
    proofStatus:     row.proof_status ?? null,
    proofType:       row.proof_type ?? null,
    hasTextResponse: Boolean(row.has_text_response),
    hasImage:        Boolean(row.has_image),
    locationVerified: Boolean(row.location_verified),
    proofApprovedAt: row.proof_approved_at ?? null,
  }));
}

// ─── Submission history ───────────────────────────────────────────────────────

/**
 * Fetch proof submission history for a participation.
 * Never exposes reviewer identity or raw review_notes.
 */
export async function fetchHuntSubmissionHistory(
  participationId: string,
  userId: string,
): Promise<HuntSubmissionHistoryItem[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_hunt_submission_history', {
      p_participation_id: participationId,
      p_user_id:          userId,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];

  return (data as any[]).map((row): HuntSubmissionHistoryItem => ({
    submissionId:           row.submission_id,
    stopProgressId:         row.stop_progress_id,
    huntStopId:             row.hunt_stop_id,
    stopTitle:              row.stop_title ?? 'Stop',
    submissionNumber:       Number(row.submission_number ?? 1),
    status:                 row.status ?? 'submitted',
    submittedAt:            row.submitted_at ?? null,
    submissionType:         row.submission_type ?? 'text',
    hasTextResponse:        Boolean(row.has_text_response),
    hasImage:               Boolean(row.has_image),
    locationVerified:       Boolean(row.location_verified),
    safeReviewExplanation:  row.safe_review_explanation ?? null,
    isLatest:               Boolean(row.is_latest),
    previousSubmissionId:   row.previous_submission_id ?? null,
  }));
}

// ─── Point history ────────────────────────────────────────────────────────────

/**
 * Fetch paginated Hunt-related point ledger entries for the current user.
 * Includes hunt_reward and reversals only. Never mixes in Quest points.
 */
export async function fetchHuntPointHistory(
  userId: string,
  page = 1,
  pageSize = HUNT_PROGRESS_PAGE_SIZE,
): Promise<{ items: HuntPointTransaction[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const offset = (page - 1) * pageSize;

  const { data, error } = await (client as any)
    .rpc('get_hunt_point_history', {
      p_user_id: userId,
      p_limit:   pageSize + 1,
      p_offset:  offset,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const items = (data as any[]).slice(0, pageSize).map((row): HuntPointTransaction => ({
    ledgerId:             row.ledger_id,
    amount:               Number(row.amount ?? 0),
    transactionType:      row.transaction_type as any,
    displayLabel:         row.display_label ?? 'Hunt reward',
    huntParticipationId:  row.hunt_participation_id ?? null,
    huntTitle:            row.hunt_title ?? null,
    createdAt:            row.created_at,
    isReversed:           Boolean(row.is_reversed),
    isReversal:           Boolean(row.is_reversal),
    reversedLedgerId:     row.reversed_ledger_id ?? null,
  }));

  return { items, hasMore };
}

// ─── Other Activity (archived) ────────────────────────────────────────────────

/**
 * Fetch paginated archived Hunt participations.
 * (withdrawn, removed, cancelled, expired)
 * Safe status explanations only — no internal removal reasons.
 */
export async function fetchHuntOtherActivity(
  userId: string,
  page = 1,
  pageSize = HUNT_PROGRESS_PAGE_SIZE,
): Promise<{ items: HuntOtherActivityItem[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const offset = (page - 1) * pageSize;

  const { data, error } = await (client as any)
    .rpc('get_hunt_other_activity', {
      p_user_id: userId,
      p_limit:   pageSize + 1,
      p_offset:  offset,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const items = (data as any[]).slice(0, pageSize).map((row): HuntOtherActivityItem => ({
    participationId: row.participation_id,
    huntId:          row.hunt_id,
    huntTitle:       row.hunt_title ?? 'Hunt',
    status:          row.status as ParticipantStatus,
    joinedAt:        row.joined_at ?? null,
    startedAt:       row.started_at ?? null,
    finalizedAt:     row.finalized_at ?? null,
    stopsCompleted:  Number(row.stops_completed ?? 0),
    stopsRequired:   Number(row.stops_required ?? 0),
    awardedPoints:   Number(row.awarded_points ?? 0),
    safeStatusNote:  row.safe_status_note ?? 'Participation ended.',
  }));

  return { items, hasMore };
}

// ─── Progress summary ─────────────────────────────────────────────────────────

/**
 * Fetch compact progress summary counts.
 */
export async function fetchHuntProgressSummary(
  userId: string,
): Promise<HuntProgressSummary | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_hunt_progress_summary', { p_user_id: userId });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as any;
  return {
    totalHuntPoints:            Number(row.total_hunt_points ?? 0),
    huntsCompleted:             Number(row.hunts_completed ?? 0),
    activeHunts:                Number(row.active_hunts ?? 0),
    readyHunts:                 Number(row.ready_hunts ?? 0),
    proofUnderReview:           Number(row.proof_under_review ?? 0),
    stopsNeedingResubmission:   Number(row.stops_resubmission ?? 0),
  };
}

// ─── Hunt Leaderboard ─────────────────────────────────────────────────────────

/**
 * Fetch a page of the Hunt leaderboard via RPC.
 * Returns publicly visible entries only.
 * Hidden users never appear in output.
 */
export async function fetchHuntLeaderboard(
  period: LeaderboardPeriod,
  page = 1,
  pageSize = HUNT_LEADERBOARD_PAGE_SIZE,
): Promise<{ entries: HuntLeaderboardEntry[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { entries: [], hasMore: false };
  const client = requireSupabase();
  const offset = (page - 1) * pageSize;

  const { data, error } = await (client as any)
    .rpc('get_hunt_leaderboard', {
      p_period: period,
      p_limit:  pageSize + 1,
      p_offset: offset,
    });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return { entries: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const entries = (data as any[]).slice(0, pageSize).map((row): HuntLeaderboardEntry => ({
    rank:           Number(row.rank),
    userId:         row.is_anonymous ? null : (row.user_id ?? null),
    displayName:    row.is_anonymous ? 'Anonymous Explorer' : (row.display_name ?? 'Explorer'),
    username:       row.is_anonymous ? null : (row.username ?? null),
    avatarPath:     row.is_anonymous ? null : (row.avatar_path ?? null),
    huntPoints:     Number(row.points ?? 0),
    huntsCompleted: Number(row.hunts_completed ?? 0),
    isCurrentUser:  Boolean(row.is_current_user),
    isAnonymous:    Boolean(row.is_anonymous),
  }));

  return { entries, hasMore };
}

// ─── Current user rank ────────────────────────────────────────────────────────

/**
 * Fetch the current user's Hunt rank for a given period.
 * Always returns private point totals (even for hidden users).
 */
export async function fetchMyHuntRank(
  period: LeaderboardPeriod,
): Promise<HuntCurrentRank | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_my_hunt_rank', { p_period: period });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as any;
  return {
    qualifies:         Boolean(row.qualifies),
    rank:              row.rank ? Number(row.rank) : null,
    points:            Number(row.points ?? 0),
    totalRankedUsers:  Number(row.total_ranked_users ?? 0),
    period,
    visibilityMode:    (row.visibility_mode as any) ?? 'visible',
    noRankReason:      row.no_rank_reason ?? null,
  };
}
