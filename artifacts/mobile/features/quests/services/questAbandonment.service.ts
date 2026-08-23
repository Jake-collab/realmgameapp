/**
 * Quest Abandonment Service — Worlds
 *
 * Implements the abandonQuest domain operation.
 *
 * Rules:
 * - Only the participation owner may abandon.
 * - Completed participation cannot be abandoned.
 * - Under-review proof is orphaned (not deleted) when abandoned.
 * - History is preserved — no deletes.
 * - No points are awarded.
 * - User must confirm at the UI layer before calling.
 */

import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchParticipationById, updateParticipationStatus } from '../repositories/quest.repository';
import { canAbandon, isParticipationTerminal } from '../stateMachine/participation.machine';
import { normalizeQuestError, makeQuestError } from '../utils/questErrors';
import { onQuestAbandoned } from '../events/questEvents';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AbandonQuestInput {
  participationId: string;
  userId: string;
}

export interface AbandonQuestResult {
  success: boolean;
  participation: QuestParticipationRowExtended | null;
  error?: ReturnType<typeof makeQuestError>;
}

// ─── Main operation ────────────────────────────────────────────────────────────

export async function abandonQuest(input: AbandonQuestInput): Promise<AbandonQuestResult> {
  const { participationId, userId } = input;

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      participation: null,
      error: makeQuestError(
        'SERVICE_UNAVAILABLE',
        'Supabase is not configured; abandonment cannot be persisted.',
      ),
    };
  }

  // ── Load participation ──────────────────────────────────────────────────────
  let participation: QuestParticipationRowExtended | null;
  try {
    participation = await fetchParticipationById(participationId);
  } catch (err) {
    return { success: false, participation: null, error: normalizeQuestError(err) };
  }

  if (!participation) {
    return { success: false, participation: null, error: makeQuestError('QUEST_NOT_FOUND') };
  }

  // ── Ownership check ─────────────────────────────────────────────────────────
  if (participation.user_id !== userId) {
    return { success: false, participation: null, error: makeQuestError('NOT_ELIGIBLE', 'Ownership mismatch') };
  }

  // ── Terminal state check ────────────────────────────────────────────────────
  if (isParticipationTerminal(participation.status)) {
    if (participation.status === 'completed') {
      return { success: false, participation, error: makeQuestError('ALREADY_COMPLETED') };
    }
    return { success: false, participation, error: makeQuestError('INVALID_STATE_TRANSITION') };
  }

  // ── Transition validation ────────────────────────────────────────────────────
  if (!canAbandon(participation.status)) {
    return { success: false, participation, error: makeQuestError('INVALID_STATE_TRANSITION') };
  }

  // ── Under-review proof handling ─────────────────────────────────────────────
  // If participation is under_review, abandonment is blocked by the transition guard
  // (under_review does not have abandoned in its allowed transitions).
  // This is intentional: the proof review must complete or be rejected first.

  // ── Abandon ──────────────────────────────────────────────────────────────────
  try {
    const updated = await updateParticipationStatus(participationId, {
      status: 'abandoned',
      abandoned_at: new Date().toISOString(),
    });

    onQuestAbandoned(userId, participation.quest_id, participationId);

    return { success: true, participation: updated };
  } catch (err) {
    return { success: false, participation: null, error: normalizeQuestError(err) };
  }
}

// ─── Expiration service ───────────────────────────────────────────────────────

export interface ExpireParticipationInput {
  participationId: string;
  userId: string;
  questId: string;
}

export interface ExpireParticipationResult {
  success: boolean;
  participation: QuestParticipationRowExtended | null;
  error?: ReturnType<typeof makeQuestError>;
}

/**
 * Mark a participation as expired.
 * Called when query-time evaluation detects the deadline has passed.
 * This is client-side detection; a server-side scheduled job will do batch expiry later.
 *
 * Rules:
 * - Only non-terminal participations can be expired.
 * - History is preserved.
 * - No points are awarded.
 */
export async function expireParticipation(
  input: ExpireParticipationInput
): Promise<ExpireParticipationResult> {
  const { participationId, userId, questId } = input;

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      participation: null,
      error: makeQuestError(
        'SERVICE_UNAVAILABLE',
        'Supabase is not configured; expiration cannot be persisted.',
      ),
    };
  }

  let participation: QuestParticipationRowExtended | null;
  try {
    participation = await fetchParticipationById(participationId);
  } catch (err) {
    return { success: false, participation: null, error: normalizeQuestError(err) };
  }

  if (!participation || participation.user_id !== userId) {
    return { success: false, participation: null, error: makeQuestError('QUEST_NOT_FOUND') };
  }

  if (isParticipationTerminal(participation.status)) {
    // Already in terminal state — nothing to do
    return { success: true, participation };
  }

  try {
    const updated = await updateParticipationStatus(participationId, { status: 'expired' });
    // No points awarded on expiry
    return { success: true, participation: updated };
  } catch (err) {
    return { success: false, participation: null, error: normalizeQuestError(err) };
  }
}
