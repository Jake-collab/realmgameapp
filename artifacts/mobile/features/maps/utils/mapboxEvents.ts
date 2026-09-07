import { isValidBoundingBox, isValidLatLng } from './geoUtils';
import type { BoundingBox } from './geoUtils';

export interface ParsedMapRegion {
  centerLatitude: number | null;
  centerLongitude: number | null;
  zoomLevel: number | null;
  bounds: BoundingBox | null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Normalize Mapbox region events before they affect query state.
 * Native and web event payloads are not identical, so malformed payloads
 * must not create invalid requests or crash the map screen.
 */
export function parseMapRegionEvent(event: unknown): ParsedMapRegion {
  if (!event || typeof event !== 'object') {
    return { centerLatitude: null, centerLongitude: null, zoomLevel: null, bounds: null };
  }

  const record = event as Record<string, unknown>;
  const properties = record.properties;
  const propertyRecord = properties && typeof properties === 'object'
    ? properties as Record<string, unknown>
    : {};
  const geometry = record.geometry;
  const geometryRecord = geometry && typeof geometry === 'object'
    ? geometry as Record<string, unknown>
    : {};
  const coordinates = geometryRecord.coordinates;
  const center = Array.isArray(coordinates) && coordinates.length >= 2
    ? coordinates
    : [];

  const centerLongitude = isNumber(center[0]) ? center[0] : null;
  const centerLatitude = isNumber(center[1]) ? center[1] : null;
  const safeCenter = centerLatitude !== null && centerLongitude !== null &&
    isValidLatLng(centerLatitude, centerLongitude);

  const rawBounds = propertyRecord.visibleBounds;
  let bounds: BoundingBox | null = null;
  if (Array.isArray(rawBounds) && rawBounds.length >= 2) {
    const southwest = rawBounds[0];
    const northeast = rawBounds[1];
    if (Array.isArray(southwest) && Array.isArray(northeast)) {
      const longitudes = [southwest[0], northeast[0]];
      const latitudes = [southwest[1], northeast[1]];
      const candidate = {
        west: Math.min(...longitudes.filter(isNumber)),
        south: Math.min(...latitudes.filter(isNumber)),
        east: Math.max(...longitudes.filter(isNumber)),
        north: Math.max(...latitudes.filter(isNumber)),
      };
      if (
        isNumber(candidate.west) &&
        isNumber(candidate.south) &&
        isNumber(candidate.east) &&
        isNumber(candidate.north) &&
        isValidBoundingBox(candidate)
      ) {
        bounds = candidate;
      }
    }
  }

  const rawZoom = propertyRecord.zoomLevel;
  const zoomLevel = isNumber(rawZoom) ? Math.max(0, Math.min(24, rawZoom)) : null;

  return {
    centerLatitude: safeCenter ? centerLatitude : null,
    centerLongitude: safeCenter ? centerLongitude : null,
    zoomLevel,
    bounds,
  };
}