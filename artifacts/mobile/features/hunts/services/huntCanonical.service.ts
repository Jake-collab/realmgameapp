import {
  DEFAULT_CANONICAL_HUNT_POLICY,
  type CanonicalHuntPolicy,
  type HuntPlacementEvaluation,
  type HuntPlacementSignals,
  type PublicHuntSearchZone,
} from '../types/canonicalHunt.types';

const EARTH_RADIUS_METERS = 6_371_000;

export function clampHuntRadius(value: number | null | undefined, minimum: number, maximum: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value as number)));
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isInsideSearchZone(
  player: { latitude: number; longitude: number },
  zone: Pick<PublicHuntSearchZone, 'searchCenterLatitude' | 'searchCenterLongitude' | 'searchRadiusMeters'>,
): boolean {
  return distanceMeters(player, {
    latitude: zone.searchCenterLatitude,
    longitude: zone.searchCenterLongitude,
  }) <= zone.searchRadiusMeters;
}

export function isInsideCollectionRadius(
  player: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number },
  collectionRadiusMeters = DEFAULT_CANONICAL_HUNT_POLICY.defaultCollectionRadiusMeters,
): boolean {
  return distanceMeters(player, target) <= collectionRadiusMeters;
}

export function evaluateHuntPlacement(
  input: HuntPlacementSignals,
  policy: CanonicalHuntPolicy = DEFAULT_CANONICAL_HUNT_POLICY,
): HuntPlacementEvaluation {
  const signals: string[] = [];
  if (input.latitude === null || input.longitude === null
    || input.latitude < -90 || input.latitude > 90
    || input.longitude < -180 || input.longitude > 180
    || (input.latitude === 0 && input.longitude === 0)) {
    return { decision: 'REJECT', userMessage: 'This location cannot be used for this Drop.', signals: ['INVALID_GPS'], policyVersion: policy.policyVersion };
  }
  if (input.placementMethod === 'REMOTE_ADMIN_REVIEW') {
    signals.push('REMOTE_PLACEMENT');
    return input.creatorDeclarationConfirmed
      ? { decision: 'REVIEW', userMessage: 'This location needs additional review.', signals, policyVersion: policy.policyVersion }
      : { decision: 'REJECT', userMessage: 'Confirm that players can safely access this location.', signals: [...signals, 'DECLARATION_MISSING'], policyVersion: policy.policyVersion };
  }
  if (input.gpsAccuracyMeters === null || input.gpsAccuracyMeters > 50) signals.push('WEAK_GPS');
  if (!input.scanComplete || (input.motionCoverageDegrees !== null && input.motionCoverageDegrees < 300)) signals.push('INCOMPLETE_SCAN');
  if (!input.creatorDeclarationConfirmed) signals.push('DECLARATION_MISSING');
  if (input.mockLocationDetected) signals.push('MOCK_LOCATION');
  if (input.locationSceneMismatch) signals.push('LOCATION_SCENE_MISMATCH');
  if (input.mediaModeration === 'rejected') signals.push('MEDIA_REJECTED');
  if (input.mediaModeration === 'pending') signals.push('MEDIA_PENDING');
  if (!input.visionAvailable) signals.push('VISION_UNAVAILABLE');

  const scene = input.sceneClassification;
  const dangerousMapClass = ['ROADWAY', 'RESTRICTED_LIKELY', 'HAZARDOUS_LIKELY', 'RESIDENTIAL_PRIVATE_LIKELY'].includes(input.mapClassification);
  const dangerousScene = !!scene && (scene.roadwayVisible || scene.restrictedSignage || scene.constructionOrHazard || scene.trafficRisk || !scene.safeDropAreaLikely);
  if (dangerousMapClass || dangerousScene || input.mediaModeration === 'rejected') {
    return { decision: 'REJECT', userMessage: 'This location cannot be used for this Drop.', signals: [...signals, dangerousMapClass ? 'LOCATION_POLICY_BLOCK' : 'SCENE_POLICY_BLOCK'], policyVersion: policy.policyVersion };
  }
  const publicIndoor = input.mapClassification === 'PUBLIC_INDOOR' || input.mapClassification === 'COMMERCIAL_PUBLIC_ACCESS';
  if (publicIndoor && !policy.allowPublicIndoor) signals.push('INDOOR_POLICY_REVIEW');
  if (signals.length > 0) {
    return { decision: 'REVIEW', userMessage: 'This location needs additional review.', signals, policyVersion: policy.policyVersion };
  }
  return { decision: 'PASS', userMessage: 'Location verified for review.', signals, policyVersion: policy.policyVersion };
}