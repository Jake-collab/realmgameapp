/**
 * Quest Scheduling Service — Worlds
 *
 * All scheduling logic in one place. Uses UTC internally.
 * UI layers convert to local time for display.
 *
 * Rules:
 * - Server time is authoritative for availability decisions.
 * - Never store ambiguous local timestamps.
 * - Daily occurrences use YYYY-MM-DD keys (UTC date).
 * - Monthly occurrences use YYYY-MM keys (UTC month).
 * - The mobile clock is used only for display, not for access decisions.
 */

import type { QuestRowExtended } from '../repositories/quest.repository';
import type { QuestOccurrence } from '../types/quest.types';
import {
  DAILY_QUEST_PARTICIPATION_EXPIRY_HOURS,
  MONTHLY_QUEST_PARTICIPATION_EXPIRY_DAYS,
  GEO_QUEST_PARTICIPATION_EXPIRY_DAYS,
} from '../constants';

// ─── Occurrence key generation ────────────────────────────────────────────────

/**
 * Generate the occurrence key for a daily quest on a specific UTC date.
 * Example: daily:morning-walk:2026-07-19
 */
export function buildDailyOccurrenceKey(questSlug: string, utcDate: Date = new Date()): string {
  const dateStr = utcDate.toISOString().slice(0, 10); // YYYY-MM-DD
  return `daily:${questSlug}:${dateStr}`;
}

/**
 * Generate the occurrence key for a monthly quest in a UTC month.
 * Example: monthly:city-explorer:2026-07
 */
export function buildMonthlyOccurrenceKey(questSlug: string, utcDate: Date = new Date()): string {
  const yearMonth = utcDate.toISOString().slice(0, 7); // YYYY-MM
  return `monthly:${questSlug}:${yearMonth}`;
}

/**
 * Generate the occurrence key for a non-repeatable geo quest.
 * Example: geo:riverside-sculpture-trail
 */
export function buildGeoOccurrenceKey(questSlug: string): string {
  return `geo:${questSlug}`;
}

/**
 * Build the occurrence key for any quest type at the current moment.
 */
export function buildOccurrenceKey(quest: QuestRowExtended, now: Date = new Date()): string {
  switch (quest.quest_type) {
    case 'daily':
      return buildDailyOccurrenceKey(quest.slug, now);
    case 'monthly':
      return buildMonthlyOccurrenceKey(quest.slug, now);
    case 'geo':
      return buildGeoOccurrenceKey(quest.slug);
    default:
      return `${quest.quest_type}:${quest.slug}`;
  }
}

// ─── Availability window evaluation ───────────────────────────────────────────

/**
 * Check whether a quest's content availability window is currently open.
 * Uses provided `now` for testability — callers should prefer server time.
 */
export function isWithinAvailabilityWindow(
  quest: Pick<QuestRowExtended, 'available_from' | 'available_until' | 'status'>,
  now: Date = new Date()
): boolean {
  if (quest.status !== 'published') return false;

  const from = quest.available_from ? new Date(quest.available_from) : null;
  const until = quest.available_until ? new Date(quest.available_until) : null;

  if (from && now < from) return false;
  if (until && now >= until) return false;

  return true;
}

/**
 * Check whether a quest is upcoming (published but not yet available).
 */
export function isUpcoming(
  quest: Pick<QuestRowExtended, 'available_from' | 'status'>,
  now: Date = new Date()
): boolean {
  if (quest.status !== 'published') return false;
  if (!quest.available_from) return false;
  return now < new Date(quest.available_from);
}

/**
 * Check whether a quest's availability window has expired.
 */
export function isAvailabilityExpired(
  quest: Pick<QuestRowExtended, 'available_until' | 'status'>,
  now: Date = new Date()
): boolean {
  if (!quest.available_until) return false;
  return now >= new Date(quest.available_until);
}

// ─── Occurrence evaluation ────────────────────────────────────────────────────

/**
 * Check whether a quest_occurrence is currently active.
 */
export function isOccurrenceActive(occurrence: QuestOccurrence, now: Date = new Date()): boolean {
  if (!occurrence.is_published) return false;
  return now >= new Date(occurrence.available_from) && now < new Date(occurrence.available_until);
}

// ─── Participation expiration helpers ──────────────────────────────────────────

/**
 * Calculate the participation expiration time based on quest type and start time.
 * Returns null for quests with no participation deadline.
 */
export function calculateParticipationExpiry(
  quest: QuestRowExtended,
  startedAt: Date = new Date()
): string | null {
  switch (quest.quest_type) {
    case 'daily': {
      // Daily quests expire at midnight UTC after start, capped at 24h
      const endOfDay = new Date(startedAt);
      endOfDay.setUTCHours(23, 59, 59, 999);
      const maxExpiry = new Date(startedAt.getTime() + DAILY_QUEST_PARTICIPATION_EXPIRY_HOURS * 3600 * 1000);
      const expires = endOfDay < maxExpiry ? endOfDay : maxExpiry;
      // Also cap at quest's available_until if set
      if (quest.available_until) {
        const questEnd = new Date(quest.available_until);
        return (expires < questEnd ? expires : questEnd).toISOString();
      }
      return expires.toISOString();
    }
    case 'monthly': {
      // Monthly quests expire with the monthly window or N days after start
      const defaultExpiry = new Date(
        startedAt.getTime() + MONTHLY_QUEST_PARTICIPATION_EXPIRY_DAYS * 86400 * 1000
      );
      if (quest.available_until) {
        const questEnd = new Date(quest.available_until);
        return (defaultExpiry < questEnd ? defaultExpiry : questEnd).toISOString();
      }
      return defaultExpiry.toISOString();
    }
    case 'geo': {
      // Geo quests: fixed days after start, capped at content expiry
      const defaultExpiry = new Date(
        startedAt.getTime() + GEO_QUEST_PARTICIPATION_EXPIRY_DAYS * 86400 * 1000
      );
      if (quest.available_until) {
        const questEnd = new Date(quest.available_until);
        return (defaultExpiry < questEnd ? defaultExpiry : questEnd).toISOString();
      }
      return defaultExpiry.toISOString();
    }
    default:
      return null;
  }
}

/**
 * Check whether a participation's deadline has passed.
 */
export function isParticipationExpired(
  expiresAt: string | null,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false;
  return now >= new Date(expiresAt);
}

// ─── Repeat cooldown ──────────────────────────────────────────────────────────

/**
 * Check whether the repeat cooldown for a quest has elapsed since the last completion.
 *
 * @param lastCompletedAt  ISO timestamp of last successful completion
 * @param cooldownHours    Cooldown duration from quest configuration
 * @param now              Current time (for testability)
 * @returns { onCooldown, remainingSeconds }
 */
export function checkRepeatCooldown(
  lastCompletedAt: string,
  cooldownHours: number,
  now: Date = new Date()
): { onCooldown: boolean; remainingSeconds: number } {
  const lastCompleted = new Date(lastCompletedAt);
  const cooldownMs = cooldownHours * 3600 * 1000;
  const cooldownEndsAt = new Date(lastCompleted.getTime() + cooldownMs);
  const remaining = cooldownEndsAt.getTime() - now.getTime();

  return {
    onCooldown: remaining > 0,
    remainingSeconds: Math.max(0, Math.ceil(remaining / 1000)),
  };
}

// ─── Daily window helpers ──────────────────────────────────────────────────────

/**
 * Returns the UTC start and end of the current calendar day.
 */
export function currentUtcDay(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Returns the UTC start and end of the current calendar month.
 */
export function currentUtcMonth(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Format a UTC ISO timestamp into the user's local time string.
 * UI layer only — scheduling decisions always use UTC.
 */
export function formatLocalTime(isoString: string, locale?: string): string {
  return new Date(isoString).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Returns a human-readable countdown (e.g. "2h 15m" or "3 days").
 */
export function formatCountdown(targetIso: string, now: Date = new Date()): string {
  const diffMs = new Date(targetIso).getTime() - now.getTime();
  if (diffMs <= 0) return 'now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const remainMin = diffMin % 60;
    return remainMin > 0 ? `${diffHr}h ${remainMin}m` : `${diffHr}h`;
  }
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}
