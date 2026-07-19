/**
 * Quest Eligibility Service — Worlds
 *
 * One centralized evaluator for whether a user can start a specific quest.
 * Called by the availability evaluator, start service, and UI guards.
 *
 * Returns structured reason codes — never raw SQL or policy names.
 *
 * Checks (in order):
 *  1. Authentication
 *  2. Account status
 *  3. Onboarding completion
 *  4. Quest publication status
 *  5. Quest availability window (scheduling)
 *  6. Quest paused state
 *  7. Location permission (for geo quests)
 *  8. Prerequisite quest completion
 *  9. Existing active participation
 * 10. Completed non-repeatable quest
 * 11. Repeat cooldown
 * 12. Occurrence availability (repeatable quests)
 */

import type { ProfileRow, QuestParticipationRow } from '@/lib/supabase/database.types';
import type { QuestRowExtended } from '../repositories/quest.repository';
import type { QuestOccurrence, QuestPrerequisite, QuestEligibilityResult } from '../types/quest.types';
import { isWithinAvailabilityWindow, isUpcoming, checkRepeatCooldown } from './questScheduling.service';
import { fetchQuestPrerequisites } from '../repositories/quest.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';

// ─── User context (provided by AuthProvider / profile hook) ───────────────────

export interface EligibilityContext {
  /** Authenticated user ID. Null = not authenticated. */
  userId: string | null;
  /** Profile data including account_status and onboarding_status */
  profile: Pick<ProfileRow, 'account_status' | 'onboarding_status'> | null;
  /** Whether the user has granted location permission on their device */
  hasLocationPermission: boolean;
  /** User's current approximate coordinates (for geo availability) */
  userLat?: number;
  userLng?: number;
  /**
   * Map of questId → completed participations (preloaded to avoid N+1 queries).
   * If omitted, prerequisite checks are skipped with a warning.
   */
  completedQuestIds?: Set<string>;
  /**
   * The user's total point balance (for future point-threshold prerequisites).
   */
  userTotalPoints?: number;
}

// ─── Eligibility evaluator ────────────────────────────────────────────────────

export interface FullEligibilityInput {
  quest: QuestRowExtended;
  context: EligibilityContext;
  now?: Date;
  /** Most recent participation for this quest/occurrence (preloaded) */
  existingParticipation?: QuestParticipationRow | null;
  /** Most recent completed participation for cooldown checking */
  lastCompletedParticipation?: QuestParticipationRow | null;
  /** Current occurrence (for repeatable quest uniqueness check) */
  currentOccurrence?: QuestOccurrence | null;
  /** Preloaded prerequisites (skip DB call if already fetched) */
  prerequisites?: QuestPrerequisite[];
}

/**
 * Evaluate full eligibility for a user to start a quest.
 * Returns a structured result with a reason code and user message.
 */
export async function evaluateQuestEligibility(
  input: FullEligibilityInput
): Promise<QuestEligibilityResult> {
  const { quest, context, now = new Date() } = input;

  // 1. Authentication
  if (!context.userId || !context.profile) {
    return ineligible('NOT_AUTHENTICATED', 'Sign in to start quests.');
  }

  // 2. Account status
  const { account_status, onboarding_status } = context.profile;
  if (account_status === 'suspended' || account_status === 'deactivated') {
    return ineligible('ACCOUNT_SUSPENDED', "Your account doesn't have access right now.");
  }
  if (account_status === 'restricted') {
    return ineligible('ACCOUNT_RESTRICTED', 'Your account is restricted. Contact support.');
  }

  // 3. Onboarding
  if (onboarding_status !== 'completed') {
    return ineligible('ONBOARDING_INCOMPLETE', 'Complete onboarding to start quests.');
  }

  // 4. Publication status
  if (quest.status !== 'published') {
    if (quest.status === 'paused') {
      return ineligible('QUEST_PAUSED', 'This quest is temporarily unavailable.');
    }
    if (quest.status === 'expired' || quest.status === 'archived') {
      return ineligible('QUEST_EXPIRED', 'This quest has ended.');
    }
    return ineligible('QUEST_NOT_PUBLISHED', "This quest isn't available yet.");
  }

  // 5. Availability window
  if (isUpcoming(quest, now)) {
    return ineligible(
      'QUEST_NOT_STARTED_YET',
      quest.available_from
        ? `This quest starts ${new Date(quest.available_from).toLocaleDateString()}.`
        : 'This quest is not yet available.'
    );
  }
  if (!isWithinAvailabilityWindow(quest, now)) {
    return ineligible('QUEST_EXPIRED', 'This quest has ended.');
  }

  // 6. Location permission (geo quests)
  if (quest.quest_type === 'geo' && quest.location_requirement_type !== 'none') {
    if (!context.hasLocationPermission) {
      return ineligible(
        'LOCATION_PERMISSION_REQUIRED',
        'This quest requires location access. Enable it in Settings.'
      );
    }
  }

  // 7. Prerequisites
  const prerequisites = input.prerequisites ?? await loadPrerequisites(quest.id);
  const prereqResult = evaluatePrerequisites(prerequisites, context);
  if (!prereqResult.eligible) return prereqResult;

  // 8. Existing active participation
  if (input.existingParticipation) {
    const { status } = input.existingParticipation;
    if (['started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission'].includes(status)) {
      return {
        eligible: false,
        reasonCode: 'ACTIVE_PARTICIPATION_EXISTS',
        userMessage: "You're already working on this quest.",
        activeParticipationId: input.existingParticipation.id,
      };
    }
  }

  // 9 & 10. Completions and repeatability
  if (input.lastCompletedParticipation) {
    if (!quest.is_repeatable) {
      // Non-repeatable: completed once = done forever
      return ineligible('ALREADY_COMPLETED', "You've already completed this quest.");
    }

    // Repeatable with cooldown
    if (quest.repeat_cooldown_hours && quest.repeat_cooldown_hours > 0) {
      const cooldown = checkRepeatCooldown(
        input.lastCompletedParticipation.completed_at ?? input.lastCompletedParticipation.created_at,
        quest.repeat_cooldown_hours,
        now
      );
      if (cooldown.onCooldown) {
        return {
          eligible: false,
          reasonCode: 'REPEAT_COOLDOWN',
          userMessage: 'This quest is on cooldown. Try again later.',
          cooldownRemainingSeconds: cooldown.remainingSeconds,
        };
      }
    }

    // Repeatable with occurrence tracking: check if current occurrence is already completed
    if (input.currentOccurrence) {
      const alreadyDoneThisOccurrence =
        input.existingParticipation?.status === 'completed' &&
        (input.existingParticipation as { occurrence_key?: string }).occurrence_key ===
          input.currentOccurrence.occurrence_key;
      if (alreadyDoneThisOccurrence) {
        return ineligible('ALREADY_COMPLETED', "You've completed today's quest. Come back tomorrow!");
      }
    }
  }

  // 11. Occurrence availability check (for repeatable quests using occurrence table)
  if (quest.is_repeatable && input.currentOccurrence === null) {
    // No current occurrence means no active instance for repeatable quest
    return ineligible('NO_OCCURRENCE_AVAILABLE', 'No active occurrence for this quest right now.');
  }

  return {
    eligible: true,
    reasonCode: 'ELIGIBLE',
    userMessage: '',
  };
}

// ─── Pure eligibility (synchronous, no DB calls) ──────────────────────────────

/**
 * Lightweight synchronous eligibility check — no DB calls.
 * Use when you already have all the data loaded.
 * Does NOT check prerequisites (requires async).
 */
export function evaluateEligibilitySync(
  quest: QuestRowExtended,
  context: EligibilityContext,
  options: {
    existingParticipation?: QuestParticipationRow | null;
    lastCompletedParticipation?: QuestParticipationRow | null;
    currentOccurrence?: QuestOccurrence | null;
    now?: Date;
  } = {}
): QuestEligibilityResult {
  const now = options.now ?? new Date();

  if (!context.userId || !context.profile) {
    return ineligible('NOT_AUTHENTICATED', 'Sign in to start quests.');
  }

  const { account_status, onboarding_status } = context.profile;

  if (account_status === 'suspended' || account_status === 'deactivated') {
    return ineligible('ACCOUNT_SUSPENDED', "Your account doesn't have access right now.");
  }
  if (account_status === 'restricted') {
    return ineligible('ACCOUNT_RESTRICTED', 'Your account is restricted.');
  }
  if (onboarding_status !== 'completed') {
    return ineligible('ONBOARDING_INCOMPLETE', 'Complete onboarding to start quests.');
  }
  if (quest.status === 'paused') {
    return ineligible('QUEST_PAUSED', 'This quest is temporarily unavailable.');
  }
  if (['expired', 'archived'].includes(quest.status)) {
    return ineligible('QUEST_EXPIRED', 'This quest has ended.');
  }
  if (quest.status !== 'published') {
    return ineligible('QUEST_NOT_PUBLISHED', "This quest isn't available yet.");
  }
  if (isUpcoming(quest, now)) {
    return ineligible('QUEST_NOT_STARTED_YET', 'This quest is not yet available.');
  }
  if (!isWithinAvailabilityWindow(quest, now)) {
    return ineligible('QUEST_EXPIRED', 'This quest has ended.');
  }
  if (quest.quest_type === 'geo' && !context.hasLocationPermission) {
    return ineligible('LOCATION_PERMISSION_REQUIRED', 'Enable location access to start this quest.');
  }

  const activeParticipation = options.existingParticipation;
  if (activeParticipation) {
    const { status } = activeParticipation;
    if (['started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission'].includes(status)) {
      return {
        eligible: false,
        reasonCode: 'ACTIVE_PARTICIPATION_EXISTS',
        userMessage: "You're already working on this quest.",
        activeParticipationId: activeParticipation.id,
      };
    }
  }

  if (options.lastCompletedParticipation && !quest.is_repeatable) {
    return ineligible('ALREADY_COMPLETED', "You've already completed this quest.");
  }

  return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
}

// ─── Prerequisite evaluation ──────────────────────────────────────────────────

function evaluatePrerequisites(
  prerequisites: QuestPrerequisite[],
  context: EligibilityContext
): QuestEligibilityResult {
  if (prerequisites.length === 0) {
    return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
  }

  for (const prereq of prerequisites) {
    if (prereq.prerequisite_type === 'quest_completion') {
      if (!prereq.required_quest_id) continue;
      if (!context.completedQuestIds?.has(prereq.required_quest_id)) {
        return ineligible('PREREQUISITE_NOT_MET', 'Complete a required quest first.');
      }
    }
    if (prereq.prerequisite_type === 'minimum_points') {
      if (prereq.minimum_points !== null) {
        const userPoints = context.userTotalPoints ?? 0;
        if (userPoints < prereq.minimum_points) {
          return ineligible(
            'PREREQUISITE_NOT_MET',
            `You need at least ${prereq.minimum_points} points to start this quest.`
          );
        }
      }
    }
    // achievement prerequisites evaluated in future prompt
  }

  return { eligible: true, reasonCode: 'ELIGIBLE', userMessage: '' };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ineligible(
  reasonCode: QuestEligibilityResult['reasonCode'],
  userMessage: string
): QuestEligibilityResult {
  return { eligible: false, reasonCode, userMessage };
}

async function loadPrerequisites(questId: string): Promise<QuestPrerequisite[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return await fetchQuestPrerequisites(questId);
  } catch {
    // Non-fatal: if prerequisites can't load, don't block the user
    if (__DEV__) {
      console.warn('[QuestEligibility] Could not load prerequisites for quest', questId);
    }
    return [];
  }
}
