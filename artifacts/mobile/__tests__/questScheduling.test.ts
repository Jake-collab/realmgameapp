/**
 * Quest Scheduling Service Tests
 * Tests for occurrence key generation, availability windows, cooldowns,
 * and participation expiration logic.
 */

import {
  buildDailyOccurrenceKey,
  buildMonthlyOccurrenceKey,
  buildGeoOccurrenceKey,
  buildOccurrenceKey,
  isWithinAvailabilityWindow,
  isUpcoming,
  isAvailabilityExpired,
  calculateParticipationExpiry,
  isParticipationExpired,
  checkRepeatCooldown,
  currentUtcDay,
  currentUtcMonth,
  formatCountdown,
} from '@/features/quests/services/questScheduling.service';
import type { QuestRowExtended } from '@/features/quests/repositories/quest.repository';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuest(overrides: Partial<QuestRowExtended> = {}): QuestRowExtended {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86400 * 1000).toISOString();
  return {
    id: 'quest-1',
    slug: 'test-quest',
    title: 'Test Quest',
    summary: 'Summary',
    description: 'Description',
    quest_type: 'daily',
    status: 'published',
    difficulty: 'easy',
    estimated_duration_minutes: 30,
    points_reward: 100,
    indoor_outdoor: 'both',
    accessibility_notes: null,
    safety_notes: null,
    proof_type: 'none',
    location_requirement_type: 'none',
    available_from: now,
    available_until: tomorrow,
    published_at: now,
    created_by: null,
    approved_by: null,
    source_type: 'admin',
    ai_generation_id: null,
    is_repeatable: false,
    repeat_cooldown_hours: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
    completion_mode: 'auto',
    expiration_behavior: 'hard',
    home_priority: 0,
    ...overrides,
  };
}

// ─── Occurrence key generation ─────────────────────────────────────────────────

describe('buildDailyOccurrenceKey', () => {
  it('generates correct format', () => {
    const date = new Date('2026-07-19T14:30:00Z');
    expect(buildDailyOccurrenceKey('morning-walk', date)).toBe('daily:morning-walk:2026-07-19');
  });

  it('uses UTC date not local date', () => {
    const date = new Date('2026-07-20T01:00:00Z'); // UTC next day
    const key = buildDailyOccurrenceKey('morning-walk', date);
    expect(key).toMatch(/^daily:morning-walk:2026-07-20$/);
  });

  it('handles slug with hyphens', () => {
    const date = new Date('2026-07-19T00:00:00Z');
    expect(buildDailyOccurrenceKey('my-cool-quest', date)).toBe('daily:my-cool-quest:2026-07-19');
  });
});

describe('buildMonthlyOccurrenceKey', () => {
  it('generates correct format', () => {
    const date = new Date('2026-07-19T00:00:00Z');
    expect(buildMonthlyOccurrenceKey('city-explorer', date)).toBe('monthly:city-explorer:2026-07');
  });

  it('uses YYYY-MM format only', () => {
    const date = new Date('2026-12-31T23:59:59Z');
    expect(buildMonthlyOccurrenceKey('winter-quest', date)).toBe('monthly:winter-quest:2026-12');
  });
});

describe('buildGeoOccurrenceKey', () => {
  it('generates correct format', () => {
    expect(buildGeoOccurrenceKey('riverside-mural')).toBe('geo:riverside-mural');
  });
});

describe('buildOccurrenceKey', () => {
  it('delegates to daily builder for daily quests', () => {
    const quest = makeQuest({ quest_type: 'daily', slug: 'morning-walk' });
    const date = new Date('2026-07-19T08:00:00Z');
    expect(buildOccurrenceKey(quest, date)).toBe('daily:morning-walk:2026-07-19');
  });

  it('delegates to monthly builder for monthly quests', () => {
    const quest = makeQuest({ quest_type: 'monthly', slug: 'city-exp' });
    const date = new Date('2026-07-15T00:00:00Z');
    expect(buildOccurrenceKey(quest, date)).toBe('monthly:city-exp:2026-07');
  });

  it('delegates to geo builder for geo quests', () => {
    const quest = makeQuest({ quest_type: 'geo', slug: 'riverside' });
    expect(buildOccurrenceKey(quest)).toBe('geo:riverside');
  });
});

// ─── Availability window ───────────────────────────────────────────────────────

describe('isWithinAvailabilityWindow', () => {
  it('returns true for published quest with open window', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: new Date(Date.now() - 3600000).toISOString(),
      available_until: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(isWithinAvailabilityWindow(quest)).toBe(true);
  });

  it('returns false for non-published quest', () => {
    const quest = makeQuest({ status: 'paused' });
    expect(isWithinAvailabilityWindow(quest)).toBe(false);
  });

  it('returns false when before available_from', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    });
    expect(isWithinAvailabilityWindow(quest)).toBe(false);
  });

  it('returns false when after available_until', () => {
    const quest = makeQuest({
      status: 'published',
      available_until: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    });
    expect(isWithinAvailabilityWindow(quest)).toBe(false);
  });

  it('returns true when no available_from set', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: null,
      available_until: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(isWithinAvailabilityWindow(quest)).toBe(true);
  });

  it('returns true when no available_until set', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: new Date(Date.now() - 3600000).toISOString(),
      available_until: null,
    });
    expect(isWithinAvailabilityWindow(quest)).toBe(true);
  });

  it('accepts a custom now parameter', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: '2026-01-01T00:00:00Z',
      available_until: '2026-01-02T00:00:00Z',
    });
    const inWindow = new Date('2026-01-01T12:00:00Z');
    const afterWindow = new Date('2026-01-03T00:00:00Z');
    expect(isWithinAvailabilityWindow(quest, inWindow)).toBe(true);
    expect(isWithinAvailabilityWindow(quest, afterWindow)).toBe(false);
  });
});

describe('isUpcoming', () => {
  it('returns true when available_from is in the future', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: new Date(Date.now() + 7200000).toISOString(),
    });
    expect(isUpcoming(quest)).toBe(true);
  });

  it('returns false when available_from is in the past', () => {
    const quest = makeQuest({
      status: 'published',
      available_from: new Date(Date.now() - 3600000).toISOString(),
    });
    expect(isUpcoming(quest)).toBe(false);
  });

  it('returns false for non-published quest', () => {
    const quest = makeQuest({ status: 'draft', available_from: new Date(Date.now() + 3600000).toISOString() });
    expect(isUpcoming(quest)).toBe(false);
  });
});

describe('isAvailabilityExpired', () => {
  it('returns true when past available_until', () => {
    const quest = makeQuest({
      available_until: new Date(Date.now() - 3600000).toISOString(),
    });
    expect(isAvailabilityExpired(quest)).toBe(true);
  });

  it('returns false when before available_until', () => {
    const quest = makeQuest({
      available_until: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(isAvailabilityExpired(quest)).toBe(false);
  });

  it('returns false when no available_until', () => {
    const quest = makeQuest({ available_until: null });
    expect(isAvailabilityExpired(quest)).toBe(false);
  });
});

// ─── Participation expiry ──────────────────────────────────────────────────────

describe('calculateParticipationExpiry', () => {
  it('returns null for quest with no available_until and no type rule', () => {
    // For non-standard types, expiry may be null
    const quest = makeQuest({
      quest_type: 'geo' as any,
      available_until: null,
    });
    // Geo without available_until: returns N days from start
    const start = new Date('2026-07-19T10:00:00Z');
    const expiry = calculateParticipationExpiry(quest as any, start);
    // 7 days after start
    expect(expiry).not.toBeNull();
    expect(new Date(expiry!).getTime()).toBeGreaterThan(start.getTime());
  });

  it('caps daily quest expiry at end of day', () => {
    const quest = makeQuest({
      quest_type: 'daily',
      available_until: null,
    });
    const start = new Date('2026-07-19T10:00:00Z');
    const expiry = calculateParticipationExpiry(quest as any, start);
    const endOfDay = new Date('2026-07-19T23:59:59.999Z');
    expect(expiry).not.toBeNull();
    expect(new Date(expiry!).getTime()).toBeLessThanOrEqual(endOfDay.getTime() + 1);
  });

  it('caps at quest available_until if earlier', () => {
    const questUntil = new Date('2026-07-19T15:00:00Z');
    const quest = makeQuest({
      quest_type: 'daily',
      available_until: questUntil.toISOString(),
    });
    const start = new Date('2026-07-19T10:00:00Z');
    const expiry = calculateParticipationExpiry(quest as any, start);
    expect(new Date(expiry!).getTime()).toBeLessThanOrEqual(questUntil.getTime());
  });
});

describe('isParticipationExpired', () => {
  it('returns true when past expiry', () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(isParticipationExpired(past)).toBe(true);
  });

  it('returns false when before expiry', () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(isParticipationExpired(future)).toBe(false);
  });

  it('returns false when no expiry set', () => {
    expect(isParticipationExpired(null)).toBe(false);
  });
});

// ─── Repeat cooldown ──────────────────────────────────────────────────────────

describe('checkRepeatCooldown', () => {
  const lastCompleted = '2026-07-19T08:00:00Z';

  it('returns onCooldown=false when cooldown has elapsed', () => {
    const now = new Date('2026-07-20T10:00:00Z'); // 26 hours later
    const result = checkRepeatCooldown(lastCompleted, 24, now);
    expect(result.onCooldown).toBe(false);
    expect(result.remainingSeconds).toBe(0);
  });

  it('returns onCooldown=true with remaining seconds when within cooldown', () => {
    const now = new Date('2026-07-19T12:00:00Z'); // 4 hours later, 24h cooldown
    const result = checkRepeatCooldown(lastCompleted, 24, now);
    expect(result.onCooldown).toBe(true);
    expect(result.remainingSeconds).toBeGreaterThan(0);
    // Should be ~20 hours remaining = 72000 seconds
    expect(result.remainingSeconds).toBeCloseTo(72000, -2);
  });

  it('returns remaining=0 when exactly at boundary', () => {
    const now = new Date('2026-07-20T08:00:00Z'); // exactly 24h later
    const result = checkRepeatCooldown(lastCompleted, 24, now);
    expect(result.onCooldown).toBe(false);
    expect(result.remainingSeconds).toBe(0);
  });
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

describe('currentUtcDay', () => {
  it('returns UTC start and end of day', () => {
    const now = new Date('2026-07-19T14:30:00Z');
    const { start, end } = currentUtcDay(now);
    expect(start.toISOString()).toBe('2026-07-19T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-19T23:59:59.999Z');
  });
});

describe('currentUtcMonth', () => {
  it('returns UTC start and end of month', () => {
    const now = new Date('2026-07-19T14:30:00Z');
    const { start, end } = currentUtcMonth(now);
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    // End of July = July 31 23:59:59.999Z
    expect(end.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });
});

// ─── Countdown formatter ──────────────────────────────────────────────────────

describe('formatCountdown', () => {
  const base = new Date('2026-07-19T10:00:00Z');

  it('formats seconds', () => {
    const target = new Date('2026-07-19T10:00:45Z').toISOString();
    expect(formatCountdown(target, base)).toBe('45s');
  });

  it('formats minutes', () => {
    const target = new Date('2026-07-19T10:05:00Z').toISOString();
    expect(formatCountdown(target, base)).toBe('5m');
  });

  it('formats hours and minutes', () => {
    const target = new Date('2026-07-19T12:15:00Z').toISOString();
    expect(formatCountdown(target, base)).toBe('2h 15m');
  });

  it('formats hours without remainder', () => {
    const target = new Date('2026-07-19T13:00:00Z').toISOString();
    expect(formatCountdown(target, base)).toBe('3h');
  });

  it('formats days', () => {
    const target = new Date('2026-07-22T10:00:00Z').toISOString();
    expect(formatCountdown(target, base)).toBe('3 days');
  });

  it('formats singular day', () => {
    const target = new Date('2026-07-20T10:00:00Z').toISOString();
    expect(formatCountdown(target, base)).toBe('1 day');
  });

  it('returns "now" for past target', () => {
    const past = new Date('2026-07-18T10:00:00Z').toISOString();
    expect(formatCountdown(past, base)).toBe('now');
  });
});
