/**
 * Geographic Utilities — Worlds
 *
 * Pure functions for bounding-box creation, distance calculation, coordinate
 * rounding, and safe coordinate validation.
 *
 * Rules:
 * - All functions are pure (no side-effects).
 * - No Mapbox SDK imports in this file.
 * - Do not log raw coordinates from sensitive validation operations.
 * - Distance display: straight-line (haversine) only — never imply route distance.
 */

import type { DistanceUnit } from '../config/mapConfig';
import { MAX_BBOX_DIAGONAL_DEGREES } from '../config/mapConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ViewportRequest {
  bounds: BoundingBox;
  /** Current Mapbox zoom level — used for density hints */
  zoomLevel: number;
}

// ─── Coordinate validation ────────────────────────────────────────────────────

/** Returns true when coordinates are within valid WGS-84 ranges */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/** Returns true when the bounding box is valid and within scraping limits */
export function isValidBoundingBox(bbox: BoundingBox): boolean {
  const { west, south, east, north } = bbox;
  if (
    !Number.isFinite(west) || !Number.isFinite(south) ||
    !Number.isFinite(east) || !Number.isFinite(north)
  ) return false;
  if (south < -90 || north > 90 || south >= north) return false;
  if (west < -180 || east > 180) return false;

  // Prevent global scraping via giant bounding boxes
  const diagonal = Math.sqrt(
    Math.pow(north - south, 2) + Math.pow(east - west, 2)
  );
  return diagonal <= MAX_BBOX_DIAGONAL_DEGREES;
}

// ─── Distance ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

/**
 * Haversine straight-line distance between two coordinates, in meters.
 * Never use as a proxy for route distance.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;

  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Human-readable approximate distance string.
 * Always labeled "~" to indicate straight-line approximation.
 */
export function formatDistance(
  meters: number,
  unit: DistanceUnit = 'miles'
): string {
  if (unit === 'miles') {
    const feet = meters * FEET_PER_METER;
    if (feet < 1000) return `~${Math.round(feet / 100) * 100} ft`;
    const miles = meters / METERS_PER_MILE;
    if (miles < 10) return `~${miles.toFixed(1)} mi`;
    return `~${Math.round(miles)} mi`;
  } else {
    if (meters < 1000) return `~${Math.round(meters / 100) * 100} m`;
    const km = meters / 1000;
    if (km < 10) return `~${km.toFixed(1)} km`;
    return `~${Math.round(km)} km`;
  }
}

/** Straight-line distance between two coordinates in miles */
export function distanceMiles(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b) / METERS_PER_MILE;
}

// ─── Coordinate rounding ──────────────────────────────────────────────────────

/**
 * Round coordinate to N decimal places.
 * 2dp ≈ 1 km grid — safe for cache keys and non-sensitive region queries.
 * 4dp ≈ 11 m — acceptable for display but not for hidden validation geometry.
 */
export function roundCoordinate(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

/**
 * Round coordinates to a coarse grid for React Query cache keys.
 * Uses 2dp (~1 km) to avoid cache fragmentation from GPS drift.
 * Do NOT use for display or validation purposes.
 */
export function cacheRoundLatLng(lat: number, lng: number): LatLng {
  return {
    latitude: roundCoordinate(lat, 2),
    longitude: roundCoordinate(lng, 2),
  };
}

/**
 * Round bounding box edges to a coarse grid for cache key stability.
 * Avoids duplicate requests for nearly identical map positions.
 */
export function cacheRoundBBox(bbox: BoundingBox): BoundingBox {
  return {
    west:  roundCoordinate(bbox.west,  2),
    south: roundCoordinate(bbox.south, 2),
    east:  roundCoordinate(bbox.east,  2),
    north: roundCoordinate(bbox.north, 2),
  };
}

// ─── Bounding box helpers ─────────────────────────────────────────────────────

/** Expand a bounding box by a fixed number of degrees on each side */
export function expandBBox(bbox: BoundingBox, degrees: number): BoundingBox {
  return {
    west:  Math.max(-180, bbox.west  - degrees),
    south: Math.max(-90,  bbox.south - degrees),
    east:  Math.min(180,  bbox.east  + degrees),
    north: Math.min(90,   bbox.north + degrees),
  };
}

/** Create a bounding box from a center point and radius in meters */
export function bboxFromCenterRadius(center: LatLng, radiusMeters: number): BoundingBox {
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lngDelta =
    latDelta / Math.cos((center.latitude * Math.PI) / 180);
  return {
    west:  center.longitude - lngDelta,
    south: center.latitude  - latDelta,
    east:  center.longitude + lngDelta,
    north: center.latitude  + latDelta,
  };
}

/** Center point of a bounding box */
export function bboxCenter(bbox: BoundingBox): LatLng {
  return {
    latitude:  (bbox.south + bbox.north) / 2,
    longitude: (bbox.west  + bbox.east)  / 2,
  };
}

/** True when point is contained within the bounding box */
export function bboxContains(bbox: BoundingBox, point: LatLng): boolean {
  return (
    point.latitude  >= bbox.south &&
    point.latitude  <= bbox.north &&
    point.longitude >= bbox.west  &&
    point.longitude <= bbox.east
  );
}

/**
 * Determine whether two bounding boxes are meaningfully different.
 * Returns false (same) when they differ by less than the threshold.
 * Used to decide whether to fire a new viewport query.
 */
export function areBBoxesMeaningfullyDifferent(
  a: BoundingBox,
  b: BoundingBox,
  thresholdDegrees = 0.05,
): boolean {
  return (
    Math.abs(a.west  - b.west)  > thresholdDegrees ||
    Math.abs(a.south - b.south) > thresholdDegrees ||
    Math.abs(a.east  - b.east)  > thresholdDegrees ||
    Math.abs(a.north - b.north) > thresholdDegrees
  );
}

// ─── Timestamp freshness ──────────────────────────────────────────────────────

/**
 * Return the age of a reading in seconds.
 * Used to check location freshness before validation.
 */
export function locationAgeSeconds(capturedAt: Date): number {
  return (Date.now() - capturedAt.getTime()) / 1000;
}

/** True when a captured reading is within the allowed age limit */
export function isLocationFresh(capturedAt: Date, maxAgeSeconds: number): boolean {
  return locationAgeSeconds(capturedAt) <= maxAgeSeconds;
}

// ─── Accuracy category ────────────────────────────────────────────────────────

export type AccuracyCategory = 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable';

/**
 * Classify horizontal accuracy into a display category.
 * Do not expose raw thresholds in user-facing error messages.
 */
export function classifyAccuracy(horizontalAccuracyMeters: number): AccuracyCategory {
  if (horizontalAccuracyMeters <= 5)  return 'excellent';
  if (horizontalAccuracyMeters <= 15) return 'good';
  if (horizontalAccuracyMeters <= 30) return 'fair';
  if (horizontalAccuracyMeters <= 50) return 'poor';
  return 'unacceptable';
}

/** User-facing message for poor accuracy — does not expose thresholds */
export function accuracyUserMessage(category: AccuracyCategory): string | null {
  switch (category) {
    case 'excellent':
    case 'good':
      return null;
    case 'fair':
      return 'Your location signal is weak. Try moving to an open area.';
    case 'poor':
    case 'unacceptable':
      return 'Your location signal is not accurate enough yet. Move to an open area and try again.';
  }
}
