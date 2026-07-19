/**
 * Map Configuration — Worlds
 *
 * Single source of truth for Mapbox token, style URLs, camera defaults,
 * and development fallback detection.
 *
 * NEVER import this file in server/Edge Function code.
 * NEVER place service-role secrets here.
 * The Mapbox public access token is safe for client use (rate-limited by domain).
 */

// ─── Token ────────────────────────────────────────────────────────────────────

/**
 * Public Mapbox access token.
 * Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env (development) and EAS secrets (production).
 * Production builds must not expose developer config instructions.
 */
export const MAPBOX_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

/** True when a Mapbox token is present and non-empty */
export const isMapboxConfigured = (): boolean =>
  typeof MAPBOX_ACCESS_TOKEN === 'string' && MAPBOX_ACCESS_TOKEN.trim().length > 10;

// ─── Style URLs ───────────────────────────────────────────────────────────────

/**
 * Mapbox style identifiers.
 * Override with EXPO_PUBLIC_MAPBOX_STYLE_LIGHT / _DARK / _SATELLITE
 * to use a custom Mapbox Studio style.
 *
 * Attribution: Mapbox requires attribution display in the map view.
 * Do not suppress the default Mapbox attribution logo.
 */
export const MAP_STYLES = {
  light: process.env.EXPO_PUBLIC_MAPBOX_STYLE_LIGHT
    ?? 'mapbox://styles/mapbox/light-v11',
  dark: process.env.EXPO_PUBLIC_MAPBOX_STYLE_DARK
    ?? 'mapbox://styles/mapbox/dark-v11',
  satellite: process.env.EXPO_PUBLIC_MAPBOX_STYLE_SATELLITE
    ?? 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

// ─── Camera defaults ──────────────────────────────────────────────────────────

/**
 * Safe default map region for the US product rollout.
 * Used when location permission is unavailable or denied.
 * Centered on the contiguous United States.
 */
export const DEFAULT_MAP_REGION = {
  latitude: 39.5,
  longitude: -98.35,
  /** Discovery zoom — shows state-level detail */
  zoomLevel: 5,
} as const;

/** Zoom level used when centering on the user's current location */
export const USER_LOCATION_ZOOM = 13;

/** Zoom level used when selecting a Quest marker */
export const QUEST_SELECTED_ZOOM = 15;

/** Maximum zoom stored/restored as last-used viewport */
export const MAX_STORED_ZOOM = 17;

/** Minimum useful zoom for Quest discovery */
export const MIN_DISCOVERY_ZOOM = 10;

// ─── Viewport query limits ────────────────────────────────────────────────────

/** Maximum Geo-Quests returned from a single viewport RPC call */
export const VIEWPORT_RESULT_LIMIT = 60;

/** Maximum bounding box diagonal in degrees — prevents global scraping */
export const MAX_BBOX_DIAGONAL_DEGREES = 5.0;

/** Debounce delay (ms) before firing a viewport query after map movement ends */
export const VIEWPORT_DEBOUNCE_MS = 600;

/** Stale time for viewport query results (ms) */
export const VIEWPORT_STALE_MS = 2 * 60 * 1000;

/** Stale time for nearby-quest results (ms) */
export const NEARBY_STALE_MS = 90 * 1000;

// ─── Location validation ──────────────────────────────────────────────────────

/**
 * Maximum age (seconds) of a foreground location reading used for protected validation.
 * Quest configuration may tighten this limit — this is the absolute maximum.
 */
export const MAX_LOCATION_AGE_SECONDS = 45;

/**
 * Default maximum horizontal accuracy (meters) required for validation.
 * Quest configuration may require tighter accuracy for specific objectives.
 */
export const DEFAULT_MAX_ACCURACY_METERS = 50;

/** Minimum delay (ms) between validation retry attempts */
export const VALIDATION_RETRY_DELAY_MS = 10_000;

// ─── Place search ─────────────────────────────────────────────────────────────

/** Debounce delay (ms) for place search text input */
export const SEARCH_DEBOUNCE_MS = 400;

/** Maximum suggestions returned from place search */
export const SEARCH_MAX_SUGGESTIONS = 5;

/**
 * Geographic bounding box restricting place search to the continental US.
 * Adjust when product expands internationally.
 */
export const SEARCH_BBOX_US = '-171.79,18.91,-66.96,71.36';

// ─── Distance display ─────────────────────────────────────────────────────────

/** Default distance unit. US locale default. */
export type DistanceUnit = 'miles' | 'kilometers';
export const DEFAULT_DISTANCE_UNIT: DistanceUnit = 'miles';

// ─── Development message ──────────────────────────────────────────────────────

/**
 * Message shown in development when Mapbox is not configured.
 * Never shown in production — production uses a generic "Map unavailable" state.
 */
export const DEV_MAP_UNAVAILABLE_MESSAGE =
  'Map setup is pending. Geo-Quest mapping will be enabled after Mapbox is connected.';
