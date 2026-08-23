/**
 * Quest Domain Error Utilities — Worlds
 *
 * Maps technical errors to safe, user-facing messages.
 * Never expose SQL, RLS policy names, geofence data, or other users' IDs.
 */

import type { QuestDomainError, QuestErrorCode, EligibilityReasonCode } from '../types/quest.types';

// ─── Error factory ────────────────────────────────────────────────────────────

export function makeQuestError(
  code: QuestErrorCode,
  technical?: string
): QuestDomainError {
  const { message, canRetry } = ERROR_CONFIG[code] ?? ERROR_CONFIG.SERVER_ERROR;
  return {
    code,
    message,
    canRetry,
    technical: __DEV__ ? technical : undefined,
  };
}

export function makeEligibilityError(
  reasonCode: EligibilityReasonCode,
  extra?: { cooldownRemainingSeconds?: number }
): QuestDomainError {
  const baseCode = ELIGIBILITY_TO_ERROR_CODE[reasonCode] ?? 'NOT_ELIGIBLE';
  const { message, canRetry } = ERROR_CONFIG[baseCode] ?? ERROR_CONFIG.SERVER_ERROR;

  let finalMessage = message;
  if (reasonCode === 'REPEAT_COOLDOWN' && extra?.cooldownRemainingSeconds) {
    const hours = Math.ceil(extra.cooldownRemainingSeconds / 3600);
    finalMessage = hours > 1
      ? `This quest is on cooldown. Try again in about ${hours} hours.`
      : 'This quest is on a short cooldown. Try again soon.';
  }

  return {
    code: baseCode,
    message: finalMessage,
    canRetry,
    reasonCode,
  };
}

// ─── Normalize raw error ──────────────────────────────────────────────────────

export function normalizeQuestError(error: unknown): QuestDomainError {
  if (isQuestDomainError(error)) return error;

  const msg = getErrorMessage(error);

  // Network failures
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) {
    return makeQuestError('NETWORK_UNAVAILABLE', msg);
  }

  // Supabase/Postgres unique constraint violations
  if (msg.includes('unique') || msg.includes('duplicate')) {
    return makeQuestError('REWARD_ALREADY_ISSUED', msg);
  }

  // RLS violations (never expose to user)
  if (msg.includes('row-level security') || msg.includes('policy')) {
    return makeQuestError('NOT_ELIGIBLE', msg);
  }

  return makeQuestError('SERVER_ERROR', msg);
}

// ─── Type guard ───────────────────────────────────────────────────────────────

export function isQuestDomainError(value: unknown): value is QuestDomainError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'canRetry' in value
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

// ─── Error messages config ────────────────────────────────────────────────────

const ERROR_CONFIG: Record<QuestErrorCode, { message: string; canRetry: boolean }> = {
  QUEST_NOT_FOUND: {
    message: "This quest doesn't seem to exist anymore.",
    canRetry: false,
  },
  QUEST_UNAVAILABLE: {
    message: "This quest isn't available right now.",
    canRetry: false,
  },
  QUEST_EXPIRED: {
    message: 'This quest has ended.',
    canRetry: false,
  },
  QUEST_PAUSED: {
    message: 'This quest is temporarily unavailable.',
    canRetry: true,
  },
  ALREADY_COMPLETED: {
    message: "You've already completed this quest.",
    canRetry: false,
  },
  ACTIVE_PARTICIPATION_EXISTS: {
    message: "You're already working on this quest.",
    canRetry: false,
  },
  REPEAT_COOLDOWN_ACTIVE: {
    message: 'This quest is on cooldown. Try again later.',
    canRetry: true,
  },
  NOT_ELIGIBLE: {
    message: "You're not eligible to start this quest right now.",
    canRetry: false,
  },
  LOCATION_REQUIRED: {
    message: 'This quest requires location access. Enable it in Settings and try again.',
    canRetry: true,
  },
  LOCATION_VALIDATION_FAILED: {
    message: "Your location couldn't be verified for this quest. Make sure you're in the right area.",
    canRetry: true,
  },
  PROOF_REQUIRED: {
    message: 'Please submit proof before completing this quest.',
    canRetry: false,
  },
  PROOF_ALREADY_SUBMITTED: {
    message: "You've already submitted proof for this quest. Wait for the review.",
    canRetry: false,
  },
  PROOF_UNDER_REVIEW: {
    message: "Your proof is being reviewed. Hang tight.",
    canRetry: false,
  },
  INVALID_STATE_TRANSITION: {
    message: "This action can't be performed right now.",
    canRetry: false,
  },
  REWARD_ALREADY_ISSUED: {
    message: "Points for this quest have already been awarded.",
    canRetry: false,
  },
  ACCOUNT_RESTRICTED: {
    message: "Your account doesn't have access to this right now.",
    canRetry: false,
  },
  SERVICE_UNAVAILABLE: {
    message: 'Quest progress is temporarily unavailable. Nothing was saved.',
    canRetry: true,
  },
  NETWORK_UNAVAILABLE: {
    message: 'Check your internet connection and try again.',
    canRetry: true,
  },
  SERVER_ERROR: {
    message: 'Something went wrong. Please try again.',
    canRetry: true,
  },
};

const ELIGIBILITY_TO_ERROR_CODE: Partial<Record<EligibilityReasonCode, QuestErrorCode>> = {
  NOT_AUTHENTICATED: 'ACCOUNT_RESTRICTED',
  ACCOUNT_RESTRICTED: 'ACCOUNT_RESTRICTED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_RESTRICTED',
  ONBOARDING_INCOMPLETE: 'NOT_ELIGIBLE',
  QUEST_NOT_PUBLISHED: 'QUEST_UNAVAILABLE',
  QUEST_NOT_STARTED_YET: 'QUEST_UNAVAILABLE',
  QUEST_EXPIRED: 'QUEST_EXPIRED',
  QUEST_PAUSED: 'QUEST_PAUSED',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  ACTIVE_PARTICIPATION_EXISTS: 'ACTIVE_PARTICIPATION_EXISTS',
  REPEAT_COOLDOWN: 'REPEAT_COOLDOWN_ACTIVE',
  LOCATION_PERMISSION_REQUIRED: 'LOCATION_REQUIRED',
  OUTSIDE_AVAILABLE_REGION: 'LOCATION_VALIDATION_FAILED',
  PREREQUISITE_NOT_MET: 'NOT_ELIGIBLE',
  NO_OCCURRENCE_AVAILABLE: 'QUEST_UNAVAILABLE',
  ELIGIBLE: 'SERVER_ERROR', // should not map to an error
};
