/**
 * Hunt Map Feature — Public API
 *
 * Exports types, hooks, and components for the Hunt map experience.
 * Never re-export private repository internals.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  PublicHuntMapItem,
  HuntMarkerData,
  HuntMarkerStatus,
  HuntBottomSheetState,
  HuntNearbySortOrder,
  HuntMapFilter,
  HuntViewportRequest,
  HuntViewportResponse,
  HuntNearbyRequest,
} from './types/huntMap.types';

export {
  DEFAULT_HUNT_MAP_FILTER,
  countActiveHuntFilters,
} from './types/huntMap.types';

// ─── Query keys ───────────────────────────────────────────────────────────────
export { huntMapKeys } from './queries/huntMapKeys';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useHuntMapViewport }  from './hooks/useHuntMapViewport';
export { useNearbyHunts }      from './hooks/useNearbyHunts';
export { useHuntMapFilters }   from './hooks/useHuntMapFilters';

// ─── Components ───────────────────────────────────────────────────────────────
export { HuntNearbySheet }  from './components/HuntNearbySheet';
export { HuntFilterSheet }  from './components/HuntFilterSheet';
