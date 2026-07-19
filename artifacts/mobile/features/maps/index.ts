/**
 * features/maps — Shared Map Foundation (Prompt 9/10)
 *
 * Public API for the shared Mapbox map infrastructure.
 * Used by quest-map and any other feature needing map or location services.
 */

// Provider
export { MapProvider, useMapContext, getMapboxGL } from './MapProvider';

// Config
export {
  isMapboxConfigured,
  MAP_STYLES,
  DEFAULT_MAP_REGION,
  USER_LOCATION_ZOOM,
  MIN_DISCOVERY_ZOOM,
  VIEWPORT_DEBOUNCE_MS,
  VIEWPORT_RESULT_LIMIT,
  MAX_BBOX_DIAGONAL_DEGREES,
  MAX_LOCATION_AGE_SECONDS,
  DEFAULT_MAX_ACCURACY_METERS,
  SEARCH_BBOX_US,
  DEFAULT_DISTANCE_UNIT,
} from './config/mapConfig';

// Geo utilities
export {
  isValidLatLng,
  isValidBoundingBox,
  haversineMeters,
  formatDistance,
  roundCoordinate,
  cacheRoundLatLng,
  cacheRoundBBox,
  areBBoxesMeaningfullyDifferent,
  isLocationFresh,
  locationAgeSeconds,
  classifyAccuracy,
  accuracyUserMessage,
  bboxCenter,
  bboxFromCenterRadius,
  bboxContains,
  expandBBox,
} from './utils/geoUtils';
export type { LatLng, BoundingBox, AccuracyCategory } from './utils/geoUtils';

// Coordinate privacy
export {
  approximateCoordinate,
  safeRegionKey,
  safeBoundsKey,
  assertNotValidationRequest,
} from './utils/coordinatePrivacy';

// Hooks
export { useLocationPermission } from './hooks/useLocationPermission';
export type { LocationPermissionStatus } from './hooks/useLocationPermission';

export { useForegroundLocation } from './hooks/useForegroundLocation';
export type { UseForegroundLocationResult, ForegroundLocationReading } from './hooks/useForegroundLocation';

// Components
export { MapDisconnectedState } from './components/MapDisconnectedState';
export { MapPermissionBanner, LocationPermissionExplainer } from './components/MapPermissionState';
