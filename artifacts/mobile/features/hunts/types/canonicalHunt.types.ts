/**
 * Prompt 26 canonical Hunt contracts.
 *
 * These types deliberately separate public discovery geometry from the
 * private collection geometry held by the server.
 */

export type HuntDropType = 'STANDARD' | 'CLUE' | 'RIDDLE';
export type HuntPlacementMethod = 'VERIFIED_IN_PERSON' | 'REMOTE_ADMIN_REVIEW';
export type HuntDropCollectionState =
  | 'DISCOVERABLE'
  | 'CLUE_LOCKED'
  | 'CLUE_AVAILABLE'
  | 'SEARCHING'
  | 'NEARBY'
  | 'COLLECTION_SESSION'
  | 'COLLECTED'
  | 'UNDER_REVIEW'
  | 'INVALIDATED';

export interface PublicHuntSearchZone {
  dropId: string;
  huntId: string;
  dropType: HuntDropType;
  /** Approximate center; never the private collection point. */
  searchCenterLatitude: number;
  searchCenterLongitude: number;
  searchRadiusMeters: number;
  clueRevealRadiusMeters: number | null;
  collectionRadiusMeters: number;
  clueState: 'locked' | 'available' | 'revealed' | null;
  collectionState: HuntDropCollectionState;
  title: string;
  points: number;
}

export interface CanonicalHuntPolicy {
  defaultSearchRadiusMeters: number;
  defaultClueRevealRadiusMeters: number;
  defaultCollectionRadiusMeters: number;
  minSearchRadiusMeters: number;
  maxSearchRadiusMeters: number;
  minClueRevealRadiusMeters: number;
  maxClueRevealRadiusMeters: number;
  minCollectionRadiusMeters: number;
  maxCollectionRadiusMeters: number;
  maxCustomHuntPoints: number;
  requireVerifiedPlacement: boolean;
  allowRemotePlacement: boolean;
  allowPublicIndoor: boolean;
  policyVersion: string;
}

export const DEFAULT_CANONICAL_HUNT_POLICY: CanonicalHuntPolicy = {
  defaultSearchRadiusMeters: 350,
  defaultClueRevealRadiusMeters: 500,
  defaultCollectionRadiusMeters: 25,
  minSearchRadiusMeters: 200,
  maxSearchRadiusMeters: 500,
  minClueRevealRadiusMeters: 250,
  maxClueRevealRadiusMeters: 1000,
  minCollectionRadiusMeters: 10,
  maxCollectionRadiusMeters: 50,
  maxCustomHuntPoints: 500,
  requireVerifiedPlacement: true,
  allowRemotePlacement: true,
  allowPublicIndoor: true,
  policyVersion: 'hunt-policy-1',
};

export interface HuntPlacementSignals {
  placementMethod: HuntPlacementMethod;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  scanComplete: boolean;
  motionCoverageDegrees: number | null;
  creatorDeclarationConfirmed: boolean;
  mapClassification:
    | 'PUBLIC_OUTDOOR'
    | 'PUBLIC_INDOOR'
    | 'COMMERCIAL_PUBLIC_ACCESS'
    | 'PEDESTRIAN_PUBLIC_AREA'
    | 'UNKNOWN'
    | 'RESIDENTIAL_PRIVATE_LIKELY'
    | 'ROADWAY'
    | 'RESTRICTED_LIKELY'
    | 'HAZARDOUS_LIKELY';
  sceneClassification?: {
    indoor: boolean | null;
    roadwayVisible: boolean;
    pedestrianSpace: boolean;
    residentialEnvironment: boolean;
    publicVenueLikely: boolean;
    restrictedSignage: boolean;
    constructionOrHazard: boolean;
    trafficRisk: boolean;
    safeDropAreaLikely: boolean;
  } | null;
  mediaModeration: 'approved' | 'pending' | 'rejected' | 'not_required';
  visionAvailable: boolean;
  locationSceneMismatch: boolean;
  mockLocationDetected?: boolean;
}

export type HuntPlacementDecision = 'PASS' | 'REVIEW' | 'REJECT';

export interface HuntPlacementEvaluation {
  decision: HuntPlacementDecision;
  userMessage: string;
  signals: string[];
  policyVersion: string;
}