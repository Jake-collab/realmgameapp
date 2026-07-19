/**
 * Quest Error Utilities Tests
 * Tests for error normalization, factory, and eligibility error mapping.
 */

import {
  makeQuestError,
  makeEligibilityError,
  normalizeQuestError,
  isQuestDomainError,
} from '@/features/quests/utils/questErrors';

// ─── makeQuestError ────────────────────────────────────────────────────────────

describe('makeQuestError', () => {
  it('creates error with correct code and message', () => {
    const err = makeQuestError('QUEST_NOT_FOUND');
    expect(err.code).toBe('QUEST_NOT_FOUND');
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
    expect(typeof err.canRetry).toBe('boolean');
  });

  it('marks non-retriable errors correctly', () => {
    expect(makeQuestError('QUEST_NOT_FOUND').canRetry).toBe(false);
    expect(makeQuestError('ALREADY_COMPLETED').canRetry).toBe(false);
  });

  it('marks retriable errors correctly', () => {
    expect(makeQuestError('NETWORK_UNAVAILABLE').canRetry).toBe(true);
    expect(makeQuestError('SERVER_ERROR').canRetry).toBe(true);
    expect(makeQuestError('LOCATION_REQUIRED').canRetry).toBe(true);
  });

  it('exposes technical details in dev environment', () => {
    const err = makeQuestError('SERVER_ERROR', 'Internal query failed: syntax error');
    // In the Expo/Jest test environment, __DEV__ is true — technical field is populated
    // In a production build, __DEV__ = false and this field is stripped by the minifier
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      expect(err.technical).toBe('Internal query failed: syntax error');
    } else {
      expect(err.technical).toBeUndefined();
    }
  });

  it('creates error for all known codes without throwing', () => {
    const codes = [
      'QUEST_NOT_FOUND', 'QUEST_UNAVAILABLE', 'QUEST_EXPIRED', 'QUEST_PAUSED',
      'ALREADY_COMPLETED', 'ACTIVE_PARTICIPATION_EXISTS', 'REPEAT_COOLDOWN_ACTIVE',
      'NOT_ELIGIBLE', 'LOCATION_REQUIRED', 'LOCATION_VALIDATION_FAILED',
      'PROOF_REQUIRED', 'PROOF_ALREADY_SUBMITTED', 'PROOF_UNDER_REVIEW',
      'INVALID_STATE_TRANSITION', 'REWARD_ALREADY_ISSUED', 'ACCOUNT_RESTRICTED',
      'NETWORK_UNAVAILABLE', 'SERVER_ERROR',
    ] as const;

    for (const code of codes) {
      expect(() => makeQuestError(code)).not.toThrow();
      const err = makeQuestError(code);
      expect(err.code).toBe(code);
      expect(err.message.length).toBeGreaterThan(0);
    }
  });
});

// ─── makeEligibilityError ─────────────────────────────────────────────────────

describe('makeEligibilityError', () => {
  it('maps NOT_AUTHENTICATED to ACCOUNT_RESTRICTED code', () => {
    const err = makeEligibilityError('NOT_AUTHENTICATED');
    expect(err.reasonCode).toBe('NOT_AUTHENTICATED');
    expect(err.code).toBe('ACCOUNT_RESTRICTED');
  });

  it('maps QUEST_PAUSED correctly', () => {
    const err = makeEligibilityError('QUEST_PAUSED');
    expect(err.reasonCode).toBe('QUEST_PAUSED');
    expect(err.code).toBe('QUEST_PAUSED');
  });

  it('maps ALREADY_COMPLETED correctly', () => {
    const err = makeEligibilityError('ALREADY_COMPLETED');
    expect(err.reasonCode).toBe('ALREADY_COMPLETED');
    expect(err.code).toBe('ALREADY_COMPLETED');
  });

  it('includes hours-based cooldown message', () => {
    const err = makeEligibilityError('REPEAT_COOLDOWN', { cooldownRemainingSeconds: 7200 });
    expect(err.message).toContain('2 hours');
    expect(err.reasonCode).toBe('REPEAT_COOLDOWN');
  });

  it('uses generic message for <1 hour cooldown', () => {
    const err = makeEligibilityError('REPEAT_COOLDOWN', { cooldownRemainingSeconds: 1800 });
    expect(err.message.toLowerCase()).toContain('soon');
  });

  it('maps LOCATION_PERMISSION_REQUIRED', () => {
    const err = makeEligibilityError('LOCATION_PERMISSION_REQUIRED');
    expect(err.code).toBe('LOCATION_REQUIRED');
  });
});

// ─── normalizeQuestError ──────────────────────────────────────────────────────

describe('normalizeQuestError', () => {
  it('passes through QuestDomainError unchanged', () => {
    const original = makeQuestError('QUEST_NOT_FOUND');
    const normalized = normalizeQuestError(original);
    expect(normalized).toBe(original);
  });

  it('maps fetch errors to NETWORK_UNAVAILABLE', () => {
    const err = new Error('Failed to fetch');
    const normalized = normalizeQuestError(err);
    expect(normalized.code).toBe('NETWORK_UNAVAILABLE');
    expect(normalized.canRetry).toBe(true);
  });

  it('maps NetworkError to NETWORK_UNAVAILABLE', () => {
    const normalized = normalizeQuestError(new Error('NetworkError: request failed'));
    expect(normalized.code).toBe('NETWORK_UNAVAILABLE');
  });

  it('maps unique constraint violations to REWARD_ALREADY_ISSUED', () => {
    const err = { message: 'duplicate key violates unique constraint' };
    const normalized = normalizeQuestError(err);
    expect(normalized.code).toBe('REWARD_ALREADY_ISSUED');
  });

  it('maps RLS policy errors to NOT_ELIGIBLE', () => {
    const err = { message: 'new row violates row-level security policy' };
    const normalized = normalizeQuestError(err);
    expect(normalized.code).toBe('NOT_ELIGIBLE');
  });

  it('maps unknown errors to SERVER_ERROR', () => {
    const normalized = normalizeQuestError(new Error('Something completely unexpected'));
    expect(normalized.code).toBe('SERVER_ERROR');
    expect(normalized.canRetry).toBe(true);
  });

  it('handles string errors', () => {
    const normalized = normalizeQuestError('plain string error');
    expect(normalized.code).toBe('SERVER_ERROR');
  });

  it('handles null/undefined gracefully', () => {
    expect(() => normalizeQuestError(null)).not.toThrow();
    expect(() => normalizeQuestError(undefined)).not.toThrow();
  });
});

// ─── isQuestDomainError ───────────────────────────────────────────────────────

describe('isQuestDomainError', () => {
  it('returns true for valid QuestDomainError', () => {
    const err = makeQuestError('SERVER_ERROR');
    expect(isQuestDomainError(err)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isQuestDomainError(new Error('test'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isQuestDomainError(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isQuestDomainError('error string')).toBe(false);
  });

  it('returns false for incomplete object', () => {
    expect(isQuestDomainError({ code: 'TEST' })).toBe(false);
  });
});
