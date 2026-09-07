import type { QuestStepProgressRow } from '@/lib/supabase/database.types';
import type { QuestWithRelations } from '@/features/quests/repositories/quest.repository';
import type { QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import { formatRemainingTimer, getQuestVerificationMethods } from '@/features/quests/utils/questVerification';

export interface QuestMapHudProgress {
  objective: { completed: number; total: number; percent: number | null };
  geo: { verified: number; total: number; percent: number | null };
  activity: { distanceMeters: number; targetMeters: number; percent: number | null };
  timer: { label: string; ready: boolean } | null;
  readiness: string;
  canShowProgressBar: boolean;
}

type HudQuest = Pick<
  QuestWithRelations,
  | 'verification_methods'
  | 'proof_type'
  | 'location_requirement_type'
  | 'required_distance_meters'
  | 'quest_objectives'
>;

type HudParticipation = Pick<
  QuestParticipationRowExtended,
  | 'status'
  | 'activity_distance_meters'
  | 'verification_earliest_completion_at'
>;

/**
 * Builds display-only progress from persisted/server-backed state.
 *
 * This intentionally does not combine different verification systems into one
 * percentage. A Quest can have complete objectives while still waiting on
 * GPS, activity, a timer, proof review, or integrity confirmation.
 */
export function buildQuestMapHudProgress(input: {
  quest: HudQuest;
  participation: HudParticipation;
  stepProgress: QuestStepProgressRow[];
  now?: number;
}): QuestMapHudProgress {
  const { quest, participation, stepProgress } = input;
  const methods = getQuestVerificationMethods(quest);
  const progressByStep = new Map(stepProgress.map(progress => [progress.quest_step_id, progress]));
  const requiredObjectives = (quest.quest_objectives ?? []).filter(objective => objective.is_required);
  const completedObjectives = requiredObjectives.filter(
    objective => progressByStep.get(objective.id)?.status === 'completed',
  ).length;
  const locationObjectives = requiredObjectives.filter(
    objective => objective.location_requirement_type !== 'none',
  );
  const verifiedLocations = locationObjectives.filter(
    objective => progressByStep.get(objective.id)?.status === 'completed',
  ).length;
  const distanceMeters = Math.max(0, Number(participation.activity_distance_meters ?? 0));
  const targetMeters = Math.max(0, Number(quest.required_distance_meters ?? 0));
  const timerLabel = formatRemainingTimer(
    participation.verification_earliest_completion_at ?? null,
    input.now,
  );

  const objective = {
    completed: completedObjectives,
    total: requiredObjectives.length,
    percent: requiredObjectives.length > 0
      ? Math.round((completedObjectives / requiredObjectives.length) * 100)
      : null,
  };
  const geo = {
    verified: verifiedLocations,
    total: locationObjectives.length,
    percent: locationObjectives.length > 0
      ? Math.round((verifiedLocations / locationObjectives.length) * 100)
      : null,
  };
  const activity = {
    distanceMeters,
    targetMeters,
    percent: targetMeters > 0
      ? Math.min(100, Math.round((distanceMeters / targetMeters) * 100))
      : null,
  };
  const timer = timerLabel
    ? { label: timerLabel, ready: timerLabel === 'Ready to complete' }
    : null;

  let readiness = 'Active — validation is server-checked';
  switch (participation.status) {
    case 'completed':
      readiness = 'Completed — points confirmed';
      break;
    case 'under_review':
      readiness = 'Under review — points are pending';
      break;
    case 'awaiting_proof':
      readiness = 'Proof required before completion';
      break;
    case 'needs_resubmission':
      readiness = 'Update proof to continue';
      break;
    default:
      if (methods.includes('activity_tracking') && activity.percent !== null && activity.percent < 100) {
        readiness = 'Activity in progress';
      } else if (timer && !timer.ready) {
        readiness = 'Timer running';
      } else if (objective.total > 0 && objective.completed < objective.total) {
        readiness = 'Objectives in progress';
      } else if (methods.includes('integrity_confirmation')) {
        readiness = 'Integrity confirmation required';
      } else if (
        objective.total > 0 ||
        geo.total > 0 ||
        activity.percent !== null ||
        (timer?.ready ?? false)
      ) {
        readiness = 'Ready for server validation';
      }
      break;
  }

  return {
    objective,
    geo,
    activity,
    timer,
    readiness,
    canShowProgressBar: objective.percent !== null || geo.percent !== null || activity.percent !== null,
  };
}

export function getFocusedActiveParticipation<T extends { quest_id: string }>(
  selectedQuestId: string | null | undefined,
  activeParticipations: T[],
): T | null {
  if (!selectedQuestId) return null;
  return activeParticipations.find(participation => participation.quest_id === selectedQuestId) ?? null;
}