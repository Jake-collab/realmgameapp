import { describe, expect, it } from '@jest/globals';
import {
  clampHuntRadius,
  distanceMeters,
  evaluateHuntPlacement,
  isInsideCollectionRadius,
  isInsideSearchZone,
} from '../features/hunts/services/huntCanonical.service';
import {
  calculateCustomHuntBudget,
  validateHuntPointAllocations,
} from '../features/hunts/services/huntPointBudget.service';
import { DEFAULT_CANONICAL_HUNT_POLICY, type HuntPlacementSignals } from '../features/hunts/types/canonicalHunt.types';

const safePlacement: HuntPlacementSignals = {
  placementMethod: 'VERIFIED_IN_PERSON',
  latitude: 40.7128,
  longitude: -74.006,
  gpsAccuracyMeters: 8,
  scanComplete: true,
  motionCoverageDegrees: 360,
  creatorDeclarationConfirmed: true,
  mapClassification: 'PEDESTRIAN_PUBLIC_AREA',
  sceneClassification: {
    indoor: false,
    roadwayVisible: false,
    pedestrianSpace: true,
    residentialEnvironment: false,
    publicVenueLikely: false,
    restrictedSignage: false,
    constructionOrHazard: false,
    trafficRisk: false,
    safeDropAreaLikely: true,
  },
  mediaModeration: 'approved',
  visionAvailable: true,
  locationSceneMismatch: false,
};

describe('canonical Hunt geometry', () => {
  it('uses broad public search zones rather than a collection radius', () => {
    const zone = {
      searchCenterLatitude: 40.7128,
      searchCenterLongitude: -74.006,
      searchRadiusMeters: 350,
    };
    const player = { latitude: 40.7148, longitude: -74.006 };
    expect(isInsideSearchZone(player, zone)).toBe(true);
    expect(isInsideCollectionRadius(player, { latitude: 40.7128, longitude: -74.006 }, 25)).toBe(false);
  });

  it('keeps radius configuration inside canonical limits', () => {
    expect(clampHuntRadius(1, 200, 500, 350)).toBe(200);
    expect(clampHuntRadius(900, 200, 500, 350)).toBe(500);
    expect(clampHuntRadius(null, 200, 500, 350)).toBe(350);
  });

  it('calculates distance without retaining a player location', () => {
    const meters = distanceMeters({ latitude: 40.7128, longitude: -74.006 }, { latitude: 40.7138, longitude: -74.006 });
    expect(meters).toBeGreaterThan(100);
    expect(meters).toBeLessThan(120);
  });
});

describe('canonical Hunt placement safety', () => {
  it('passes a complete, public, safe in-person placement', () => {
    expect(evaluateHuntPlacement(safePlacement).decision).toBe('PASS');
  });

  it.each(['ROADWAY', 'RESTRICTED_LIKELY', 'HAZARDOUS_LIKELY', 'RESIDENTIAL_PRIVATE_LIKELY'] as const)(
    'rejects blocked map location: %s',
    mapClassification => {
      expect(evaluateHuntPlacement({ ...safePlacement, mapClassification }).decision).toBe('REJECT');
    },
  );

  it('routes weak GPS, missing scan, and unavailable vision to review', () => {
    const result = evaluateHuntPlacement({
      ...safePlacement,
      gpsAccuracyMeters: 60,
      scanComplete: false,
      motionCoverageDegrees: 90,
      visionAvailable: false,
    });
    expect(result.decision).toBe('REVIEW');
    expect(result.signals).toEqual(expect.arrayContaining(['WEAK_GPS', 'INCOMPLETE_SCAN', 'VISION_UNAVAILABLE']));
  });

  it('never lets remote placement auto-pass', () => {
    expect(evaluateHuntPlacement({ ...safePlacement, placementMethod: 'REMOTE_ADMIN_REVIEW' }).decision).toBe('REVIEW');
  });

  it('requires explicit creator safety acknowledgement', () => {
    expect(evaluateHuntPlacement({ ...safePlacement, creatorDeclarationConfirmed: false }).decision).toBe('REVIEW');
  });
});

describe('canonical Hunt rewards', () => {
  it('derives a bounded Custom Hunt budget', () => {
    const budget = calculateCustomHuntBudget({ requiredDropCount: 20, estimatedDurationMinutes: 360, proofBurden: 20, difficulty: 10 });
    expect(budget).toBe(DEFAULT_CANONICAL_HUNT_POLICY.maxCustomHuntPoints);
  });

  it('rejects allocations beyond the creator budget', () => {
    const result = validateHuntPointAllocations([
      { dropId: 'a', points: 150, required: true },
      { dropId: 'b', points: 100, required: true },
    ], 200);
    expect(result.valid).toBe(false);
    expect(result.issues.join(' ')).toContain('cannot exceed');
  });

  it('rejects required Drops without a point value', () => {
    const result = validateHuntPointAllocations([{ dropId: 'a', points: 0, required: true }], 100);
    expect(result.valid).toBe(false);
  });
});