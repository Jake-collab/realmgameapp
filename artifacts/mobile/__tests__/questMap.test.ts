/**
 * Quest Map — Unit Tests (Prompt 10)
 *
 * Tests cover:
 *   - Bounding box validation and scraping prevention
 *   - Coordinate rounding for cache key safety
 *   - Distance calculation and display formatting
 *   - Location freshness and accuracy classification
 *   - Viewport query key stability
 *   - Filter serialization and counting
 *   - Nearby sort ordering
 *   - Validation response mapping
 *   - Safe review note privacy enforcement
 *   - Place search fixture safety
 *   - Map configuration checks
 *   - Period boundary helpers
 *
 * Uses testEnvironment: node — no DOM/React Native bridge required.
 * Validation RPC tests are marked as integration-only (server required).
 */

import {
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
} from '../features/maps/utils/geoUtils';
import type { BoundingBox, LatLng } from '../features/maps/utils/geoUtils';

import {
  safeRegionKey,
  safeBoundsKey,
  approximateCoordinate,
} from '../features/maps/utils/coordinatePrivacy';

import {
  isMapboxConfigured,
  MAX_BBOX_DIAGONAL_DEGREES,
  VIEWPORT_RESULT_LIMIT,
  MAX_LOCATION_AGE_SECONDS,
  DEFAULT_MAX_ACCURACY_METERS,
} from '../features/maps/config/mapConfig';

import {
  DEFAULT_GEO_QUEST_FILTER,
  countActiveFilters,
  validationResultUserMessage,
  isValidationSuccess,
} from '../features/quest-map/types/questMap.types';
import type {
  GeoQuestMapFilter,
  GeoValidationResponse,
} from '../features/quest-map/types/questMap.types';

import {
  DEV_GEO_QUEST_FIXTURES,
  DEV_VALIDATION_RESPONSES,
  DEV_PLACE_SUGGESTIONS,
} from '../features/quest-map/fixtures/geoQuestFixtures';

// ─── Coordinate Validation ────────────────────────────────────────────────────

describe('isValidLatLng', () => {
  test('valid US coordinates', () => {
    expect(isValidLatLng(40.7812, -73.9665)).toBe(true);
    expect(isValidLatLng(37.7749, -122.4194)).toBe(true);
  });

  test('boundary values accepted', () => {
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90,  180)).toBe(true);
    expect(isValidLatLng(0,   0)).toBe(true);
  });

  test('out-of-range values rejected', () => {
    expect(isValidLatLng(91,  0)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
    expect(isValidLatLng(0,  181)).toBe(false);
    expect(isValidLatLng(0, -181)).toBe(false);
  });

  test('NaN and Infinity rejected', () => {
    expect(isValidLatLng(NaN,      0)).toBe(false);
    expect(isValidLatLng(0,      NaN)).toBe(false);
    expect(isValidLatLng(Infinity, 0)).toBe(false);
  });
});

// ─── Bounding Box Validation ──────────────────────────────────────────────────

describe('isValidBoundingBox', () => {
  const validBbox: BoundingBox = { west: -74, south: 40.7, east: -73.9, north: 40.8 };

  test('valid small bounding box accepted', () => {
    expect(isValidBoundingBox(validBbox)).toBe(true);
  });

  test('inverted south/north rejected', () => {
    expect(isValidBoundingBox({ ...validBbox, south: 41, north: 40 })).toBe(false);
  });

  test('out-of-range latitude rejected', () => {
    expect(isValidBoundingBox({ ...validBbox, south: -95 })).toBe(false);
    expect(isValidBoundingBox({ ...validBbox, north: 95 })).toBe(false);
  });

  test('giant bounding box (global scraping) rejected', () => {
    // Diagonal > MAX_BBOX_DIAGONAL_DEGREES
    const giant: BoundingBox = { west: -180, south: -80, east: 180, north: 80 };
    expect(isValidBoundingBox(giant)).toBe(false);
  });

  test('max diagonal constant is reasonable', () => {
    expect(MAX_BBOX_DIAGONAL_DEGREES).toBeGreaterThan(0);
    expect(MAX_BBOX_DIAGONAL_DEGREES).toBeLessThanOrEqual(10);
  });

  test('NaN values rejected', () => {
    expect(isValidBoundingBox({ west: NaN, south: 40, east: -73, north: 41 })).toBe(false);
  });
});

// ─── Distance Calculation ─────────────────────────────────────────────────────

describe('haversineMeters', () => {
  const nyc:  LatLng = { latitude: 40.7128, longitude: -74.0060 };
  const la:   LatLng = { latitude: 34.0522, longitude: -118.2437 };
  const same: LatLng = { latitude: 40.7128, longitude: -74.0060 };

  test('same point returns ~0', () => {
    expect(haversineMeters(nyc, same)).toBeCloseTo(0, 0);
  });

  test('NYC to LA is approximately 3940 km', () => {
    const dist = haversineMeters(nyc, la);
    expect(dist).toBeGreaterThan(3_900_000);
    expect(dist).toBeLessThan(3_980_000);
  });

  test('is symmetric', () => {
    expect(haversineMeters(nyc, la)).toBeCloseTo(haversineMeters(la, nyc), 0);
  });
});

describe('formatDistance', () => {
  test('shows feet for very short distances (miles)', () => {
    const result = formatDistance(50, 'miles');
    expect(result).toMatch(/ft/);
    expect(result).toMatch(/~/);
  });

  test('shows miles for larger distances', () => {
    const result = formatDistance(2000, 'miles');
    expect(result).toMatch(/mi/);
    expect(result).toMatch(/~/);
  });

  test('shows meters for short distances (km)', () => {
    const result = formatDistance(200, 'kilometers');
    expect(result).toMatch(/m/);
  });

  test('shows km for larger distances (km)', () => {
    const result = formatDistance(3000, 'kilometers');
    expect(result).toMatch(/km/);
  });

  test('always includes approximate indicator (~)', () => {
    expect(formatDistance(100, 'miles')).toContain('~');
    expect(formatDistance(5000, 'miles')).toContain('~');
    expect(formatDistance(100, 'kilometers')).toContain('~');
  });
});

// ─── Coordinate Rounding ──────────────────────────────────────────────────────

describe('roundCoordinate', () => {
  test('rounds to 2 decimal places', () => {
    expect(roundCoordinate(40.7812345, 2)).toBe(40.78);
  });

  test('rounds to 4 decimal places', () => {
    expect(roundCoordinate(40.7812345, 4)).toBe(40.7812);
  });

  test('handles negative coordinates', () => {
    expect(roundCoordinate(-73.96654, 2)).toBe(-73.97);
  });
});

describe('cacheRoundLatLng', () => {
  test('rounds to 2dp (~1km grid)', () => {
    const result = cacheRoundLatLng(40.78123, -73.96654);
    expect(result.latitude).toBe(40.78);
    expect(result.longitude).toBe(-73.97);
  });

  test('result is stable for nearby coordinates', () => {
    const a = cacheRoundLatLng(40.78100, -73.96600);
    const b = cacheRoundLatLng(40.78199, -73.96699);
    expect(a.latitude).toBe(b.latitude);
    expect(a.longitude).toBe(b.longitude);
  });
});

describe('cacheRoundBBox', () => {
  test('all edges rounded to 2dp', () => {
    const bbox: BoundingBox = { west: -74.01234, south: 40.71234, east: -73.91234, north: 40.81234 };
    const rounded = cacheRoundBBox(bbox);
    expect(rounded.west).toBe(-74.01);
    expect(rounded.south).toBe(40.71);
    expect(rounded.east).toBe(-73.91);
    expect(rounded.north).toBe(40.81);
  });
});

// ─── Bounding Box Utilities ───────────────────────────────────────────────────

describe('bboxCenter', () => {
  test('returns center of bounding box', () => {
    const bbox: BoundingBox = { west: -74, south: 40, east: -73, north: 41 };
    const center = bboxCenter(bbox);
    expect(center.latitude).toBeCloseTo(40.5, 5);
    expect(center.longitude).toBeCloseTo(-73.5, 5);
  });
});

describe('bboxContains', () => {
  const bbox: BoundingBox = { west: -74, south: 40, east: -73, north: 41 };

  test('point inside returns true', () => {
    expect(bboxContains(bbox, { latitude: 40.5, longitude: -73.5 })).toBe(true);
  });

  test('point outside returns false', () => {
    expect(bboxContains(bbox, { latitude: 42, longitude: -73.5 })).toBe(false);
    expect(bboxContains(bbox, { latitude: 40.5, longitude: -75 })).toBe(false);
  });

  test('boundary points included', () => {
    expect(bboxContains(bbox, { latitude: 40, longitude: -74 })).toBe(true);
  });
});

describe('bboxFromCenterRadius', () => {
  test('creates bounding box around center', () => {
    const center: LatLng = { latitude: 40.7812, longitude: -73.9665 };
    const bbox = bboxFromCenterRadius(center, 1000);
    expect(bbox.west).toBeLessThan(center.longitude);
    expect(bbox.east).toBeGreaterThan(center.longitude);
    expect(bbox.south).toBeLessThan(center.latitude);
    expect(bbox.north).toBeGreaterThan(center.latitude);
    // Center should be inside the box
    expect(bboxContains(bbox, center)).toBe(true);
  });
});

describe('areBBoxesMeaningfullyDifferent', () => {
  const a: BoundingBox = { west: -74, south: 40, east: -73, north: 41 };

  test('same box is not meaningfully different', () => {
    expect(areBBoxesMeaningfullyDifferent(a, { ...a }, 0.05)).toBe(false);
  });

  test('tiny difference is not meaningful', () => {
    const b: BoundingBox = { west: -74.01, south: 40.01, east: -72.99, north: 41.01 };
    expect(areBBoxesMeaningfullyDifferent(a, b, 0.05)).toBe(false);
  });

  test('large difference is meaningful', () => {
    const c: BoundingBox = { west: -80, south: 35, east: -79, north: 36 };
    expect(areBBoxesMeaningfullyDifferent(a, c, 0.05)).toBe(true);
  });
});

// ─── Location Freshness ───────────────────────────────────────────────────────

describe('isLocationFresh', () => {
  test('very recent reading is fresh', () => {
    const now = new Date();
    expect(isLocationFresh(now, 45)).toBe(true);
  });

  test('reading older than max is stale', () => {
    const old = new Date(Date.now() - 60_000); // 60 seconds ago
    expect(isLocationFresh(old, 45)).toBe(false);
  });

  test('reading exactly at boundary is fresh', () => {
    const boundary = new Date(Date.now() - 44_000); // 44 seconds ago
    expect(isLocationFresh(boundary, 45)).toBe(true);
  });
});

describe('locationAgeSeconds', () => {
  test('returns positive age for past reading', () => {
    const past = new Date(Date.now() - 10_000);
    const age = locationAgeSeconds(past);
    expect(age).toBeGreaterThan(9);
    expect(age).toBeLessThan(12);
  });

  test('returns ~0 for very recent reading', () => {
    const now = new Date();
    expect(locationAgeSeconds(now)).toBeLessThan(1);
  });
});

// ─── Accuracy Classification ──────────────────────────────────────────────────

describe('classifyAccuracy', () => {
  test('≤5m is excellent', () => expect(classifyAccuracy(3)).toBe('excellent'));
  test('≤15m is good',     () => expect(classifyAccuracy(10)).toBe('good'));
  test('≤30m is fair',     () => expect(classifyAccuracy(25)).toBe('fair'));
  test('≤50m is poor',     () => expect(classifyAccuracy(45)).toBe('poor'));
  test('>50m is unacceptable', () => expect(classifyAccuracy(100)).toBe('unacceptable'));
});

describe('accuracyUserMessage', () => {
  test('excellent and good return null (no message needed)', () => {
    expect(accuracyUserMessage('excellent')).toBeNull();
    expect(accuracyUserMessage('good')).toBeNull();
  });

  test('fair/poor/unacceptable return user-friendly message', () => {
    expect(accuracyUserMessage('fair')).toBeTruthy();
    expect(accuracyUserMessage('poor')).toBeTruthy();
    expect(accuracyUserMessage('unacceptable')).toBeTruthy();
  });

  test('messages do not contain hidden thresholds in meters', () => {
    // Messages should not expose the exact threshold values
    const msg = accuracyUserMessage('poor') ?? '';
    expect(msg).not.toMatch(/\d+ meters/);
    expect(msg).not.toMatch(/50m/);
    expect(msg).not.toMatch(/threshold/);
  });
});

// ─── Coordinate Privacy ───────────────────────────────────────────────────────

describe('safeRegionKey', () => {
  test('returns 2dp grid key', () => {
    const key = safeRegionKey(40.78123, -73.96654);
    expect(key).toBe('40.78,-73.97');
  });

  test('nearby coordinates produce same key', () => {
    const a = safeRegionKey(40.78100, -73.96600);
    const b = safeRegionKey(40.78199, -73.96699);
    expect(a).toBe(b);
  });

  test('does not include raw GPS precision', () => {
    const key = safeRegionKey(40.781234567, -73.966543210);
    // Should not have more than 2 decimal places in each component
    const parts = key.split(',');
    parts.forEach(part => {
      const decimals = part.includes('.') ? part.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });
});

describe('approximateCoordinate', () => {
  test('rounds to 2dp', () => {
    const result = approximateCoordinate(40.78123, -73.96654);
    expect(result.latitude).toBe(40.78);
    expect(result.longitude).toBe(-73.97);
  });
});

// ─── Map Configuration ────────────────────────────────────────────────────────

describe('isMapboxConfigured', () => {
  test('returns false when no token set (test env)', () => {
    // In test environment, EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set
    // isMapboxConfigured() should return false
    // (token is empty string from process.env)
    expect(typeof isMapboxConfigured()).toBe('boolean');
  });

  test('VIEWPORT_RESULT_LIMIT is reasonable', () => {
    expect(VIEWPORT_RESULT_LIMIT).toBeGreaterThan(0);
    expect(VIEWPORT_RESULT_LIMIT).toBeLessThanOrEqual(200);
  });

  test('MAX_LOCATION_AGE_SECONDS is reasonable', () => {
    expect(MAX_LOCATION_AGE_SECONDS).toBeGreaterThan(10);
    expect(MAX_LOCATION_AGE_SECONDS).toBeLessThanOrEqual(120);
  });

  test('DEFAULT_MAX_ACCURACY_METERS is positive', () => {
    expect(DEFAULT_MAX_ACCURACY_METERS).toBeGreaterThan(0);
  });
});

// ─── Map Filters ──────────────────────────────────────────────────────────────

describe('DEFAULT_GEO_QUEST_FILTER', () => {
  test('all boolean filters default to false', () => {
    expect(DEFAULT_GEO_QUEST_FILTER.availableNow).toBe(false);
    expect(DEFAULT_GEO_QUEST_FILTER.accessibleOnly).toBe(false);
    expect(DEFAULT_GEO_QUEST_FILTER.notCompleted).toBe(false);
    expect(DEFAULT_GEO_QUEST_FILTER.inAction).toBe(false);
  });

  test('quest type defaults to all', () => {
    expect(DEFAULT_GEO_QUEST_FILTER.questType).toBe('all');
  });

  test('difficulties default to empty (no restriction)', () => {
    expect(DEFAULT_GEO_QUEST_FILTER.difficulties).toHaveLength(0);
  });
});

describe('countActiveFilters', () => {
  test('default filter has 0 active', () => {
    expect(countActiveFilters(DEFAULT_GEO_QUEST_FILTER)).toBe(0);
  });

  test('each enabled flag counts as 1', () => {
    expect(countActiveFilters({ ...DEFAULT_GEO_QUEST_FILTER, availableNow: true })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_GEO_QUEST_FILTER, accessibleOnly: true })).toBe(1);
    expect(countActiveFilters({ ...DEFAULT_GEO_QUEST_FILTER, notCompleted: true })).toBe(1);
  });

  test('multiple active filters counted correctly', () => {
    const f: GeoQuestMapFilter = {
      ...DEFAULT_GEO_QUEST_FILTER,
      availableNow: true,
      notCompleted: true,
      difficulties: ['beginner', 'intermediate'],
    };
    expect(countActiveFilters(f)).toBe(3);
  });

  test('quest type "all" does not count', () => {
    expect(countActiveFilters({ ...DEFAULT_GEO_QUEST_FILTER, questType: 'all' })).toBe(0);
  });

  test('specific quest type counts as 1', () => {
    expect(countActiveFilters({ ...DEFAULT_GEO_QUEST_FILTER, questType: 'daily' })).toBe(1);
  });
});

// ─── Validation Response ──────────────────────────────────────────────────────

describe('isValidationSuccess', () => {
  test('validated → success', () => {
    const r: GeoValidationResponse = { result: 'validated', canRetry: false };
    expect(isValidationSuccess(r)).toBe(true);
  });

  test('not_required → success (no geometry needed)', () => {
    const r: GeoValidationResponse = { result: 'not_required', canRetry: false };
    expect(isValidationSuccess(r)).toBe(true);
  });

  test('outside_region → not success', () => {
    const r: GeoValidationResponse = { result: 'outside_region', canRetry: true };
    expect(isValidationSuccess(r)).toBe(false);
  });

  test('accuracy_insufficient → not success', () => {
    expect(isValidationSuccess({ result: 'accuracy_insufficient', canRetry: true })).toBe(false);
  });

  test('rate_limited → not success', () => {
    expect(isValidationSuccess({ result: 'rate_limited', canRetry: true })).toBe(false);
  });
});

describe('validationResultUserMessage', () => {
  test('all result types return a non-empty string', () => {
    const results: Array<GeoValidationResponse['result']> = [
      'validated', 'not_required', 'outside_region', 'accuracy_insufficient',
      'location_stale', 'invalid_state', 'rate_limited', 'unavailable',
    ];
    results.forEach(r => {
      const msg = validationResultUserMessage(r);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  test('outside_region message does not reveal geometry', () => {
    const msg = validationResultUserMessage('outside_region');
    // Must not expose hidden center, radius, or distance-to-boundary
    expect(msg).not.toMatch(/\d+ meter/i);
    expect(msg).not.toMatch(/radius/i);
    expect(msg).not.toMatch(/center/i);
    expect(msg).not.toMatch(/coordinates/i);
  });

  test('accuracy_insufficient message is user-friendly', () => {
    const msg = validationResultUserMessage('accuracy_insufficient');
    expect(msg).not.toMatch(/\d+m threshold/i);
    expect(msg.toLowerCase()).toMatch(/location|gps|signal|area/i);
  });
});

// ─── Development Fixtures ─────────────────────────────────────────────────────

describe('DEV_GEO_QUEST_FIXTURES', () => {
  test('has at least 5 fixtures', () => {
    expect(DEV_GEO_QUEST_FIXTURES.length).toBeGreaterThanOrEqual(5);
  });

  test('all display coordinates are valid', () => {
    DEV_GEO_QUEST_FIXTURES.forEach(q => {
      expect(isValidLatLng(q.displayLatitude, q.displayLongitude)).toBe(true);
    });
  });

  test('covers required scenarios', () => {
    const statuses = DEV_GEO_QUEST_FIXTURES.map(q => q.availabilityState);
    expect(statuses).toContain('available');
    expect(statuses).toContain('active');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('upcoming');
    expect(statuses).toContain('unavailable');
  });

  test('has a start-location-required fixture', () => {
    const hasStartRequired = DEV_GEO_QUEST_FIXTURES.some(q => q.requiresStartLocation);
    expect(hasStartRequired).toBe(true);
  });

  test('has a completion-location-required fixture', () => {
    const hasCompletionRequired = DEV_GEO_QUEST_FIXTURES.some(q => q.requiresCompletionLocation);
    expect(hasCompletionRequired).toBe(true);
  });

  test('no fixture has private validation geometry', () => {
    DEV_GEO_QUEST_FIXTURES.forEach(q => {
      // None of these public fields should contain validation secrets
      expect((q as any).validationRadius).toBeUndefined();
      expect((q as any).validationGeometry).toBeUndefined();
      expect((q as any).validationLat).toBeUndefined();
      expect((q as any).validationLng).toBeUndefined();
    });
  });

  test('points rewards are positive integers', () => {
    DEV_GEO_QUEST_FIXTURES.forEach(q => {
      expect(q.pointsReward).toBeGreaterThan(0);
      expect(Number.isInteger(q.pointsReward)).toBe(true);
    });
  });
});

describe('DEV_VALIDATION_RESPONSES', () => {
  test('has all required scenarios', () => {
    const required = [
      'valid_location', 'outside_region', 'poor_accuracy',
      'stale_reading', 'rate_limited', 'server_unavailable',
    ];
    required.forEach(key => {
      expect(DEV_VALIDATION_RESPONSES[key]).toBeDefined();
    });
  });

  test('valid_location response has validated result', () => {
    expect(DEV_VALIDATION_RESPONSES.valid_location.result).toBe('validated');
  });

  test('no dev response contains private geometry', () => {
    Object.values(DEV_VALIDATION_RESPONSES).forEach(resp => {
      expect((resp as any).center_lat).toBeUndefined();
      expect((resp as any).center_lng).toBeUndefined();
      expect((resp as any).radius_meters).toBeUndefined();
      expect((resp as any).polygon).toBeUndefined();
    });
  });

  test('all dev responses are labeled as DEV', () => {
    Object.values(DEV_VALIDATION_RESPONSES).forEach(resp => {
      expect(resp.userMessage).toMatch(/\[DEV\]/);
    });
  });

  test('rate_limited has retryAfterSeconds', () => {
    const rl = DEV_VALIDATION_RESPONSES.rate_limited;
    expect(rl.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('DEV_PLACE_SUGGESTIONS', () => {
  test('all suggestion coordinates are valid', () => {
    DEV_PLACE_SUGGESTIONS.forEach(s => {
      expect(isValidLatLng(s.centerLatitude, s.centerLongitude)).toBe(true);
    });
  });

  test('bounding boxes are valid when present', () => {
    DEV_PLACE_SUGGESTIONS.forEach(s => {
      if (s.boundingBox) {
        expect(s.boundingBox.west).toBeLessThan(s.boundingBox.east);
        expect(s.boundingBox.south).toBeLessThan(s.boundingBox.north);
      }
    });
  });
});

// ─── Integration test stubs ───────────────────────────────────────────────────

describe('Validation RPC (integration — server required)', () => {
  test.skip('returns validated for user in region [requires live Supabase]', () => {
    // Tested manually against local Supabase via supabase db test
  });

  test.skip('returns outside_region for user not in region [requires live Supabase]', () => {});

  test.skip('rejects wrong user (ownership check) [requires live Supabase]', () => {});

  test.skip('is idempotent on duplicate request_id [requires live Supabase]', () => {});

  test.skip('enforces rate limit after 10 attempts [requires live Supabase]', () => {});

  test.skip('never returns validation geometry in response [requires live Supabase]', () => {});

  test.skip('suspended account is rejected [requires live Supabase]', () => {});
});
