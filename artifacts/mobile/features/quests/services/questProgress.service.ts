/**
 * Quest Progress Service — Worlds
 *
 * Manages step-level progress within an active quest participation.
 *
 * Rules:
 * - Users may update only their own participation (enforced by RLS).
 * - Users may NOT directly approve a step.
 * - Users may NOT set protected location validation results.
 * - Users may NOT mark proof-required steps completed without approved proof.
 * - Step completion is idempotent.
 * - Completion timestamps are server-generated where practical.
 */

import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  fetchParticipationById,
  fetchQuestById,
  fetchStepProgress,
  upsertStepProgress,
  updateParticipationStatus,
  type QuestParticipationRowExtended,
} from '../repositories/quest.repository';
import { normalizeQuestError, makeQuestError } from '../utils/questErrors';
import { onStepCompleted } from '../events/questEvents';
import { canSubmitProof } from '../stateMachine/participation.machine';
import { computeProgressHelpers } from './questCompletion.service';
import type { QuestObjectiveRow, QuestStepProgressRow } from '@/lib/supabase/database.types';

// ─── Step progress operations ─────────────────────────────────────────────────

export interface BeginStepInput {
  participationId: string;
  stepId: string;
  userId: string;
}

export interface BeginStepResult {
  success: boolean;
  stepProgress: QuestStepProgressRow | null;
  error?: ReturnType<typeof makeQuestError>;
}

/**
 * Mark a step as in_progress.
 * Used when a user begins working on a specific objective.
 */
export async function beginStep(input: BeginStepInput): Promise<BeginStepResult> {
  const { participationId, stepId, userId } = input;

  if (!isSupabaseConfigured()) {
    return { success: false, stepProgress: null, error: unavailableError('Step progress cannot be saved.') };
  }

  // Verify ownership via participation load
  const participation = await safeLoadParticipation(participationId, userId);
  if (!participation.ok) return { success: false, stepProgress: null, error: participation.error };

  if (!canSubmitProof(participation.data.status)) {
    return { success: false, stepProgress: null, error: makeQuestError('INVALID_STATE_TRANSITION') };
  }

  try {
    const progress = await upsertStepProgress(participationId, stepId, {
      status: 'in_progress',
    });
    return { success: true, stepProgress: progress };
  } catch (err) {
    return { success: false, stepProgress: null, error: normalizeQuestError(err) };
  }
}

/**
 * Complete a simple auto-validated step (no proof required, no location check).
 * Steps with proof_type='none' and completion_rule='manual' can be completed by the user.
 *
 * Steps with proof_type ≠ 'none' MUST NOT use this — they require proof approval.
 */
export interface CompleteSimpleStepInput {
  participationId: string;
  stepId: string;
  userId: string;
  objective: QuestObjectiveRow;
  notes?: string;
  progressValue?: Record<string, unknown>;
}

export interface CompleteSimpleStepResult {
  success: boolean;
  stepProgress: QuestStepProgressRow | null;
  /** Readiness result after this step completion */
  readiness?: { allRequiredDone: boolean; progressPercent: number | null };
  error?: ReturnType<typeof makeQuestError>;
}

export async function completeSimpleStep(input: CompleteSimpleStepInput): Promise<CompleteSimpleStepResult> {
  const { participationId, stepId, userId, objective } = input;

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      stepProgress: null,
      error: unavailableError('Step completion cannot be saved.'),
    };
  }

  const participation = await safeLoadParticipation(participationId, userId);
  if (!participation.ok) return { success: false, stepProgress: null, error: participation.error };

  const trustedObjective = await loadTrustedObjective(participation.data.quest_id, stepId);
  if (!trustedObjective) {
    return { success: false, stepProgress: null, error: makeQuestError('NOT_ELIGIBLE', 'Step does not belong to this quest') };
  }

  // Guard: only trusted none-proof steps can be self-completed by client.
  if (!isClientObjectiveCompatible(objective, trustedObjective)) {
    return {
      success: false,
      stepProgress: null,
      error: makeQuestError('PROOF_REQUIRED', 'This step requires proof before completion'),
    };
  }

  // Guard: location-required steps validated server-side
  if (trustedObjective.location_requirement_type !== 'none') {
    return {
      success: false,
      stepProgress: null,
      error: makeQuestError('LOCATION_VALIDATION_FAILED', 'Location steps require server validation'),
    };
  }

  try {
    const progress = await upsertStepProgress(participationId, stepId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.progressValue ? { progress_value: input.progressValue } : {}),
    });

    onStepCompleted(userId, participation.data.quest_id, participationId, stepId);

    // Update participation status to in_progress if still started
    if (participation.data.status === 'started') {
      await updateParticipationStatus(participationId, {
        status: 'in_progress',
        last_progress_at: new Date().toISOString(),
      }).catch(() => {
        // Non-fatal — participation will still have correct step data
      });
    }

    return { success: true, stepProgress: progress };
  } catch (err) {
    return { success: false, stepProgress: null, error: normalizeQuestError(err) };
  }
}

/**
 * Skip an optional step.
 */
export async function skipOptionalStep(
  participationId: string,
  stepId: string,
  userId: string,
  objective: QuestObjectiveRow
): Promise<BeginStepResult> {
  if (!objective.is_optional) {
    return { success: false, stepProgress: null, error: makeQuestError('INVALID_STATE_TRANSITION') };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, stepProgress: null, error: unavailableError('Step skipping cannot be saved.') };
  }

  const participation = await safeLoadParticipation(participationId, userId);
  if (!participation.ok) return { success: false, stepProgress: null, error: participation.error };
  if (!canSubmitProof(participation.data.status)) {
    return { success: false, stepProgress: null, error: makeQuestError('INVALID_STATE_TRANSITION') };
  }
  const trustedObjective = await loadTrustedObjective(participation.data.quest_id, stepId);
  if (!trustedObjective || !trustedObjective.is_optional) {
    return { success: false, stepProgress: null, error: makeQuestError('NOT_ELIGIBLE', 'Step is not an optional step for this quest') };
  }

  try {
    const progress = await upsertStepProgress(participationId, stepId, { status: 'skipped' });
    return { success: true, stepProgress: progress };
  } catch (err) {
    return { success: false, stepProgress: null, error: normalizeQuestError(err) };
  }
}

// ─── Readiness check ──────────────────────────────────────────────────────────

/**
 * Check whether all required steps are complete and the quest can be submitted.
 * Used to show/hide the "Submit" or "Complete Quest" button.
 */
export async function checkCompletionReadiness(
  participationId: string,
  objectives: QuestObjectiveRow[]
): Promise<{
  allRequiredDone: boolean;
  progressPercent: number | null;
  helpers: ReturnType<typeof computeProgressHelpers>;
}> {
  if (!isSupabaseConfigured()) {
    return {
      allRequiredDone: false,
      progressPercent: null,
      helpers: {
        requiredStepsCompleted: 0,
        totalRequiredSteps: objectives.filter(o => o.is_required).length,
        completionReadiness: 'steps_incomplete',
        currentStep: null,
        nextAvailableStep: null,
        progressPercent: null,
      },
    };
  }

  const stepProgress = await fetchStepProgress(participationId);
  const helpers = computeProgressHelpers(objectives, stepProgress);

  return {
    allRequiredDone: helpers.requiredStepsCompleted >= helpers.totalRequiredSteps,
    progressPercent: helpers.progressPercent,
    helpers,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeLoadParticipation(
  participationId: string,
  userId: string
): Promise<
  | { ok: true; data: QuestParticipationRowExtended }
  | { ok: false; error: ReturnType<typeof makeQuestError> }
> {
  try {
    const participation = await fetchParticipationById(participationId);
    if (!participation) {
      return { ok: false, error: makeQuestError('QUEST_NOT_FOUND') };
    }
    if (!isParticipationOwner(participation, userId)) {
      return { ok: false, error: makeQuestError('NOT_ELIGIBLE', 'Ownership mismatch') };
    }
    return { ok: true, data: participation };
  } catch (err) {
    return { ok: false, error: normalizeQuestError(err) };
  }
}

function unavailableError(action: string) {
  return makeQuestError('SERVICE_UNAVAILABLE', `Supabase is not configured; ${action}`);
}

async function loadTrustedObjective(questId: string, stepId: string): Promise<QuestObjectiveRow | null> {
  try {
    const quest = await fetchQuestById(questId);
    return quest?.quest_objectives.find((candidate) => candidate.id === stepId) ?? null;
  } catch {
    return null;
  }
}

export function isParticipationOwner(
  participation: Pick<QuestParticipationRowExtended, 'user_id'>,
  userId: string,
): boolean {
  return participation.user_id === userId;
}

/**
 * Client metadata may be used for display, but security-sensitive rules must
 * match the Quest row fetched from Supabase before a write is attempted.
 */
export function isClientObjectiveCompatible(
  clientObjective: QuestObjectiveRow,
  trustedObjective: QuestObjectiveRow,
): boolean {
  return clientObjective.id === trustedObjective.id
    && clientObjective.quest_id === trustedObjective.quest_id
    && clientObjective.proof_type === trustedObjective.proof_type
    && clientObjective.location_requirement_type === trustedObjective.location_requirement_type
    && clientObjective.completion_rule === trustedObjective.completion_rule
    && clientObjective.is_required === trustedObjective.is_required
    && clientObjective.is_optional === trustedObjective.is_optional
    && clientObjective.completion_mode === trustedObjective.completion_mode;
}
