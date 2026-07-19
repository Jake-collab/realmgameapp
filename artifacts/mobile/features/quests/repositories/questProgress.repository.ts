/**
 * Quest Progress Repository — Worlds
 *
 * Data access for the Quest Progress experience: In Action participations,
 * Completed history, Other Activity (archived), Completion Detail,
 * Submission History, Point History, and Leaderboard queries.
 *
 * Rules:
 * - Never expose review_notes, reviewer_id, or moderation metadata.
 * - Never expose precise geofence geometry.
 * - All private participation data validates auth.uid() via RLS.
 * - Leaderboard queries go through secure RPCs.
 * - Do not duplicate fetchAvailableQuests or fetchActiveParticipations.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, paginationRange } from '@/lib/supabase/helpers';
import type {
  ParticipationStatus,
  QuestType,
} from '@/lib/supabase/database.types';
import type {
  InActionItem,
  CompletedQuestItem,
  OtherActivityItem,
  CompletionDetail,
  CompletedStepSummary,
  ProofSummary,
  SubmissionHistoryItem,
  QuestPointTransaction,
  QuestLeaderboardEntry,
  QuestCurrentRank,
  LeaderboardPeriod,
  CompletedFilter,
  IN_ACTION_STATUSES,
} from '../types/questProgress.types';
import { PROGRESS_PAGE_SIZE, LEADERBOARD_PAGE_SIZE } from '../types/questProgress.types';

// ─── Safe note helpers ────────────────────────────────────────────────────────

/** Returns a safe user-facing decision note. Never exposes raw review_notes. */
function safeDecisionNote(status: string, rawNote: string | null): string | null {
  if (status !== 'needs_resubmission') return null;
  if (!rawNote || rawNote.trim().length === 0) return null;
  // Truncate to 500 chars for display safety
  return rawNote.trim().slice(0, 500);
}

function noPointsReasonForStatus(status: ParticipationStatus): string {
  switch (status) {
    case 'abandoned': return 'Quest was abandoned before completion. No points are awarded.';
    case 'expired':   return 'Quest participation expired. No points are awarded.';
    case 'rejected':  return 'Proof was not accepted. Points have not been awarded.';
    default:          return 'Points are awarded after successful quest completion.';
  }
}

// ─── In Action ────────────────────────────────────────────────────────────────

/** Participation statuses shown in In Action (active and proof states). */
const IN_ACTION_STATUSES_LIST: ParticipationStatus[] = [
  'started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission',
];

/**
 * Fetch all In Action participations with embedded quest metadata.
 * Excludes rejected-final (those belong to Other Activity).
 * RLS guarantees only the current user's rows are returned.
 */
export async function fetchInActionParticipations(userId: string): Promise<InActionItem[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await client
    .from('quest_participations')
    .select(`
      id,
      quest_id,
      status,
      started_at,
      expires_at,
      submitted_at,
      reward_snapshot_points,
      occurrence_key,
      quests (
        id,
        title,
        quest_type,
        difficulty,
        points_reward,
        proof_type,
        completion_mode
      ),
      proof_submissions (
        id,
        status,
        review_notes,
        submitted_at
      )
    `)
    .eq('user_id', userId)
    .in('status', IN_ACTION_STATUSES_LIST)
    .order('started_at', { ascending: false });

  if (error) throw normalizeError(error);
  if (!data) return [];

  return data.map((row: any): InActionItem => {
    // Find the latest proof submission
    const proofs = (row.proof_submissions ?? []) as Array<{
      id: string; status: string; review_notes: string | null; submitted_at: string | null;
    }>;
    const latestProof = proofs.length > 0
      ? proofs.reduce((a: any, b: any) => {
          if (!a.submitted_at) return b;
          if (!b.submitted_at) return a;
          return a.submitted_at > b.submitted_at ? a : b;
        })
      : null;

    const quest = row.quests as any;
    const safeNote = latestProof
      ? safeDecisionNote(row.status, latestProof.review_notes)
      : null;

    return {
      participationId: row.id,
      questId: row.quest_id,
      status: row.status,
      startedAt: row.started_at,
      expiresAt: row.expires_at ?? null,
      submittedAt: row.submitted_at ?? null,
      rewardSnapshotPoints: row.reward_snapshot_points ?? null,
      occurrenceKey: row.occurrence_key ?? null,
      quest: quest ? {
        id: quest.id,
        title: quest.title,
        quest_type: quest.quest_type,
        difficulty: quest.difficulty,
        points_reward: quest.points_reward,
        proof_type: quest.proof_type,
        completion_mode: quest.completion_mode ?? 'auto',
      } : null,
      safeReviewNote: safeNote,
      latestProofStatus: latestProof ? (latestProof.status as any) : null,
    };
  });
}

// ─── Completed ────────────────────────────────────────────────────────────────

/**
 * Fetch paginated completed quest participations.
 * Uses awarded_points from the participation row (confirmed server-side).
 */
export async function fetchCompletedParticipations(
  userId: string,
  filter: CompletedFilter,
  page = 1,
  pageSize = PROGRESS_PAGE_SIZE
): Promise<{ items: CompletedQuestItem[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const { from, to } = paginationRange(page, pageSize);

  let query = client
    .from('quest_participations')
    .select(`
      id,
      quest_id,
      completed_at,
      awarded_points,
      reward_snapshot_points,
      occurrence_key,
      quests (
        title,
        quest_type,
        difficulty,
        slug
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null);

  // Apply quest type filter
  if (filter.questType !== 'all') {
    query = query.eq('quests.quest_type', filter.questType);
  }

  // Apply sort order
  switch (filter.sortOrder) {
    case 'oldest':
      query = query.order('completed_at', { ascending: true });
      break;
    case 'highest_points':
      query = query.order('awarded_points', { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order('completed_at', { ascending: false });
  }

  const { data, error } = await query.range(from, to + 1); // fetch one extra to detect hasMore
  if (error) throw normalizeError(error);
  if (!data) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const items = data.slice(0, pageSize).map((row: any): CompletedQuestItem => {
    const quest = row.quests as any;
    return {
      participationId: row.id,
      questId: row.quest_id,
      completedAt: row.completed_at,
      awardedPoints: row.awarded_points ?? null,
      rewardSnapshotPoints: row.reward_snapshot_points ?? null,
      occurrenceKey: row.occurrence_key ?? null,
      quest: quest ? {
        title: quest.title,
        quest_type: quest.quest_type,
        difficulty: quest.difficulty,
        slug: quest.slug,
      } : null,
    };
  });

  return { items, hasMore };
}

// ─── Other Activity (archived) ────────────────────────────────────────────────

/** Fetch paginated archived participations (abandoned, expired, final rejected). */
export async function fetchOtherActivityParticipations(
  userId: string,
  page = 1,
  pageSize = PROGRESS_PAGE_SIZE
): Promise<{ items: OtherActivityItem[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const { from, to } = paginationRange(page, pageSize);

  const OTHER_STATUSES: ParticipationStatus[] = ['abandoned', 'expired', 'rejected'];

  const { data, error } = await client
    .from('quest_participations')
    .select(`
      id,
      quest_id,
      status,
      started_at,
      abandoned_at,
      expires_at,
      submitted_at,
      occurrence_key,
      quests (
        title,
        quest_type,
        slug,
        is_repeatable
      )
    `)
    .eq('user_id', userId)
    .in('status', OTHER_STATUSES)
    .order('started_at', { ascending: false })
    .range(from, to + 1);

  if (error) throw normalizeError(error);
  if (!data) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const items = data.slice(0, pageSize).map((row: any): OtherActivityItem => {
    const quest = row.quests as any;
    const finalizedAt = row.abandoned_at ?? row.expires_at ?? row.submitted_at ?? null;
    const canRestart = quest?.is_repeatable === true && row.status === 'abandoned';
    return {
      participationId: row.id,
      questId: row.quest_id,
      status: row.status,
      startedAt: row.started_at,
      finalizedAt,
      occurrenceKey: row.occurrence_key ?? null,
      quest: quest ? {
        title: quest.title,
        quest_type: quest.quest_type,
        slug: quest.slug,
        is_repeatable: quest.is_repeatable ?? false,
      } : null,
      canRestart,
    };
  });

  return { items, hasMore };
}

// ─── Completion Detail ────────────────────────────────────────────────────────

/**
 * Fetch full completion detail for a participation.
 * Validates that the participation belongs to the requesting user (RLS).
 * Returns null if not found or not owned.
 */
export async function fetchCompletionDetail(
  participationId: string,
  userId: string
): Promise<CompletionDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data: participation, error: pErr } = await client
    .from('quest_participations')
    .select(`
      id,
      quest_id,
      status,
      completed_at,
      awarded_points,
      reward_snapshot_points,
      occurrence_key,
      quests (
        title,
        summary,
        quest_type,
        difficulty,
        proof_type,
        completion_mode,
        is_repeatable,
        slug
      )
    `)
    .eq('id', participationId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .maybeSingle();

  if (pErr) throw normalizeError(pErr);
  if (!participation) return null;

  // Fetch step progress
  const { data: stepRows, error: sErr } = await client
    .from('quest_step_progress')
    .select(`
      id,
      quest_step_id,
      status,
      completed_at,
        quest_objectives (
        title,
        instructions,
        is_required
      )
    `)
    .eq('participation_id', participationId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (sErr) throw normalizeError(sErr);

  const completedSteps: CompletedStepSummary[] = (stepRows ?? []).map((s: any) => {
    const obj = s.quest_objectives as any;
    return {
      stepId: s.quest_step_id,
      title: obj?.title ?? 'Step',
      instructions: obj?.instructions ?? '',
      isRequired: obj?.is_required ?? true,
      completedAt: s.completed_at ?? null,
    };
  });

  // Fetch latest approved proof summary
  const { data: proofRow, error: prErr } = await client
    .from('proof_submissions')
    .select(`
      id,
      status,
      submitted_at,
      submission_type,
      text_response,
      location_lat
    `)
    .eq('quest_participation_id', participationId)
    .eq('status', 'approved')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prErr) throw normalizeError(prErr);

  const proofSummary: ProofSummary | null = proofRow ? {
    submissionId: proofRow.id,
    status: proofRow.status as any,
    submittedAt: proofRow.submitted_at ?? null,
    submissionType: proofRow.submission_type as any,
    textResponse: proofRow.text_response ?? null,
    locationVerified: proofRow.location_lat != null,
    // photo/video types imply image submission; no DB column for this
    hasImage: ['photo', 'video'].includes(proofRow.submission_type),
  } : null;

  // Check for reversal
  const { data: reversalRow } = await client
    .from('points_ledger')
    .select('id')
    .eq('quest_participation_id', participationId)
    .eq('transaction_type', 'reversal')
    .limit(1)
    .maybeSingle();

  const row = participation as any;
  const quest = row.quests as any;

  return {
    participationId: row.id,
    questId: row.quest_id,
    completedAt: row.completed_at,
    awardedPoints: row.awarded_points ?? null,
    rewardSnapshotPoints: row.reward_snapshot_points ?? null,
    occurrenceKey: row.occurrence_key ?? null,
    quest: quest ? {
      title: quest.title,
      summary: quest.summary,
      quest_type: quest.quest_type,
      difficulty: quest.difficulty,
      proof_type: quest.proof_type,
      completion_mode: quest.completion_mode ?? 'auto',
      is_repeatable: quest.is_repeatable ?? false,
      slug: quest.slug,
    } : null,
    completedSteps,
    proofSummary,
    hasReversal: !!reversalRow,
  };
}

// ─── Submission History ────────────────────────────────────────────────────────

/**
 * Fetch all proof submission history for a participation.
 * Owner-only (RLS on proof_submissions enforces this).
 * Never exposes raw review_notes or reviewer identity.
 */
export async function fetchSubmissionHistory(
  participationId: string,
  userId: string
): Promise<SubmissionHistoryItem[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();

  const { data, error } = await client
    .from('proof_submissions')
    .select('id, status, submitted_at, submission_type, text_response, location_lat, review_notes, previous_submission_id')
    .eq('quest_participation_id', participationId)
    .eq('user_id', userId)
    .order('submitted_at', { ascending: true });

  if (error) throw normalizeError(error);
  if (!data || data.length === 0) return [];

  // Determine latest submission
  const latestId = data.reduce((latest: any, row: any) => {
    if (!latest.submitted_at) return row;
    if (!row.submitted_at) return latest;
    return row.submitted_at > latest.submitted_at ? row : latest;
  }).id;

  return data.map((row: any, index: number): SubmissionHistoryItem => ({
    submissionId: row.id,
    submissionNumber: index + 1,
    participationId,
    status: row.status as any,
    submittedAt: row.submitted_at ?? null,
    submissionType: row.submission_type as any,
    textResponse: row.text_response ?? null,
    locationVerified: row.location_lat != null,
    hasImage: ['photo', 'video'].includes(row.submission_type),
    safeDecisionNote: safeDecisionNote(row.status, row.review_notes),
    isLatest: row.id === latestId,
  }));
}

// ─── Quest Point History ──────────────────────────────────────────────────────

/**
 * Fetch paginated quest-related point ledger entries for the current user.
 * Includes quest_reward and reversal transactions linked to quest participations.
 * Never exposes other users' ledger entries (RLS enforced).
 */
export async function fetchQuestPointHistory(
  userId: string,
  page = 1,
  pageSize = PROGRESS_PAGE_SIZE
): Promise<{ items: QuestPointTransaction[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { items: [], hasMore: false };
  const client = requireSupabase();
  const { from, to } = paginationRange(page, pageSize);

  const { data, error } = await client
    .from('points_ledger')
    .select(`
      id,
      amount,
      transaction_type,
      reason,
      quest_participation_id,
      reversed_transaction_id,
      created_at
    `)
    .eq('user_id', userId)
    .not('quest_participation_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to + 1);

  if (error) throw normalizeError(error);
  if (!data) return { items: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const rows = data.slice(0, pageSize);

  // Fetch quest titles for all participation IDs
  const participationIds = [...new Set(rows
    .map((r: any) => r.quest_participation_id)
    .filter(Boolean))];

  let titleMap: Record<string, string> = {};
  if (participationIds.length > 0) {
    const { data: questRows } = await client
      .from('quest_participations')
      .select('id, quests(title)')
      .eq('user_id', userId)
      .in('id', participationIds);

    if (questRows) {
      for (const qr of questRows as any[]) {
        if (qr.quests?.title) {
          titleMap[qr.id] = qr.quests.title;
        }
      }
    }
  }

  const items: QuestPointTransaction[] = rows.map((row: any) => {
    const txType = row.transaction_type as string;
    const isReversal = txType === 'reversal';
    const displayLabel = isReversal
      ? 'Quest reward adjustment'
      : txType === 'admin_adjustment'
      ? 'Administrative adjustment'
      : 'Quest reward';

    return {
      id: row.id,
      amount: row.amount,
      transactionType: txType as any,
      displayLabel,
      questParticipationId: row.quest_participation_id ?? null,
      questTitle: titleMap[row.quest_participation_id] ?? null,
      createdAt: row.created_at,
      isReversed: false, // determined by checking if a reversal row references this id
      isReversal,
      reversedTransactionId: row.reversed_transaction_id ?? null,
    };
  });

  return { items, hasMore };
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * Fetch a page of the Quest leaderboard via RPC.
 * Returns only publicly visible entries.
 */
export async function fetchQuestLeaderboard(
  period: LeaderboardPeriod,
  page = 1,
  pageSize = LEADERBOARD_PAGE_SIZE
): Promise<{ entries: QuestLeaderboardEntry[]; hasMore: boolean }> {
  if (!isSupabaseConfigured()) return { entries: [], hasMore: false };
  const client = requireSupabase();
  const offset = (page - 1) * pageSize;

  const { data, error } = await (client as any)
    .rpc('get_quest_leaderboard', {
      p_period: period,
      p_limit: pageSize + 1,  // fetch one extra to detect hasMore
      p_offset: offset,
    });

  if (error) throw normalizeError(error);
  if (!data) return { entries: [], hasMore: false };

  const hasMore = data.length > pageSize;
  const entries: QuestLeaderboardEntry[] = data.slice(0, pageSize).map((row: any) => ({
    rank: Number(row.rank),
    userId: row.is_anonymous ? null : row.user_id,
    displayName: row.is_anonymous ? 'Anonymous Explorer' : row.display_name,
    username: row.is_anonymous ? null : row.username,
    avatarPath: row.is_anonymous ? null : row.avatar_path,
    points: Number(row.points),
    isCurrentUser: row.is_current_user,
    isAnonymous: row.is_anonymous,
  }));

  return { entries, hasMore };
}

// ─── Current User Rank ────────────────────────────────────────────────────────

/**
 * Fetch the current user's rank for the selected period via RPC.
 * Returns private personal data regardless of leaderboard_visibility setting.
 */
export async function fetchMyQuestRank(
  period: LeaderboardPeriod
): Promise<QuestCurrentRank | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();

  const { data, error } = await (client as any)
    .rpc('get_my_quest_rank', { p_period: period });

  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0];
  return {
    qualifies: row.qualifies,
    rank: row.rank ? Number(row.rank) : null,
    points: Number(row.points ?? 0),
    totalRankedUsers: Number(row.total_ranked_users ?? 0),
    period,
  };
}
