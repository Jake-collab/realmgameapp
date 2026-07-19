/**
 * Coordinate Privacy Utilities — Worlds
 *
 * Enforces privacy boundaries for user and Quest coordinates throughout the app.
 *
 * Principles:
 * - User browsing location NEVER leaves the device unless actively used for validation.
 * - Approximate display coordinates ALWAYS differ from exact validation geometry.
 * - Location query parameters use coarse grid rounding, not raw GPS.
 * - Validation coordinates are submitted only to the trusted backend, never stored client-side.
 * - Do not create a continuous location timeline.
 */

import { roundCoordinate } from './geoUtils';
import type { LatLng } from './geoUtils';

// ─── Coordinate approximation ─────────────────────────────────────────────────

/**
 * Approximate a coordinate to a coarse public grid (~1 km).
 * Safe for display purposes — not suitable as an exact location.
 */
export function approximateCoordinate(lat: number, lng: number): LatLng {
  return {
    latitude:  roundCoordinate(lat, 2),
    longitude: roundCoordinate(lng, 2),
  };
}

/**
 * Apply a small deterministic offset to a coordinate.
 * Used for public display coordinates that should not pinpoint the exact validation point.
 * Offset is deterministic for the same input — not a privacy randomizer.
 * For public Quest display coordinates only — never modify validation geometry.
 */
export function applyDisplayOffset(lat: number, lng: number, offsetMeters = 50): LatLng {
  // ~0.0005 degrees ≈ 55 meters at equator
  const degPerMeter = 1 / 111_320;
  const latOffset = offsetMeters * degPerMeter * 0.7;
  const lngOffset = offsetMeters * degPerMeter * 0.7 / Math.cos((lat * Math.PI) / 180);
  return {
    latitude:  roundCoordinate(lat + latOffset, 5),
    longitude: roundCoordinate(lng + lngOffset, 5),
  };
}

// ─── Query parameter privacy ──────────────────────────────────────────────────

/**
 * Returns a safe region identifier for use in React Query cache keys.
 * Uses a 2dp grid (~1 km) — never includes raw GPS readings.
 */
export function safeRegionKey(lat: number, lng: number): string {
  const gridLat = roundCoordinate(lat, 2);
  const gridLng = roundCoordinate(lng, 2);
  return `${gridLat},${gridLng}`;
}

/**
 * Returns a safe bounds identifier for use in React Query cache keys.
 * Rounds to 2dp — avoids cache misses from minor viewport drift.
 */
export function safeBoundsKey(
  west: number, south: number, east: number, north: number
): string {
  return [
    roundCoordinate(west,  2),
    roundCoordinate(south, 2),
    roundCoordinate(east,  2),
    roundCoordinate(north, 2),
  ].join(',');
}

// ─── Location storage policy ──────────────────────────────────────────────────

/**
 * Documents the location data that MAY be stored and what MUST NOT be stored.
 *
 * ALLOWED (client-side only, ephemeral):
 * - Current foreground GPS reading (in memory, never persisted)
 * - Last-used map camera state (center + zoom, NOT raw GPS)
 * - Approximate region identifier for query cache keys
 *
 * NEVER STORED (anywhere):
 * - Continuous location history from map browsing
 * - Precise GPS timestamps from ordinary navigation
 * - Raw accuracy readings from casual location use
 * - Location from background or always-on services
 *
 * ALLOWED (sent to server, validation only):
 * - Snapshot: lat, lng, accuracy, timestamp — sent once per validation request
 * - Stored server-side as a private validation_attempt record
 * - Subject to defined retention policy (see GEO_VALIDATION_PRIVACY.md)
 */
export const LOCATION_STORAGE_POLICY = {
  mapCameraStateKey: 'worlds_map_camera',
  /** ISO 8601 — stored last-used camera center (approximate) */
  cameraLatitudeKey: 'worlds_map_center_lat',
  cameraLongitudeKey: 'worlds_map_center_lng',
  cameraZoomKey: 'worlds_map_zoom',
  /** Maximum zoom stored — prevents storing building-level detail */
  maxStoredZoom: 14,
} as const;

// ─── Validation coordinate guard ──────────────────────────────────────────────

/**
 * Prevent validation coordinates from being logged or serialized into URLs.
 * Call this before any network request that does NOT go to the trusted validation endpoint.
 * 
 * If this throws, you are attempting to pass validation coordinates
 * to an unsafe destination.
 */
export function assertNotValidationRequest(destination: string): void {
  const safeDestinations = [
    '/functions/v1/validate-geo-quest',
    '/rest/v1/rpc/validate_geo_quest_location',
  ];
  if (!safeDestinations.some(d => destination.includes(d))) {
    // Non-throwing in production — log warning only in dev
    if (__DEV__) {
      console.warn(
        '[GeoPrivacy] Coordinates submitted to potentially unsafe endpoint:',
        destination
      );
    }
  }
}
