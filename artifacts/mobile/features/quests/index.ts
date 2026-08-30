/**
 * Quest Feature Module — Barrel Export
 *
 * Import from '@/features/quests' for all quest domain functionality.
 *
 * Usage examples:
 *   import { useDailyQuests, useStartQuest } from '@/features/quests/hooks';
 *   import { evaluateQuestAvailability } from '@/features/quests/services/questAvailability.service';
 *   import { questKeys } from '@/features/quests/queries/questKeys';
 *   import type { QuestAvailabilityResult } from '@/features/quests/types/quest.types';
 */

// Types
export type {
  QuestSummary,
  QuestDetail,
  QuestObjective,
  QuestPublicLocation,
  QuestOccurrence,
  QuestPrerequisite,
  QuestAvailabilityResult,
  QuestAvailabilityState,
  QuestEligibilityResult,
  EligibilityReasonCode,
  QuestStartResult,
  QuestCompletionResult,
  QuestPointReward,
  PointRewardGuideline,
  ActiveQuestView,
  QuestProgressHelpers,
  QuestExpirationResult,
  ProofRequirementConfig,
  QuestDomainError,
  QuestErrorCode,
  QuestEventType,
  QuestEvent,
  QuestListFilter,
  GeoFilter,
  QuestCompletionMode,
  QuestExpirationBehavior,
} from './types/quest.types';

// Query keys
export { questKeys } from './queries/questKeys';

// Hooks (also available via '@/features/quests/hooks')
export * from './hooks';

// State machines (for testing and admin logic)
export {
  validateParticipationTransition,
  isParticipationTerminal,
  isParticipationActive,
  canAbandon,
  canSubmitProof,
} from './stateMachine/participation.machine';

export {
  validateProofTransition,
  isProofEditable,
  isProofImmutable,
  isProofApproved,
  canResubmit,
} from './stateMachine/proof.machine';

export {
  validateQuestContentTransition,
  isQuestPubliclyVisible,
  isQuestOpenForParticipation,
} from './stateMachine/questContent.machine';

// Services (domain entry points)
export { startQuest } from './services/questStart.service';
export { abandonQuest } from './services/questAbandonment.service';
export { evaluateQuestAvailability } from './services/questAvailability.service';
export { evaluateQuestEligibility } from './services/questEligibility.service';
export {
  startQuestTimer,
  confirmQuestIntegrityRequirement,
} from './services/questVerification.service';
export {
  getQuestVerificationMethods,
  formatRemainingTimer,
  verificationLabel,
} from './utils/questVerification';

// Error utilities
export { makeQuestError, normalizeQuestError, isQuestDomainError } from './utils/questErrors';

// Constants
export {
  PARTICIPATION_ALLOWED_TRANSITIONS,
  PROOF_ALLOWED_TRANSITIONS,
  QUEST_CONTENT_ALLOWED_TRANSITIONS,
} from './constants';
