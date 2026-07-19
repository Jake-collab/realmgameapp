/**
 * Quest Availability Service — Worlds
 *
 * One authoritative availability evaluator for quest + user combinations.
 * Called from Home, Quests list, Quest detail, and Map.
 * Never duplicate this logic across screens.
 *
 * Returns QuestAvailabilityResult — the single source of truth for
 * what action a user can take on a quest at any given moment.
 */

import type { QuestRowExtended } from '../repositories/quest.repository';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';
import type {
  QuestAvailabilityResult,
  QuestAvailabilityState,
  QuestOccurrence,
} from '../types/quest.types';
import type { EligibilityContext } from './questEligibility.service';
import { evaluateEligibilitySync } from './questEligibility.service';
import { isUpcoming, isAvailabilityExpired, isParticipationExpired, buildOccurrenceKey } from './questScheduling.service';

// ─── Main evaluator ────────────────────────────────────────────────────────────

export interface AvailabilityInput {
  quest: QuestRowExtended;
  context: EligibilityContext;
  /** Most recent active or completed participation for this quest/occurrence */
  existingParticipation?: QuestParticipationRowExtended | null;
  /** Most recent completed participation (for cooldown check) */
  lastCompletedParticipation?: QuestParticipationRowExtended | null;
  /** Current occurrence (for repeatable quests) */
  currentOccurrence?: QuestOccurrence | null;
  now?: Date;
}

/**
 * Evaluate the complete availability state for a quest + user.
 * Returns a structured result that drives UI state and available actions.
 *
 * Decision order:
 *  1. Active participation with status → map to availability state
 *  2. Paused / expired quest content → paused / expired
 *  3. Upcoming quest → upcoming
 *  4. Eligibility evaluation → ineligible + reason
 *  5. Fallback → available
 */
export function evaluateQuestAvailability(input: AvailabilityInput): QuestAvailabilityResult {
  const { quest, context, now = new Date() } = input;
  const participation = input.existingParticipation;

  // 1. If the user has an active participation, map its status directly
  if (participation) {
    const participationState = mapParticipationToAvailabilityState(participation, quest, now);
    if (participationState) {
      return {
        state: participationState,
        canStart: false,
        activeParticipationId: participation.id,
        availableFrom: quest.available_from ?? undefined,
        availableUntil: quest.available_until ?? undefined,
        occurrenceKey: participation.occurrence_key ?? undefined,
      };
    }
  }

  // 2. Quest content availability
  if (quest.status === 'paused') {
    return { state: 'paused', canStart: false };
  }
  if (['expired', 'archived'].includes(quest.status)) {
    return { state: 'expired', canStart: false };
  }
  if (isAvailabilityExpired(quest, now)) {
    return { state: 'expired', canStart: false };
  }

  // 3. Upcoming
  if (isUpcoming(quest, now)) {
    return {
      state: 'upcoming',
      canStart: false,
      availableFrom: quest.available_from ?? undefined,
    };
  }

  // 4. Eligibility (synchronous — prerequisites skipped here for performance)
  const eligibility = evaluateEligibilitySync(quest, context, {
    existingParticipation: participation,
    lastCompletedParticipation: input.lastCompletedParticipation ?? null,
    currentOccurrence: input.currentOccurrence,
    now,
  });

  if (!eligibility.eligible) {
    // Map specific eligibility codes to their availability states
    if (eligibility.reasonCode === 'ALREADY_COMPLETED') {
      return { state: 'completed', canStart: false, reasonCode: eligibility.reasonCode };
    }
    return {
      state: 'ineligible',
      canStart: false,
      reasonCode: eligibility.reasonCode,
      userMessage: eligibility.userMessage,
    };
  }

  // 5. Available — build occurrence key for start operation
  const occurrenceKey = buildOccurrenceKey(quest, now);
  return {
    state: 'available',
    canStart: true,
    availableFrom: quest.available_from ?? undefined,
    availableUntil: quest.available_until ?? undefined,
    occurrenceKey,
    currentOccurrenceId: input.currentOccurrence?.id,
  };
}

// ─── Batch evaluator ──────────────────────────────────────────────────────────

/**
 * Evaluate availability for multiple quests at once.
 * Used for list screens (Quests, Map) to avoid N+1 calls.
 */
export function evaluateQuestAvailabilityBatch(
  quests: QuestRowExtended[],
  context: EligibilityContext,
  participationsByQuestId: Map<string, QuestParticipationRowExtended>,
  now: Date = new Date()
): Map<string, QuestAvailabilityResult> {
  const results = new Map<string, QuestAvailabilityResult>();
  for (const quest of quests) {
    results.set(
      quest.id,
      evaluateQuestAvailability({
        quest,
        context,
        existingParticipation: participationsByQuestId.get(quest.id) ?? null,
        now,
      })
    );
  }
  return results;
}

// ─── Participation → availability state mapping ───────────────────────────────

function mapParticipationToAvailabilityState(
  participation: QuestParticipationRowExtended,
  quest: QuestRowExtended,
  now: Date
): QuestAvailabilityState | null {
  const { status, expires_at } = participation;

  // Check if participation has expired (regardless of status)
  if (isParticipationExpired(expires_at, now) && !['completed', 'rejected', 'abandoned', 'expired'].includes(status)) {
    // Participation has timed out — treat as expired
    return 'expired';
  }

  // Check hard expiration behavior: if quest content expired and behavior is hard,
  // active participations are also expired
  if (
    quest.expiration_behavior === 'hard' &&
    isAvailabilityExpired(quest, now) &&
    !['completed', 'rejected', 'abandoned', 'expired'].includes(status)
  ) {
    return 'expired';
  }

  switch (status) {
    case 'started':
    case 'in_progress':
      return 'active';
    case 'awaiting_proof':
      return 'awaiting_proof';
    case 'under_review':
      return 'under_review';
    case 'needs_resubmission':
      return 'needs_resubmission';
    case 'completed':
      return 'completed';
    case 'rejected':
      return 'ineligible'; // treated as ineligible after rejection (non-repeatable path)
    case 'abandoned':
    case 'expired':
      return null; // Fall through to availability evaluation — user can restart if eligible
    default:
      return null;
  }
}

// ─── Home screen selector ─────────────────────────────────────────────────────

/**
 * Select the single most important quest for the Home screen active panel.
 *
 * Priority order:
 * 1. needs_resubmission — most urgent
 * 2. active (started/in_progress)
 * 3. awaiting_proof
 * 4. under_review
 * 5. most recently touched active participation
 */
export function selectHomeActiveQuest(
  participations: QuestParticipationRowExtended[],
  quest: QuestRowExtended
): QuestParticipationRowExtended | null {
  const actives = participations.filter(p =>
    ['started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission'].includes(p.status)
  );

  if (actives.length === 0) return null;

  const priority: Record<string, number> = {
    needs_resubmission: 5,
    started: 4,
    in_progress: 4,
    awaiting_proof: 3,
    under_review: 2,
  };

  return actives.sort((a, b) => {
    const ap = priority[a.status] ?? 0;
    const bp = priority[b.status] ?? 0;
    if (ap !== bp) return bp - ap;
    // Same priority — most recently active first
    const aTime = a.last_progress_at ?? a.started_at;
    const bTime = b.last_progress_at ?? b.started_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  })[0] ?? null;
}
