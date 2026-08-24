import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { calculateIntegrityRisk, type IntegrityInput } from "./integrity";
import { MODERATION_POLICY_VERSION, type ModerationOutcome, type ModerationResult } from "./moderation";

export type CaseStatus = "open" | "claimed" | "resolved" | "escalated";
export type CaseDecision = "no_action" | "warning" | "content_removed" | "account_restricted" | "account_suspended" | "quarantine" | "release" | "reverse";

export type ModerationRequest = {
  id: string;
  idempotencyKey: string;
  entityType: string;
  entityId: string;
  context: string;
  contentHash: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type ModerationCase = {
  id: string;
  entityType: string;
  entityId: string;
  context: string;
  status: CaseStatus;
  decision: CaseDecision | null;
  priority: "low" | "medium" | "high" | "critical";
  moderation: ModerationResult | null;
  outcome: ModerationOutcome | null;
  assignedModeratorId: string | null;
  claimedAt: string | null;
  sourceReportIds: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportRecord = {
  id: string;
  reporterUserId: string;
  entityType: string;
  entityId: string;
  reason: string;
  description: string | null;
  status: "submitted" | "triaged" | "resolved" | "merged";
  priority: "low" | "medium" | "high" | "critical";
  duplicateOf: string | null;
  relatedReportIds: string[];
  caseId: string | null;
  createdAt: string;
};

export type RewardRecord = {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  amount: number;
  state: "awarded" | "quarantined" | "released" | "reversed";
  reason: string | null;
  sourceRiskSnapshotId: string | null;
  createdAt: string;
};

type AuditRecord = { id: string; actorId: string | null; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown>; createdAt: string };
type State = {
  requests: ModerationRequest[];
  cases: ModerationCase[];
  reports: ReportRecord[];
  snapshots: Array<ReturnType<typeof calculateIntegrityRisk> & { id: string; entityType: string; entityId: string; userId: string | null }>;
  rewards: RewardRecord[];
  audit: AuditRecord[];
  settings: { automationEnabled: boolean; autoApprovalMode: "manual_only" | "low_risk" | "mixed"; quarantineThreshold: number; reviewThreshold: number };
};

const statePath = process.env.MODERATION_LOCAL_STATE_PATH ?? path.join(process.cwd(), ".local", "moderation-state.json");
const initialState = (): State => ({
  requests: [], cases: [], reports: [], snapshots: [], rewards: [], audit: [],
  settings: { automationEnabled: process.env.MODERATION_AUTOMATION_ENABLED === "true", autoApprovalMode: (process.env.MODERATION_AUTO_APPROVAL_MODE as State["settings"]["autoApprovalMode"]) || "manual_only", quarantineThreshold: 60, reviewThreshold: 40 },
});

function loadState(): State {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as Partial<State>;
    const initial = initialState();
    return { ...initial, ...parsed, settings: { ...initial.settings, ...(parsed.settings ?? {}) } };
  } catch {
    return initialState();
  }
}

const state = loadState();
const isLocalPersistence = process.env.NODE_ENV !== "production" || Boolean(process.env.MODERATION_LOCAL_STATE_PATH);

function persist() {
  if (!isLocalPersistence) return;
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const temporary = `${statePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, statePath);
  } catch {
    // The API remains usable in manual mode; production persistence is Supabase-owned.
  }
}

function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  state.audit.push({ id: randomUUID(), actorId, action, entityType, entityId, metadata, createdAt: new Date().toISOString() });
  state.audit = state.audit.slice(-1000);
}

/** Records both rejected attempts and successful transitions in the same append-only stream. */
export function recordAuditEvent(input: { actorId: string | null; action: string; entityType: string; entityId?: string | null; result: "attempted" | "completed" | "rejected" | "conflict"; reason?: string; metadata?: Record<string, unknown> }) {
  audit(input.actorId, input.action, input.entityType, input.entityId ?? null, {
    ...input.metadata,
    result: input.result,
    reason: input.reason ?? null,
  });
  persist();
}

export function createModerationRequest(input: { entityType: string; entityId: string; context: string; contentHash: string; result?: ModerationResult; outcome?: ModerationOutcome }) {
  const idempotencyKey = createHash("sha256").update([input.entityType, input.entityId, input.context, input.contentHash, MODERATION_POLICY_VERSION].join(":")).digest("hex");
  const existing = state.requests.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) return { request: existing, case: state.cases.find((item) => item.id === existing.id) ?? null, reused: true };
  const now = new Date().toISOString();
  const request: ModerationRequest = { id: randomUUID(), idempotencyKey, entityType: input.entityType, entityId: input.entityId, context: input.context, contentHash: input.contentHash, status: input.result ? "completed" : "pending", createdAt: now, updatedAt: now };
  const needsCase = Boolean(input.result && input.outcome && (input.outcome.action !== "allow" || input.result.reviewRequired));
  const moderationCase: ModerationCase | null = needsCase ? { id: request.id, entityType: input.entityType, entityId: input.entityId, context: input.context, status: "open", decision: null, priority: input.result?.decision === "blocked" ? "critical" : input.result?.decision === "warning" ? "high" : "medium", moderation: input.result ?? null, outcome: input.outcome ?? null, assignedModeratorId: null, claimedAt: null, sourceReportIds: [], notes: null, createdAt: now, updatedAt: now } : null;
  state.requests.push(request);
  if (moderationCase) state.cases.push(moderationCase);
  audit(null, "moderation_requested", input.entityType, input.entityId, { requestId: request.id, policyVersion: MODERATION_POLICY_VERSION });
  persist();
  return { request, case: moderationCase, reused: false };
}

export function listModerationCases(filters?: { status?: CaseStatus; entityType?: string; priority?: string }) {
  return state.cases.filter((item) => (!filters?.status || item.status === filters.status) && (!filters?.entityType || item.entityType === filters.entityType) && (!filters?.priority || item.priority === filters.priority)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getModerationCase(id: string) { return state.cases.find((item) => item.id === id) ?? null; }

export function claimModerationCase(id: string, moderatorId: string) {
  const item = getModerationCase(id);
  if (!item) return { ok: false as const, code: "not_found" };
  if (item.status === "resolved") return { ok: false as const, code: "already_resolved" };
  if (item.assignedModeratorId && item.assignedModeratorId !== moderatorId) return { ok: false as const, code: "claimed_by_other" };
  item.assignedModeratorId = moderatorId; item.claimedAt = new Date().toISOString(); item.status = "claimed"; item.updatedAt = item.claimedAt;
  audit(moderatorId, "moderation_case_claimed", "moderation_case", id); persist();
  return { ok: true as const, case: item };
}

export function resolveModerationCase(id: string, input: { actorId: string; decision: CaseDecision; reason: string; expectedUpdatedAt?: string; idempotencyKey?: string }) {
  const item = getModerationCase(id);
  if (!item) return { ok: false as const, code: "not_found" };
  if (item.status === "resolved") return { ok: false as const, code: "already_resolved" };
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== item.updatedAt) return { ok: false as const, code: "stale_case" };
  if (!input.reason.trim()) return { ok: false as const, code: "reason_required" };
  item.decision = input.decision; item.notes = input.reason.trim(); item.status = "resolved"; item.updatedAt = new Date().toISOString();
  audit(input.actorId, "moderation_decision", "moderation_case", id, { decision: input.decision, reasonProvided: true });
  persist();
  return { ok: true as const, case: item };
}

export function createReport(input: { reporterUserId: string; entityType: string; entityId: string; reason: string; description?: string }) {
  const normalizedReason = input.reason.trim().toLowerCase().replace(/\s+/g, "_");
  const duplicate = state.reports.find((item) => item.reporterUserId === input.reporterUserId && item.entityType === input.entityType && item.entityId === input.entityId && item.reason === normalizedReason && Date.now() - Date.parse(item.createdAt) < 86_400_000);
  if (duplicate) return { report: duplicate, duplicate: true };
  const related = state.reports.filter((item) => item.entityType === input.entityType && item.entityId === input.entityId && item.status !== "resolved").map((item) => item.id);
  const report: ReportRecord = { id: randomUUID(), reporterUserId: input.reporterUserId, entityType: input.entityType, entityId: input.entityId, reason: normalizedReason, description: input.description?.trim() || null, status: "triaged", priority: related.length >= 3 ? "high" : "medium", duplicateOf: null, relatedReportIds: related, caseId: null, createdAt: new Date().toISOString() };
  state.reports.push(report);
  state.reports.filter((item) => related.includes(item.id)).forEach((item) => { item.relatedReportIds = Array.from(new Set([...item.relatedReportIds, report.id])); });
  audit(input.reporterUserId, "report_submitted", input.entityType, input.entityId, { reason: normalizedReason });
  persist();
  return { report, duplicate: false };
}

export function listReports(filters?: { status?: string; priority?: string }) {
  return state.reports.filter((item) => (!filters?.status || item.status === filters.status) && (!filters?.priority || item.priority === filters.priority)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createIntegritySnapshot(input: { userId?: string; entityType: string; entityId: string; signals: IntegrityInput }) {
  const result = calculateIntegrityRisk(input.signals);
  const snapshot = { ...result, id: randomUUID(), userId: input.userId ?? null, entityType: input.entityType, entityId: input.entityId };
  state.snapshots.push(snapshot); audit(null, "integrity_risk_calculated", input.entityType, input.entityId, { snapshotId: snapshot.id, policyVersion: snapshot.policyVersion }); persist();
  return snapshot;
}

export function listIntegritySnapshots() { return [...state.snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export function quarantineReward(input: { actorId: string; rewardId: string; userId: string; entityType: string; entityId: string; amount: number; reason: string; snapshotId?: string }) {
  const existing = state.rewards.find((item) => item.id === input.rewardId);
  if (existing) return { ok: existing.state === "quarantined", reward: existing, reused: true };
  const reward: RewardRecord = { id: input.rewardId, userId: input.userId, entityType: input.entityType, entityId: input.entityId, amount: input.amount, state: "quarantined", reason: input.reason.trim(), sourceRiskSnapshotId: input.snapshotId ?? null, createdAt: new Date().toISOString() };
  state.rewards.push(reward); audit(input.actorId, "points_quarantined", input.entityType, input.entityId, { rewardId: reward.id, amount: reward.amount }); persist();
  return { ok: true, reward, reused: false };
}

export function resolveReward(input: { actorId: string; rewardId: string; action: "release" | "reverse"; reason: string }) {
  const reward = state.rewards.find((item) => item.id === input.rewardId);
  if (!reward) return { ok: false as const, code: "not_found" };
  if (reward.state !== "quarantined") return { ok: false as const, code: "already_resolved", reward };
  reward.state = input.action === "release" ? "released" : "reversed"; reward.reason = input.reason.trim();
  audit(input.actorId, input.action === "release" ? "points_released" : "points_reversed", reward.entityType, reward.entityId, { rewardId: reward.id, amount: reward.amount }); persist();
  return { ok: true as const, reward };
}

export function getModerationStateDiagnostics() {
  const cases = state.cases.filter((item) => item.status !== "resolved");
  const reports = state.reports.filter((item) => item.status !== "resolved");
  return {
    persistence: isLocalPersistence ? "local-development-only" : "supabase-required",
    counts: { pendingRequests: state.requests.filter((item) => item.status === "pending").length, openCases: cases.length, highRiskCases: cases.filter((item) => ["high", "critical"].includes(item.priority)).length, openReports: reports.length, urgentReports: reports.filter((item) => item.priority === "critical").length, quarantinedRewards: state.rewards.filter((item) => item.state === "quarantined").length },
    lastScanAt: state.requests.filter((item) => item.status === "completed").at(-1)?.updatedAt ?? null,
    auditEvents: state.audit.length,
    policyVersion: MODERATION_POLICY_VERSION,
  };
}

export function getModerationSettings() { return { ...state.settings, policyVersion: MODERATION_POLICY_VERSION, persistence: isLocalPersistence ? "local-development-only" : "supabase-required" }; }

export function updateModerationSettings(input: Partial<State["settings"]>, actorId: string) {
  state.settings = { ...state.settings, ...input }; audit(actorId, "moderation_settings_changed", "moderation_policy", null, { policyVersion: MODERATION_POLICY_VERSION }); persist(); return getModerationSettings();
}

export function listAuditEvents() { return [...state.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }