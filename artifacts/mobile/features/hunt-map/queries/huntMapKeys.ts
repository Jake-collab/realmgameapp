/**
 * Hunt Map React Query Keys — Worlds
 *
 * Stable, hierarchical query keys for all Hunt map server state.
 * Never embed precise GPS or private data in cache keys.
 */

import type { HuntMapFilter, HuntNearbySortOrder } from '../types/huntMap.types';
import type { BoundingBox } from '../../maps/utils/geoUtils';

function filterKey(f: HuntMapFilter) {
  // Deterministic filter fingerprint for cache keys
  return [
    f.availableNow,
    f.startingSoon,
    f.hasSpace,
    f.participationMode,
    f.difficulties.sort().join(','),
    f.maxDurationMinutes,
    f.indoorOutdoor,
    f.accessibleOnly,
    f.inMyHunts,
    f.notJoined,
  ].join('|');
}

function boundsKey(b: BoundingBox) {
  // Round to 2dp — prevents cache churn on tiny camera moves
  return `${b.west.toFixed(2)},${b.south.toFixed(2)},${b.east.toFixed(2)},${b.north.toFixed(2)}`;
}

export const huntMapKeys = {
  all: ['hunt-map'] as const,

  viewport: (
    bounds: BoundingBox | null,
    zoom: number,
    filter: HuntMapFilter,
    roundedLat?: number,
    roundedLng?: number,
  ) => [
    'hunt-map',
    'viewport',
    bounds ? boundsKey(bounds) : 'no-bounds',
    Math.round(zoom),
    filterKey(filter),
    roundedLat ?? 0,
    roundedLng ?? 0,
  ] as const,

  nearby: (
    roundedLat: number | null,
    roundedLng: number | null,
    sort: HuntNearbySortOrder,
    filter: HuntMapFilter,
  ) => [
    'hunt-map',
    'nearby',
    roundedLat ?? 0,
    roundedLng ?? 0,
    sort,
    filterKey(filter),
  ] as const,
};
