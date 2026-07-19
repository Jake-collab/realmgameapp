/**
 * Active Hunt Feature — Public API
 *
 * Exports from the Active Hunt gameplay feature module.
 * Import from here instead of internal paths.
 */

// Types
export type {
  StopActionType,
  StopActionResult,
  ProofDraftState,
  ProofImageItem,
  ProofUploadState,
  LocationValidationResult,
  LocationValidationOutcome,
  HuntProofSubmissionDetail,
  ProofSubmissionStatus,
  ServerCompletionReadiness,
  ActiveHuntViewMode,
  WithdrawalConfirmationState,
} from './types/activeHunt.types';

export {
  createEmptyProofDraft,
  evaluateProofDraftReadiness,
  resolveActiveHuntViewMode,
} from './types/activeHunt.types';

// Services
export {
  resolveStopAction,
  resolveHuntLevelAction,
} from './services/stopActionResolver';

// Hooks
export { useSubmitHuntProof } from './hooks/useSubmitHuntProof';
export { useValidateHuntStopLocation } from './hooks/useValidateHuntStopLocation';
export { useHuntSubmissionDetail } from './hooks/useHuntSubmissionDetail';
export { useHuntCompletionReadiness } from './hooks/useHuntCompletionReadiness';
export { useHuntProofDraft } from './hooks/useHuntProofDraft';
