/**
 * Auth Error Normalizer — Worlds
 *
 * Converts raw Supabase auth errors and network failures into safe,
 * user-friendly messages. Never expose SQL, policy names, table names,
 * stack traces, or internal identifiers to the UI.
 *
 * Usage:
 *   const message = normalizeAuthError(error);
 *   setServerError(message);
 */

// ─── Category types ───────────────────────────────────────────────────────────

export type AuthErrorCategory =
  | 'configuration_missing'
  | 'validation'
  | 'invalid_credentials'
  | 'email_already_registered'
  | 'username_unavailable'
  | 'verification_required'
  | 'rate_limited'
  | 'network_unavailable'
  | 'account_restricted'
  | 'account_suspended'
  | 'recovery_link_invalid'
  | 'unknown_server_error';

export interface NormalizedAuthError {
  category: AuthErrorCategory;
  /** Safe, user-facing message */
  message: string;
  /** Whether the user can retry the action */
  canRetry: boolean;
}

// ─── Matcher helpers ──────────────────────────────────────────────────────────

function includes(str: string, ...terms: string[]): boolean {
  const lower = str.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

/**
 * Takes any thrown value (Supabase AuthError, network error, string, or unknown)
 * and returns a normalized error with a safe user-facing message.
 */
export function normalizeAuthError(error: unknown): NormalizedAuthError {
  // Extract message from various error shapes
  let raw = '';
  if (error instanceof Error) raw = error.message;
  else if (typeof error === 'string') raw = error;
  else if (error && typeof error === 'object' && 'message' in error) {
    raw = String((error as { message: unknown }).message);
  } else {
    raw = String(error ?? '');
  }

  const code: string =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  // ── Supabase-specific codes ───────────────────────────────────────────────

  if (code === 'over_request_rate_limit' || includes(raw, 'rate limit', 'too many requests', 'for security purposes')) {
    return {
      category: 'rate_limited',
      message: 'Too many attempts. Please wait a moment before trying again.',
      canRetry: false,
    };
  }

  if (code === 'email_exists' || includes(raw, 'already registered', 'email already', 'user already registered')) {
    return {
      category: 'email_already_registered',
      message: 'An account with this email already exists. Try logging in instead.',
      canRetry: false,
    };
  }

  if (code === 'invalid_credentials' || includes(raw, 'invalid login', 'invalid credentials', 'wrong password', 'incorrect password')) {
    return {
      category: 'invalid_credentials',
      message: "We couldn't sign you in with those details. Please check your email and password.",
      canRetry: true,
    };
  }

  if (code === 'email_not_confirmed' || includes(raw, 'email not confirmed', 'email confirmation', 'not confirmed')) {
    return {
      category: 'verification_required',
      message: 'Please verify your email before continuing. Check your inbox for the verification link.',
      canRetry: false,
    };
  }

  if (code === 'expired_token' || includes(raw, 'expired', 'invalid token', 'token expired')) {
    return {
      category: 'recovery_link_invalid',
      message: 'This link has expired or is no longer valid. Please request a new one.',
      canRetry: true,
    };
  }

  if (includes(raw, 'user not found') || code === 'user_not_found') {
    // Intentionally vague — do not confirm whether an email is registered
    return {
      category: 'invalid_credentials',
      message: "We couldn't sign you in with those details. Please check your email and password.",
      canRetry: true,
    };
  }

  if (code === 'weak_password' || includes(raw, 'password', 'weak password', 'password should')) {
    return {
      category: 'validation',
      message: 'Your password does not meet the requirements. Please choose a stronger one.',
      canRetry: true,
    };
  }

  // ── Network errors ────────────────────────────────────────────────────────

  if (
    includes(raw, 'network', 'fetch', 'failed to fetch', 'networkerror', 'econnrefused', 'dns', 'timeout', 'offline')
  ) {
    return {
      category: 'network_unavailable',
      message: 'Connection error. Please check your internet connection and try again.',
      canRetry: true,
    };
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  if (includes(raw, 'not configured', 'supabase is not', 'expo_public_supabase')) {
    return {
      category: 'configuration_missing',
      message: __DEV__
        ? 'Authentication setup is pending. Account creation and login will be enabled after Supabase is connected.'
        : 'Service is temporarily unavailable. Please try again later.',
      canRetry: false,
    };
  }

  // ── Account status ────────────────────────────────────────────────────────

  if (includes(raw, 'suspended')) {
    return {
      category: 'account_suspended',
      message: 'This account is currently unavailable. Please contact support for assistance.',
      canRetry: false,
    };
  }

  if (includes(raw, 'restricted')) {
    return {
      category: 'account_restricted',
      message: 'Your account has a restriction in place. Some features may be unavailable.',
      canRetry: false,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────

  if (__DEV__) {
    console.warn('[Auth] Unhandled error (raw):', raw, '| code:', code);
  }

  return {
    category: 'unknown_server_error',
    message: 'Something went wrong. Please try again.',
    canRetry: true,
  };
}

/** Convenience: returns just the user-facing message string */
export function authErrorMessage(error: unknown): string {
  return normalizeAuthError(error).message;
}
