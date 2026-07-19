/**
 * Quest Start Service — Worlds
 *
 * Implements the idempotent startQuest domain operation.
 *
 * Flow:
 *  1. Confirm authenticated user + active account
 *  2. Load quest
 *  3. Evaluate eligibility (full async check)
 *  4. Check for existing active participation (idempotency)
 *  5. Check repeatability and prior completion (with occurrence key)
 *  6. Create participation record with reward snapshot
 *  7. Set started_at and expiration
 *  8. Initialize step progress records
 *  9. Emit analytics event
 * 10. Return active participation + first objective
 *
 * Rules:
 * - Idempotent: repeated calls return existing active participation.
 * - Does NOT award points at start.
 * - Does NOT allow starting draft, expired, or paused quests.
 * - Protected fields cannot be set by the client.
 */

import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { QuestObjectiveRow } from '@/lib/supabase/database.types';
import {
  fetchQuestById,
  fetchUserParticipation,
  fetchParticipationByOccurrenceKey,
  fetchUserParticipationHistory,
  insertParticipation,
  initializeStepProgress,
  type QuestParticipationRowExtended,
} from '../repositories/quest.repository';
import { evaluateQuestEligibility, type EligibilityContext } from './questEligibility.service';
import { calculateParticipationExpiry, buildOccurrenceKey } from './questScheduling.service';
import { makeQuestError, makeEligibilityError, normalizeQuestError } from '../utils/questErrors';
import { onQuestStartAttempted, onQuestStarted } from '../events/questEvents';
import type { QuestStartResult } from '../types/quest.types';

// ─── Main operation ────────────────────────────────────────────────────────────

export interface StartQuestInput {
  questId: string;
  context: EligibilityContext;
  /** Override occurrence key (for admin/test use only) */
  occurrenceKeyOverride?: string;
}

/**
 * Start a quest for the authenticated user.
 * This operation is idempotent — repeated calls return the existing active participation.
 */
export async function startQuest(input: StartQuestInput): Promise<QuestStartResult> {
  const { questId, context } = input;
  const now = new Date();

  // ── Step 1: Authentication guard ─────────────────────────────────────────────
  if (!context.userId || !context.profile) {
    const error = makeQuestError('ACCOUNT_RESTRICTED', 'User not authenticated');
    onQuestStartAttempted(context.userId ?? 'anonymous', questId, false, 'NOT_AUTHENTICATED');
    return { success: false, participation: null, firstObjective: null, wasExisting: false, error };
  }

  if (!isSupabaseConfigured()) {
    // Dev mode: return a mock participation
    return buildDevModeResult(questId, context.userId);
  }

  // ── Step 2: Load quest ────────────────────────────────────────────────────────
  let questData: Awaited<ReturnType<typeof fetchQuestById>>;
  try {
    questData = await fetchQuestById(questId);
  } catch (err) {
    const error = normalizeQuestError(err);
    return { success: false, participation: null, firstObjective: null, wasExisting: false, error };
  }

  if (!questData) {
    const error = makeQuestError('QUEST_NOT_FOUND');
    return { success: false, participation: null, firstObjective: null, wasExisting: false, error };
  }

  const quest = questData;

  // ── Step 3: Build occurrence key ──────────────────────────────────────────────
  const occurrenceKey = input.occurrenceKeyOverride ?? buildOccurrenceKey(quest, now);

  // ── Step 4: Idempotency — check for existing active participation ─────────────
  let existingParticipation: QuestParticipationRowExtended | null = null;
  try {
    if (quest.is_repeatable) {
      existingParticipation = await fetchParticipationByOccurrenceKey(context.userId, occurrenceKey);
    } else {
      existingParticipation = await fetchUserParticipation(context.userId, questId);
    }
  } catch (err) {
    const error = normalizeQuestError(err);
    return { success: false, participation: null, firstObjective: null, wasExisting: false, error };
  }

  // If there's an active participation for this quest/occurrence, return it (idempotent)
  if (existingParticipation) {
    const { status } = existingParticipation;
    if (['started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission'].includes(status)) {
      const objectives = quest.quest_objectives ?? [];
      const firstObjective = objectives.sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
      return {
        success: true,
        participation: existingParticipation,
        firstObjective: firstObjective as QuestObjectiveRow | null,
        wasExisting: true,
      };
    }
  }

  // ── Step 5: Load last completion for eligibility check ────────────────────────
  let lastCompletedParticipation: QuestParticipationRowExtended | null = null;
  try {
    const history = await fetchUserParticipationHistory(context.userId, questId);
    lastCompletedParticipation = history.find(p => p.status === 'completed') ?? null;
  } catch {
    // Non-fatal — proceed without history
  }

  // ── Step 6: Full eligibility evaluation ───────────────────────────────────────
  onQuestStartAttempted(context.userId, questId, true, undefined);

  const eligibility = await evaluateQuestEligibility({
    quest,
    context,
    now,
    existingParticipation,
    lastCompletedParticipation,
    currentOccurrence: null, // occurrence table checked separately in future
  });

  if (!eligibility.eligible) {
    onQuestStartAttempted(context.userId, questId, false, eligibility.reasonCode);
    const error = makeEligibilityError(eligibility.reasonCode, {
      cooldownRemainingSeconds: eligibility.cooldownRemainingSeconds,
    });
    return { success: false, participation: null, firstObjective: null, wasExisting: false, error };
  }

  // ── Step 7: Create participation record ───────────────────────────────────────
  const expiresAt = calculateParticipationExpiry(quest, now);
  // Reward snapshot: copy current quest points_reward at start time
  const rewardSnapshot = quest.points_reward;

  let participation: QuestParticipationRowExtended;
  try {
    participation = await insertParticipation({
      quest_id: questId,
      user_id: context.userId,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      reward_snapshot_points: rewardSnapshot,
      ...(quest.is_repeatable ? { occurrence_key: occurrenceKey } : {}),
    });
  } catch (err) {
    // Handle unique constraint violation (duplicate start attempt)
    const domainErr = normalizeQuestError(err);
    if (domainErr.code === 'REWARD_ALREADY_ISSUED') {
      // Race condition: another request created participation simultaneously
      // Try to fetch it
      try {
        const raceParticipation = quest.is_repeatable
          ? await fetchParticipationByOccurrenceKey(context.userId, occurrenceKey)
          : await fetchUserParticipation(context.userId, questId);
        if (raceParticipation) {
          const objectives = quest.quest_objectives ?? [];
          const firstObjective = objectives.sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
          return {
            success: true,
            participation: raceParticipation,
            firstObjective: firstObjective as QuestObjectiveRow | null,
            wasExisting: true,
          };
        }
      } catch {
        // Fall through to original error
      }
    }
    return { success: false, participation: null, firstObjective: null, wasExisting: false, error: domainErr };
  }

  // ── Step 8: Initialize step progress ─────────────────────────────────────────
  const objectives = (quest.quest_objectives ?? []) as QuestObjectiveRow[];
  const requiredObjectives = objectives.filter(obj => obj.is_required);
  try {
    await initializeStepProgress(participation.id, requiredObjectives);
  } catch {
    // Non-fatal: step progress can be created lazily
    if (__DEV__) {
      console.warn('[QuestStart] Step progress initialization failed for participation', participation.id);
    }
  }

  // ── Step 9: Emit event ────────────────────────────────────────────────────────
  onQuestStarted(context.userId, questId, participation.id, occurrenceKey);

  // ── Step 10: Return result ────────────────────────────────────────────────────
  const sortedObjectives = objectives.sort((a, b) => a.sort_order - b.sort_order);
  const firstObjective = sortedObjectives[0] ?? null;

  return {
    success: true,
    participation,
    firstObjective: firstObjective as QuestObjectiveRow | null,
    wasExisting: false,
  };
}

// ─── Dev mode fallback ────────────────────────────────────────────────────────

function buildDevModeResult(questId: string, userId: string): QuestStartResult {
  const now = new Date().toISOString();
  const mockParticipation: QuestParticipationRowExtended = {
    id: 'dev-participation-' + Math.random().toString(36).slice(2, 8),
    quest_id: questId,
    user_id: userId,
    status: 'started',
    started_at: now,
    last_progress_at: null,
    submitted_at: null,
    completed_at: null,
    abandoned_at: null,
    expires_at: null,
    awarded_points: null,
    reward_snapshot_points: 100,
    occurrence_key: null,
    completion_version: 1,
    created_at: now,
    updated_at: now,
  };

  return {
    success: true,
    participation: mockParticipation,
    firstObjective: null,
    wasExisting: false,
  };
}
