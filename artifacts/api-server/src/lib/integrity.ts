export type IntegrityInput = {
  mockLocation?: boolean;
  horizontalAccuracyMeters?: number | null;
  speedKmh?: number | null;
  submissionsInWindow?: number;
  duplicateParticipation?: boolean;
  duplicateMediaReuse?: boolean;
  vpnDetected?: boolean;
  repeatedGeoFailures?: number;
  repeatedRiddleGuesses?: number;
  impossibleTimeSequence?: boolean;
  serverTimestampAnomaly?: boolean;
};

export type IntegritySignal = { id: string; score: number; explanation: string };
export const INTEGRITY_POLICY_VERSION = "worlds-integrity-1";
const weights = {
  mock_location: 50, poor_accuracy: 10, impossible_speed: 35, burst_submissions: 25,
  duplicate_participation: 25, duplicate_media: 20, vpn: 5, geo_failures: 10,
  riddle_abuse: 15, impossible_time: 30, server_time_anomaly: 25,
};

export function calculateIntegrityRisk(input: IntegrityInput) {
  const signals: IntegritySignal[] = [];
  const add = (id: string, score: number, explanation: string) => signals.push({ id, score, explanation });
  if (input.mockLocation) add("mock_location", weights.mock_location, "Device supplied a mock-location signal; treat as contextual evidence.");
  if ((input.horizontalAccuracyMeters ?? 0) > 100) add("poor_accuracy", weights.poor_accuracy, "Location accuracy was too low for a precise validation.");
  const speed = input.speedKmh ?? 0;
  if (speed > 180) add("impossible_speed", Math.min(50, weights.impossible_speed + Math.floor((speed - 180) / 20) * 5), "Validated events imply unusually high movement speed.");
  if ((input.submissionsInWindow ?? 0) >= 5) add("burst_submissions", weights.burst_submissions, "Many submissions occurred in a short window.");
  if (input.duplicateParticipation) add("duplicate_participation", weights.duplicate_participation, "A duplicate participation or completion signal was observed.");
  if (input.duplicateMediaReuse) add("duplicate_media", weights.duplicate_media, "Media was reused across unrelated submissions.");
  if (input.vpnDetected) add("vpn", weights.vpn, "VPN signal is weak context and never decisive alone.");
  if ((input.repeatedGeoFailures ?? 0) >= 3) add("geo_failures", weights.geo_failures, "Repeated geo validation failures were observed.");
  if ((input.repeatedRiddleGuesses ?? 0) >= 10) add("riddle_abuse", weights.riddle_abuse, "Riddle guesses exceeded the abuse-review threshold.");
  if (input.impossibleTimeSequence) add("impossible_time", weights.impossible_time, "Event ordering is inconsistent with server-authoritative time.");
  if (input.serverTimestampAnomaly) add("server_time_anomaly", weights.server_time_anomaly, "Server receipt timing is materially inconsistent.");
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.score, 0));
  const band = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : score >= 20 ? "elevated" : "low";
  const requiresReview = score >= 40 || signals.some((signal) => signal.id === "mock_location" || signal.id === "duplicate_media");
  const recommendedAction = score >= 80 ? "escalate_admin" : score >= 60 ? "quarantine_reward" : score >= 40 ? "manual_review" : score >= 20 ? "warn" : "none";
  return { score, band, signals, recommendedAction, requiresReview, policyVersion: INTEGRITY_POLICY_VERSION, createdAt: new Date().toISOString() };
}

export function triageReport(input: { reason: string; targetType: string; independentReporters?: number; relatedOpenCases?: number; targetPublic?: boolean; activeHuntRisk?: boolean }) {
  const severeReasons = new Set(["child_safety", "imminent_danger", "threat", "self_harm", "graphic_violence"]);
  const score = Math.min(100,
    (severeReasons.has(input.reason) ? 50 : 10) +
    Math.min(20, (input.independentReporters ?? 0) * 5) +
    Math.min(15, (input.relatedOpenCases ?? 0) * 5) +
    (input.targetPublic ? 10 : 0) +
    (input.activeHuntRisk ? 20 : 0),
  );
  return { score, priority: score >= 80 ? "critical" : score >= 55 ? "high" : score >= 25 ? "medium" : "low", requiresReview: true, reason: "Priority routes review; it is not an enforcement decision." };
}