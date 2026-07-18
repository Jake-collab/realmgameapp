/**
 * Error Normalizer — Unit Tests
 *
 * Verifies that all known Supabase auth errors and network failures
 * are mapped to safe, user-friendly messages and correct categories.
 * Also checks that sensitive information is never surfaced.
 */

import { normalizeAuthError, authErrorMessage } from '@/lib/auth/errorNormalizer';

describe('normalizeAuthError', () => {
  // ── Rate limiting ────────────────────────────────────────────────────────

  it('identifies rate limiting from "for security purposes" message', () => {
    const err = normalizeAuthError({
      message: 'For security purposes, you can only request this after 60 seconds.',
    });
    expect(err.category).toBe('rate_limited');
    expect(err.canRetry).toBe(false);
  });

  it('identifies rate limiting from "too many requests" message', () => {
    const err = normalizeAuthError({ message: 'Too many requests', code: 'over_request_rate_limit' });
    expect(err.category).toBe('rate_limited');
  });

  // ── Email already registered ─────────────────────────────────────────────

  it('identifies already-registered email', () => {
    const err = normalizeAuthError({ message: 'User already registered', code: 'email_exists' });
    expect(err.category).toBe('email_already_registered');
    expect(err.canRetry).toBe(false);
  });

  // ── Invalid credentials ───────────────────────────────────────────────────

  it('identifies invalid credentials', () => {
    const err = normalizeAuthError({ message: 'Invalid login credentials' });
    expect(err.category).toBe('invalid_credentials');
    expect(err.canRetry).toBe(true);
  });

  it('maps "user not found" to invalid_credentials (avoids enumeration)', () => {
    const err = normalizeAuthError({ message: 'User not found' });
    expect(err.category).toBe('invalid_credentials');
    // Generic message — does not reveal whether account exists
    expect(err.message).not.toMatch(/not found/i);
    expect(err.message).not.toMatch(/registered/i);
  });

  // ── Email verification ────────────────────────────────────────────────────

  it('identifies email not confirmed', () => {
    const err = normalizeAuthError({ message: 'Email not confirmed', code: 'email_not_confirmed' });
    expect(err.category).toBe('verification_required');
    expect(err.canRetry).toBe(false);
  });

  // ── Token expiry ──────────────────────────────────────────────────────────

  it('identifies expired tokens', () => {
    const err = normalizeAuthError({ message: 'Token has expired', code: 'expired_token' });
    expect(err.category).toBe('recovery_link_invalid');
    expect(err.canRetry).toBe(true);
  });

  // ── Network errors ────────────────────────────────────────────────────────

  it('identifies network failure from Error instance', () => {
    const err = normalizeAuthError(new Error('Failed to fetch'));
    expect(err.category).toBe('network_unavailable');
    expect(err.canRetry).toBe(true);
  });

  it('identifies network failure from ECONNREFUSED string', () => {
    const err = normalizeAuthError({ message: 'ECONNREFUSED: connection refused' });
    expect(err.category).toBe('network_unavailable');
  });

  // ── Configuration missing ─────────────────────────────────────────────────

  it('identifies configuration missing', () => {
    const err = normalizeAuthError({ message: 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL' });
    expect(err.category).toBe('configuration_missing');
  });

  // ── Unknown errors ────────────────────────────────────────────────────────

  it('falls back to unknown_server_error for unrecognized errors', () => {
    const err = normalizeAuthError({ message: 'Something entirely unexpected' });
    expect(err.category).toBe('unknown_server_error');
    expect(err.canRetry).toBe(true);
  });

  it('handles string errors', () => {
    const err = normalizeAuthError('A plain string error');
    expect(err.category).toBe('unknown_server_error');
    expect(err.message).toBeTruthy();
  });

  it('handles null/undefined gracefully', () => {
    const err = normalizeAuthError(null);
    expect(err.message).toBeTruthy();
  });

  // ── Safety: no sensitive data in messages ─────────────────────────────────

  const SENSITIVE_TERMS = ['policy', 'rls', 'sql', 'table', 'column', 'stack trace', 'secret'];

  it('does not expose SQL or policy names in messages', () => {
    const scenarios = [
      { message: 'new row violates row-level security policy for table "profiles"' },
      { message: 'column "id" of relation "users" does not exist' },
    ];

    scenarios.forEach((error) => {
      const err = normalizeAuthError(error);
      SENSITIVE_TERMS.forEach((term) => {
        expect(err.message.toLowerCase()).not.toContain(term);
      });
    });
  });
});

describe('authErrorMessage', () => {
  it('returns a non-empty string', () => {
    const msg = authErrorMessage({ message: 'invalid_credentials' });
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
