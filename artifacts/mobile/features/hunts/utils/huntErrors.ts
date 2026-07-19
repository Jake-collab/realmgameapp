/**
 * Hunt Domain Error Types — Worlds
 *
 * Safe, user-facing Hunt errors. Never expose:
 * - SQL errors or RLS policy names
 * - Private geometry
 * - Internal role IDs
 * - Other users' IDs
 * - Moderation notes
 */

// ─── Hunt domain error type ───────────────────────────────────────────────────

export type HuntErrorCode =
  | 'HUNT_NOT_FOUND'
  | 'HUNT_UNAVAILABLE'
  | 'HUNT_PRIVATE'
  | 'INVITATION_REQUIRED'
  | 'INVITATION_EXPIRED'
  | 'HUNT_FULL'
  | 'HUNT_PAUSED'
  | 'HUNT_CANCELLED'
  | 'HUNT_EXPIRED'
  | 'ALREADY_JOINED'
  | 'ALREADY_COMPLETED'
  | 'INVALID_PARTICIPATION_MODE'
  | 'MINIMUM_PARTICIPANTS_NOT_MET'
  | 'NOT_AUTHORIZED_TO_INVITE'
  | 'NOT_AUTHORIZED_TO_START'
  | 'STOP_LOCKED'
  | 'PROOF_REQUIRED'
  | 'PROOF_UNDER_REVIEW'
  | 'INVALID_STATE_TRANSITION'
  | 'LOCATION_VALIDATION_REQUIRED'
  | 'LOCATION_VALIDATION_FAILED'
  | 'REWARD_ALREADY_ISSUED'
  | 'ACCOUNT_RESTRICTED'
  | 'NETWORK_UNAVAILABLE'
  | 'UNKNOWN';

export class HuntDomainError extends Error {
  readonly code: HuntErrorCode;
  readonly userMessage: string;
  readonly isRetryable: boolean;

  constructor(
    code: HuntErrorCode,
    userMessage: string,
    options?: { isRetryable?: boolean; cause?: unknown },
  ) {
    super(`[Hunt:${code}] ${userMessage}`);
    this.name = 'HuntDomainError';
    this.code = code;
    this.userMessage = userMessage;
    this.isRetryable = options?.isRetryable ?? false;
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
  }
}

// ─── Error factory helpers ────────────────────────────────────────────────────

export const HuntErrors = {
  notFound: () =>
    new HuntDomainError('HUNT_NOT_FOUND', 'This hunt could not be found.'),

  unavailable: () =>
    new HuntDomainError('HUNT_UNAVAILABLE', 'This hunt is not currently available.'),

  private: () =>
    new HuntDomainError('HUNT_PRIVATE', 'This hunt is private.'),

  invitationRequired: () =>
    new HuntDomainError('INVITATION_REQUIRED', 'An invitation is required to join this hunt.'),

  invitationExpired: () =>
    new HuntDomainError('INVITATION_EXPIRED', 'Your invitation has expired.'),

  full: () =>
    new HuntDomainError('HUNT_FULL', 'This hunt is full. No more spots are available.'),

  paused: () =>
    new HuntDomainError('HUNT_PAUSED', 'This hunt is temporarily paused.'),

  cancelled: () =>
    new HuntDomainError('HUNT_CANCELLED', 'This hunt has been cancelled.'),

  expired: () =>
    new HuntDomainError('HUNT_EXPIRED', 'This hunt has ended.'),

  alreadyJoined: () =>
    new HuntDomainError('ALREADY_JOINED', "You've already joined this hunt."),

  alreadyCompleted: () =>
    new HuntDomainError('ALREADY_COMPLETED', "You've already completed this hunt."),

  stopLocked: () =>
    new HuntDomainError('STOP_LOCKED', 'This stop is not yet available.'),

  proofRequired: () =>
    new HuntDomainError('PROOF_REQUIRED', 'Proof submission is required to complete this stop.'),

  proofUnderReview: () =>
    new HuntDomainError('PROOF_UNDER_REVIEW', 'Your proof submission is currently under review.'),

  locationValidationRequired: () =>
    new HuntDomainError(
      'LOCATION_VALIDATION_REQUIRED',
      'Location verification is required to complete this stop.',
    ),

  locationValidationFailed: () =>
    new HuntDomainError(
      'LOCATION_VALIDATION_FAILED',
      "You don't appear to be at the required location. Try again when you arrive.",
    ),

  rewardAlreadyIssued: () =>
    new HuntDomainError('REWARD_ALREADY_ISSUED', 'Points for this hunt have already been awarded.'),

  accountRestricted: () =>
    new HuntDomainError(
      'ACCOUNT_RESTRICTED',
      'Your account is restricted. Contact support.',
      { isRetryable: false },
    ),

  networkUnavailable: () =>
    new HuntDomainError(
      'NETWORK_UNAVAILABLE',
      'No network connection. Check your signal and try again.',
      { isRetryable: true },
    ),

  unknown: (cause?: unknown) =>
    new HuntDomainError(
      'UNKNOWN',
      'Something went wrong. Please try again.',
      { isRetryable: true, cause },
    ),
} as const;

// ─── Normalize unknown errors ─────────────────────────────────────────────────

export function normalizeHuntError(error: unknown): HuntDomainError {
  if (error instanceof HuntDomainError) return error;

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    // Supabase / RPC error shapes
    const code = typeof obj.code === 'string' ? obj.code : '';
    const message = typeof obj.message === 'string' ? obj.message : '';

    // Map known Supabase codes to domain errors (safe codes only)
    if (code === 'PGRST116' || message.includes('not found')) {
      return HuntErrors.notFound();
    }
    if (message.toLowerCase().includes('capacity') || message.toLowerCase().includes('full')) {
      return HuntErrors.full();
    }
    if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
      return HuntErrors.networkUnavailable();
    }
  }

  return HuntErrors.unknown(error);
}

// ─── RPC result normalizer ────────────────────────────────────────────────────
/**
 * Many Hunt RPCs return { success: boolean, reasonCode?: string, userMessage?: string }.
 * This normalizes that shape into a domain error when success = false.
 */
export function assertRpcSuccess(
  result: { success?: boolean; reasonCode?: string | null; userMessage?: string } | null | undefined,
  context: string,
): asserts result is { success: true; reasonCode?: null; userMessage?: string } {
  if (!result || result.success === false) {
    const msg = result?.userMessage ?? `${context} failed. Please try again.`;
    // Never expose SQL or RLS details — always use safe user message
    throw HuntErrors.unknown(new Error(msg));
  }
}
