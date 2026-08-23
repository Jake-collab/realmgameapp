/**
 * Quest Completion Service — Worlds
 *
 * The authoritative completeQuest operation.
 *
 * This is the ONLY path that awards points for quest completion.
 * Points are inserted atomically with the completion status update.
 *
 * Rules:
 * - Points come from reward_snapshot_points (captured at start), not current quest value.
 * - The idempotency_key prevents double-awarding (DB unique constraint).
 * - Completion + point insert must be atomic (transaction or RPC).
 * - Users cannot call this directly — it must be invoked by trusted server logic.
 * - Mobile clients call this via a Supabase RPC (complete_quest) in production.
 *   Without a live DB, this service reports the operation as unavailable and
 *   never fabricates completion, points, or a local persisted record.
 *
 * Trust boundary: In production this logic runs server-side in an Edge Function.
 * The client-side implementation here is used for:
 *   a) Documentation of the completion contract
 *   b) Integration testing with a local Supabase instance
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  fetchParticipationById,
  fetchStepProgress,
} from '../repositories/quest.repository';
import { fetchCurrentProof } from '../repositories/proof.repository';
import { validateParticipationTransition } from '../stateMachine/participation.machine';
import { normalizeQuestError, makeQuestError } from '../utils/questErrors';
import { onQuestCompleted } from '../events/questEvents';
import { QUEST_COMPLETION_IDEMPOTENCY_FORMAT } from '../constants';
import type { QuestCompletionResult, QuestProgressHelpers } from '../types/quest.types';
import type { QuestObjectiveRow, QuestStepProgressRow } from '@/lib/supabase/database.types';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';

// ─── Completion input ─────────────────────────────────────────────────────────

export interface CompleteQuestInput {
  participationId: string;
  userId: string;
  /** Only pass for testing/admin — normally loaded from DB snapshot */
  awardedPointsOverride?: never;
}
// ─── Main operation ────────────────────────────────────────────────────────────

/**
 * Complete a quest and award points.
 *
 * Production path: call the `complete_quest` Supabase RPC which mirrors this logic
 * server-side with full transaction support.
 *
 * Without a live DB, completion is explicitly unavailable; no points or events
 * are generated locally.
 */
export async function completeQuest(input: CompleteQuestInput): Promise<QuestCompletionResult> {
  const { participationId, userId } = input;

  if (!isSupabaseConfigured()) {
    return failure(participationId, makeQuestError(
      'SERVICE_UNAVAILABLE',
      'Supabase is not configured; complete_quest cannot be verified or persisted.',
    ));
  }

  // ── Step 1: Load participation ────────────────────────────────────────────────
  let participation: QuestParticipationRowExtended | null;
  try {
    participation = await fetchParticipationById(participationId);
  } catch (err) {
    return failure(participationId, normalizeQuestError(err));
  }

  if (!participation) {
    return failure(participationId, makeQuestError('QUEST_NOT_FOUND'));
  }

  // ── Step 2: Ownership verification ───────────────────────────────────────────
  if (participation.user_id !== userId) {
    return failure(participationId, makeQuestError('NOT_ELIGIBLE', 'Ownership mismatch'));
  }

  // ── Step 3: Check if already completed (idempotent) ──────────────────────────
  if (participation.status === 'completed') {
    const awardedPoints = participation.reward_snapshot_points ?? participation.awarded_points ?? 0;
    return {
      success: true,
      participationId,
      awardedPoints,
      completedAt: participation.completed_at ?? new Date().toISOString(),
      wasAlreadyCompleted: true,
    };
  }

  // ── Step 4: Validate participation state ──────────────────────────────────────
  const transitionCheck = validateParticipationTransition(
    participation.status,
    'completed',
    true // trusted caller
  );
  if (!transitionCheck.allowed) {
    return failure(participationId, makeQuestError('INVALID_STATE_TRANSITION', transitionCheck.reason));
  }

  // ── Step 5: Verify all required steps complete ────────────────────────────────
  // (Quest detail needed to check objectives — skipped in dev/offline mode)
  // Production Edge Function will perform this check against the DB directly.

  // ── Step 6: Resolve reward amount from snapshot ───────────────────────────────
  const pointsToAward = participation.reward_snapshot_points;
  if (!pointsToAward || pointsToAward <= 0) {
    return failure(participationId, makeQuestError('SERVER_ERROR', 'Invalid reward snapshot'));
  }

  // ── Step 7: Build idempotency key ─────────────────────────────────────────────
  const idempotencyKey = QUEST_COMPLETION_IDEMPOTENCY_FORMAT.replace('{participationId}', participationId);

  // ── Step 8: Atomic completion + points insert ─────────────────────────────────
  // In production this is handled by the complete_quest Edge Function/RPC.
  const client = requireSupabase();

  const completedAt = new Date().toISOString();

  // Try server-side RPC first
  const { data: rpcResult, error: rpcError } = await client.rpc('complete_quest' as never, {
    p_participation_id: participationId,
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
  } as never);

  if (!rpcError && rpcResult) {
    const result = rpcResult as { awarded_points: number; completed_at: string };
    onQuestCompleted(userId, participation.quest_id, participationId, result.awarded_points);
    return {
      success: true,
      participationId,
      awardedPoints: result.awarded_points,
      completedAt: result.completed_at,
      wasAlreadyCompleted: false,
    };
  }

  return failure(
    participationId,
    normalizeQuestError(rpcError ?? new Error('Quest completion RPC unavailable'))
  );
}

// ─── Progress helpers ─────────────────────────────────────────────────────────

/**
 * Compute completion readiness from step progress.
 * Called by the active quest view to determine UI state.
 */
export function computeProgressHelpers(
  objectives: QuestObjectiveRow[],
  stepProgress: QuestStepProgressRow[]
): QuestProgressHelpers {
  const sorted = [...objectives].sort((a, b) => a.sort_order - b.sort_order);
  const required = sorted.filter(o => o.is_required);
  const optional = sorted.filter(o => o.is_optional);

  const progressMap = new Map(stepProgress.map(sp => [sp.quest_step_id, sp]));

  const completedRequired = required.filter(
    o => progressMap.get(o.id)?.status === 'completed'
  );

  const allRequiredDone = completedRequired.length === required.length;

  // First incomplete required step
  const currentStep = required.find(o => progressMap.get(o.id)?.status !== 'completed') ?? null;

  // Next step after current (including optional)
  const currentIdx = currentStep ? sorted.indexOf(currentStep) : sorted.length - 1;
  const nextStep = sorted[currentIdx + 1] ?? null;

  // Completion readiness
  let completionReadiness: QuestProgressHelpers['completionReadiness'];
  if (!allRequiredDone) {
    completionReadiness = 'steps_incomplete';
  } else {
    // Check if proof is required (determined by quest completion_mode — not available here)
    completionReadiness = 'ready';
  }

  // Progress percent: only show when measurable
  const progressPercent =
    required.length > 0
      ? Math.round((completedRequired.length / required.length) * 100)
      : null;

  return {
    requiredStepsCompleted: completedRequired.length,
    totalRequiredSteps: required.length,
    completionReadiness,
    currentStep: currentStep as unknown as import('../types/quest.types').QuestObjective | null,
    nextAvailableStep: nextStep as unknown as import('../types/quest.types').QuestObjective | null,
    progressPercent,
  };
}

// ─── Point reversal preparation ───────────────────────────────────────────────

/**
 * Prepare a point reversal entry (for admin use in future prompt).
 *
 * Rules:
 * - Never deletes the original ledger transaction.
 * - Creates an offsetting negative entry linked to the original.
 * - Only authorized admin callers may invoke this.
 * - The mobile client never exposes this.
 *
 * This function documents the reversal contract for Prompt 17 (admin panel).
 */
export function buildReversalLedgerEntry(params: {
  originalTransactionId: string;
  userId: string;
  originalAmount: number;
  reason: string;
  adminId: string;
}): {
  amount: number;
  transaction_type: 'reversal';
  source_type: string;
  reversed_transaction_id: string;
  reason: string;
  created_by: string;
  idempotency_key: string;
} {
  return {
    amount: params.originalAmount, // positive amount, transaction_type=reversal signals deduction
    transaction_type: 'reversal',
    source_type: 'admin',
    reversed_transaction_id: params.originalTransactionId,
    reason: params.reason,
    created_by: params.adminId,
    idempotency_key: `reversal:${params.originalTransactionId}:${params.adminId}`,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function failure(participationId: string, error: ReturnType<typeof makeQuestError>): QuestCompletionResult {
  return {
    success: false,
    participationId,
    awardedPoints: 0,
    completedAt: '',
    wasAlreadyCompleted: false,
    error,
  };
}

