/**
 * normalizeError — shared utility
 *
 * Converts any thrown value into a proper Error instance.
 * Used across domain repositories to normalize Supabase/fetch/unknown errors.
 */

export interface NormalizedError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}

/**
 * Converts any thrown value (Error, Supabase PostgrestError, string, unknown)
 * into a NormalizedError with `.message`, optional `.code`, and optional `.statusCode`.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return error as NormalizedError;
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;

    // Supabase PostgrestError shape: { message, code, details, hint }
    const message = typeof obj.message === 'string'
      ? obj.message
      : typeof obj.hint === 'string'
        ? obj.hint
        : JSON.stringify(error);

    const normalized = new Error(message) as NormalizedError;

    if (typeof obj.code === 'string') {
      normalized.code = obj.code;
    }

    if (typeof obj.status === 'number') {
      normalized.statusCode = obj.status;
    }

    if (obj.details !== undefined) {
      normalized.details = obj.details;
    }

    return normalized;
  }

  if (typeof error === 'string') {
    return new Error(error) as NormalizedError;
  }

  return new Error('An unexpected error occurred') as NormalizedError;
}

/** Network failures can happen after Supabase has already been configured. */
export function isTransientNetworkError(error: unknown): boolean {
  const normalized = normalizeError(error);
  const message = normalized.message.toLowerCase();
  return (
    normalized.statusCode === 408 ||
    normalized.statusCode === 429 ||
    normalized.statusCode === 502 ||
    normalized.statusCode === 503 ||
    normalized.statusCode === 504 ||
    /network|fetch|failed to fetch|timeout|timed out|offline|econnreset|econnrefused|dns|connection/i.test(message)
  );
}
