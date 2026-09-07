import { parseMapRegionEvent } from '../features/maps/utils/mapboxEvents';
import { isValidLatLng } from '../features/maps/utils/geoUtils';

describe('parseMapRegionEvent', () => {
  it('normalizes native bounds regardless of corner ordering', () => {
    const result = parseMapRegionEvent({
      geometry: { coordinates: [-73.95, 40.75] },
      properties: {
        zoomLevel: 12.25,
        visibleBounds: [
          [-73.9, 40.8],
          [-74.0, 40.7],
        ],
      },
    });

    expect(result.centerLatitude).toBe(40.75);
    expect(result.centerLongitude).toBe(-73.95);
    expect(result.zoomLevel).toBe(12.25);
    expect(result.bounds).toEqual({
      west: -74,
      south: 40.7,
      east: -73.9,
      north: 40.8,
    });
  });

  it('rejects malformed coordinates and bounds instead of creating a query', () => {
    const result = parseMapRegionEvent({
      geometry: { coordinates: [Number.NaN, 40.75] },
      properties: {
        zoomLevel: Number.POSITIVE_INFINITY,
        visibleBounds: [
          [-74, 40.7],
          [-73, 95],
        ],
      },
    });

    expect(result.centerLatitude).toBeNull();
    expect(result.centerLongitude).toBeNull();
    expect(result.zoomLevel).toBeNull();
    expect(result.bounds).toBeNull();
  });

  it('keeps the privacy coordinate guard independent of event shape', () => {
    expect(isValidLatLng(40.75, -73.95)).toBe(true);
    expect(isValidLatLng(95, -73.95)).toBe(false);
  });
});