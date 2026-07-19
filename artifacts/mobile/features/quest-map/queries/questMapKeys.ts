/**
 * Quest Map Query Keys — Worlds
 *
 * Centralized React Query key factory for all map-related queries.
 *
 * Rules:
 * - Do NOT place raw exact GPS coordinates in cache keys.
 * - Use rounded/generalized region identifiers.
 * - Validation mutations are NOT cached as ordinary queries.
 * - Keep keys stable across renders.
 */

import type { GeoQuestMapFilter } from '../types/questMap.types';
import { safeBoundsKey, safeRegionKey } from '../../maps/utils/coordinatePrivacy';

// ─── Key factory ──────────────────────────────────────────────────────────────

export const questMapKeys = {
  /** Root — invalidate all map queries */
  all: ['quest-map'] as const,

  /**
   * Viewport query — keyed by rounded bounds + active filters + user ID.
   * The bounds are rounded to 2dp before inclusion in the key.
   */
  viewport: (
    west: number, south: number, east: number, north: number,
    filter: GeoQuestMapFilter,
    userId: string,
  ) => [
    ...questMapKeys.all,
    'viewport',
    safeBoundsKey(west, south, east, north),
    serializeFilter(filter),
    userId,
  ] as const,

  /**
   * Nearby query — keyed by approximate user region (rounded to 2dp) + filters.
   * Never includes exact GPS coordinates.
   */
  nearby: (
    approximateLat: number,
    approximateLng: number,
    filter: GeoQuestMapFilter,
    userId: string,
  ) => [
    ...questMapKeys.all,
    'nearby',
    safeRegionKey(approximateLat, approximateLng),
    serializeFilter(filter),
    userId,
  ] as const,

  /**
   * Geo-Quest detail for a selected marker.
   * Loads additional fields beyond the viewport summary.
   */
  detail: (questId: string, occurrenceId: string | null, userId: string) => [
    ...questMapKeys.all,
    'detail',
    questId,
    occurrenceId ?? 'none',
    userId,
  ] as const,

  /**
   * Place search suggestions.
   * Keyed by normalized (trimmed, lowercased) search text.
   */
  search: (searchText: string) => [
    ...questMapKeys.all,
    'search',
    searchText.trim().toLowerCase(),
  ] as const,

  /**
   * Validation result for a specific participation + step.
   * NOT used as an ordinary cache — validation mutations should not auto-retry.
   */
  validation: (participationId: string, stepId: string | null) => [
    ...questMapKeys.all,
    'validation',
    participationId,
    stepId ?? 'start',
  ] as const,
} as const;

// ─── Invalidation helpers ─────────────────────────────────────────────────────

/** Invalidate all viewport and nearby queries after a participation state change */
export function getMapInvalidationKeys(userId: string) {
  return [
    // Broad invalidation of all map queries for this user
    [...questMapKeys.all, 'viewport'],
    [...questMapKeys.all, 'nearby'],
    [...questMapKeys.all, 'detail'],
  ];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Deterministic filter serialization for stable cache keys */
function serializeFilter(filter: GeoQuestMapFilter): string {
  return [
    filter.availableNow ? '1' : '0',
    filter.accessibleOnly ? '1' : '0',
    filter.notCompleted ? '1' : '0',
    filter.inAction ? '1' : '0',
    filter.questType,
    filter.indoorOutdoor ?? 'any',
    filter.maxDurationMinutes ?? 'any',
    [...filter.difficulties].sort().join('+'),
  ].join('|');
}
