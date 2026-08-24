/**
 * Canonical server-side placement safety policy.
 *
 * Providers report facts only. This module owns the deterministic PASS /
 * REVIEW / REJECT decision and defaults to REVIEW if context cannot be
 * established. It must never be replaced by a client-side decision.
 */
export type PlacementDecision = "PASS" | "REVIEW" | "REJECT";
export type PlacementMapClass =
  | "PUBLIC_OUTDOOR" | "PUBLIC_INDOOR" | "COMMERCIAL_PUBLIC_ACCESS"
  | "PEDESTRIAN_PUBLIC_AREA" | "UNKNOWN" | "RESIDENTIAL_PRIVATE_LIKELY"
  | "ROADWAY" | "RESTRICTED_LIKELY" | "HAZARDOUS_LIKELY";

export type HuntPlacementSignals = {
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  scanComplete: boolean;
  motionCoverageDegrees: number | null;
  creatorDeclarationConfirmed: boolean;
  mapClassification: PlacementMapClass;
  moderation: "approved" | "pending" | "rejected" | "not_required";
  visionAvailable: boolean;
  locationSceneMismatch: boolean;
  mockLocationDetected?: boolean;
  scene?: {
    roadwayVisible: boolean;
    restrictedSignage: boolean;
    constructionOrHazard: boolean;
    trafficRisk: boolean;
    safeDropAreaLikely: boolean;
  } | null;
};

export type PlacementPolicyResult = {
  decision: PlacementDecision;
  signals: string[];
  userMessage: string;
  policyVersion: "hunt-placement-1";
};

export interface HuntMapContextProvider {
  classify(input: { latitude: number; longitude: number }): Promise<PlacementMapClass>;
}

export interface HuntEnvironmentVisionProvider {
  inspect(input: { mediaUrl: string }): Promise<HuntPlacementSignals["scene"]>;
}

export function evaluateHuntPlacement(input: HuntPlacementSignals): PlacementPolicyResult {
  const signals: string[] = [];
  const invalidCoordinate = input.latitude === null || input.longitude === null
    || input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180
    || (input.latitude === 0 && input.longitude === 0);
  if (invalidCoordinate) return result("REJECT", ["INVALID_GPS"], "This location cannot be used for this Drop.");
  if (input.gpsAccuracyMeters === null || input.gpsAccuracyMeters > 50) signals.push("WEAK_GPS");
  if (!input.scanComplete || (input.motionCoverageDegrees !== null && input.motionCoverageDegrees < 300)) signals.push("INCOMPLETE_SCAN");
  if (!input.creatorDeclarationConfirmed) signals.push("DECLARATION_MISSING");
  if (!input.visionAvailable) signals.push("VISION_UNAVAILABLE");
  if (input.locationSceneMismatch) signals.push("LOCATION_SCENE_MISMATCH");
  if (input.mockLocationDetected) signals.push("MOCK_LOCATION");
  if (input.moderation === "pending") signals.push("MEDIA_PENDING");

  const blockedMap = ["ROADWAY", "RESTRICTED_LIKELY", "HAZARDOUS_LIKELY", "RESIDENTIAL_PRIVATE_LIKELY"].includes(input.mapClassification);
  const blockedScene = Boolean(input.scene && (
    input.scene.roadwayVisible || input.scene.restrictedSignage || input.scene.constructionOrHazard
    || input.scene.trafficRisk || !input.scene.safeDropAreaLikely
  ));
  if (input.moderation === "rejected" || blockedMap || blockedScene) {
    return result("REJECT", [...signals, blockedMap ? "LOCATION_POLICY_BLOCK" : "SCENE_POLICY_BLOCK"], "This location cannot be used for this Drop.");
  }
  if (signals.length) return result("REVIEW", signals, "This location needs additional review.");
  return result("PASS", [], "Location verified for review.");
}

function result(decision: PlacementDecision, signals: string[], userMessage: string): PlacementPolicyResult {
  return { decision, signals, userMessage, policyVersion: "hunt-placement-1" };
}