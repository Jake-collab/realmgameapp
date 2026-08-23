import { Router, type IRouter, type Request } from "express";
import {
  GetAdminDashboardResponse,
  GetAdminDiagnosticsResponse,
  GetAdminReviewQueuesResponse,
  GetAdminSessionResponse,
  ListAdminAuditLogsResponse,
  ListAdminQuestsResponse,
  ListAdminUsersResponse,
  ListAdminQuestsQueryParams,
  ListAdminUsersQueryParams,
  ListAdminAuditLogsQueryParams,
} from "@workspace/api-zod";
import { getRolePermissions, requireAdmin, resolveAdminPrincipal } from "../lib/admin-auth";
import {
  createPromptVersion,
  changePromptState,
  consumeGenerationQuota,
  generateQuest,
  getGenerationPlan,
  listPromptVersions,
  listGenerationHistory,
  questGenerationTypes,
  validatePromptVariables,
  aiConfiguration,
  type QuestGenerationType,
} from "../lib/ai-quest";
import { z } from "zod";
import {
  moderationDiagnostics,
  moderateImage,
  moderateText,
} from "../lib/moderation";
import { calculateIntegrityRisk, triageReport } from "../lib/integrity";
import {
  claimModerationCase,
  createIntegritySnapshot,
  createModerationRequest,
  createReport,
  getModerationCase,
  getModerationSettings,
  getModerationStateDiagnostics,
  listAuditEvents,
  listIntegritySnapshots,
  listModerationCases,
  listReports,
  quarantineReward,
  resolveModerationCase,
  resolveReward,
  updateModerationSettings,
} from "../lib/moderation-state";

const router: IRouter = Router();

/**
 * The API server intentionally fails closed until Supabase staff-session
 * verification is connected. These read-only responses contain no private
 * records, but let the web console render a truthful setup/unavailable state.
 */
function getUnavailableSession(req: Request) {
  const hasBearer = typeof req.headers.authorization === "string"
    && req.headers.authorization.startsWith("Bearer ");

  return GetAdminSessionResponse.parse({
    authenticated: hasBearer,
    authorized: false,
    role: "user",
    displayName: null,
    username: null,
    permissions: [],
    reason: hasBearer
      ? "Staff session verification is unavailable until Supabase is connected."
      : "Sign in with an approved Worlds staff account to continue.",
  });
}

function unavailableMetric(label: string, detail: string) {
  return { label, value: null, status: "unavailable" as const, detail };
}

router.get("/admin/session", async (req, res) => {
  const result = await resolveAdminPrincipal(req);
  if (result.kind === "authorized") {
    res.json(GetAdminSessionResponse.parse({
      authenticated: true,
      authorized: true,
      role: result.principal.role,
      displayName: result.principal.displayName,
      username: result.principal.username,
      permissions: result.principal.permissions,
      reason: null,
    }));
    return;
  }
  if (result.kind === "unauthenticated") {
    res.json(getUnavailableSession(req));
    return;
  }
  res.json(GetAdminSessionResponse.parse({
    authenticated: result.kind === "unauthorized",
    authorized: false,
    role: "user",
    displayName: null,
    username: null,
    permissions: [],
    reason: result.reason,
  }));
});

router.get("/admin/dashboard", requireAdmin("admin.read"), (_req, res) => {
  res.json(GetAdminDashboardResponse.parse({
    metrics: [
      unavailableMetric("Active users", "Supabase connection required"),
      unavailableMetric("Published Quests", "Supabase connection required"),
      unavailableMetric("Pending proof", "Supabase connection required"),
      unavailableMetric("Custom Hunt review", "Supabase connection required"),
      unavailableMetric("Open safety reports", "Supabase connection required"),
      unavailableMetric("Failed jobs", "Scheduler connection required"),
    ],
    actionQueue: [],
    generatedAt: new Date(),
  }));
});

router.get("/admin/users", requireAdmin("admin.users.read"), (req, res) => {
  const query = ListAdminUsersQueryParams.parse(req.query);
  res.json(ListAdminUsersResponse.parse({
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  }));
});

router.get("/admin/quests", requireAdmin("admin.quests.read"), (req, res) => {
  const query = ListAdminQuestsQueryParams.parse(req.query);
  res.json(ListAdminQuestsResponse.parse({
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  }));
});

router.get("/admin/review-queues", requireAdmin("admin.review.read"), (_req, res) => {
  res.json(GetAdminReviewQueuesResponse.parse({ queues: [] }));
});

router.get("/admin/audit", requireAdmin("admin.audit.read"), (req, res) => {
  const query = ListAdminAuditLogsQueryParams.parse(req.query);
  res.json(ListAdminAuditLogsResponse.parse({
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  }));
});

router.get("/admin/diagnostics", requireAdmin("admin.diagnostics.read"), (_req, res) => {
  res.json(GetAdminDiagnosticsResponse.parse({
    checks: [
      { name: "Supabase", status: "unavailable", summary: "Connect Supabase to enable staff data and trusted operations.", checkedAt: new Date() },
      { name: "Mapbox", status: "missing", summary: "Mapbox diagnostics will appear when the native map configuration is connected.", checkedAt: new Date() },
      { name: "Storage", status: "unavailable", summary: "Media moderation storage is not connected.", checkedAt: new Date() },
      { name: "Operational jobs", status: "unavailable", summary: "Scheduled job health requires the production scheduler.", checkedAt: new Date() },
    ],
    generatedAt: new Date(),
  }));
});

router.get("/admin/ai/overview", requireAdmin("ai.read"), (_req, res) => {
  res.json({
    provider: aiConfiguration(),
    promptTemplates: questGenerationTypes.map((type) => ({
      type,
      versions: listPromptVersions(type).length,
      activeVersion: listPromptVersions(type).find((item) => item.active)?.version ?? null,
    })),
    generationPolicy: "draft_only",
    generatedAt: new Date().toISOString(),
  });
});

router.get("/admin/ai/prompts", requireAdmin("ai.prompts.read"), (_req, res) => {
  res.json({ items: listPromptVersions() });
});

router.get("/admin/ai/prompts/:type", requireAdmin("ai.prompts.read"), (req, res) => {
  if (!questGenerationTypes.includes(req.params.type as QuestGenerationType)) {
    res.status(400).json({ error: "Unknown Quest prompt type." });
    return;
  }
  res.json({ items: listPromptVersions(req.params.type as QuestGenerationType) });
});

router.post("/admin/ai/prompts/:type/versions", requireAdmin("ai.prompts.edit"), (req, res) => {
  if (!questGenerationTypes.includes(req.params.type as QuestGenerationType)) {
    res.status(400).json({ error: "Unknown Quest prompt type." });
    return;
  }
  const input = z.object({
    systemInstructions: z.string().min(1),
    contentInstructions: z.string().min(1),
    safetyInstructions: z.string().min(1),
    pointInstructions: z.string().min(1),
    proofInstructions: z.string().min(1),
    outputFormat: z.string().min(1),
    changeReason: z.string().min(1).max(500),
  }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Prompt fields and change reason are required.", issues: input.error.issues });
    return;
  }
  const principal = req.adminPrincipal;
  res.status(201).json({
    prompt: createPromptVersion(req.params.type as QuestGenerationType, {
      ...input.data,
      updatedBy: principal?.userId ?? "staff",
    }),
  });
});

router.post("/admin/ai/prompts/:type/versions/:version/:action", requireAdmin("ai.prompts.edit"), (req, res) => {
  const type = req.params.type as QuestGenerationType;
  const version = Number(req.params.version);
  const action = req.params.action as "activate" | "deactivate" | "restore";
  if (!questGenerationTypes.includes(type) || !Number.isInteger(version) || !["activate", "deactivate", "restore"].includes(action)) {
    res.status(400).json({ error: "Unknown prompt lifecycle operation." });
    return;
  }
  const updated = changePromptState(type, version, action, req.adminPrincipal?.userId ?? "staff");
  if (!updated) {
    res.status(404).json({ error: "Prompt version not found." });
    return;
  }
  res.json({ prompt: updated, action });
});

router.post("/admin/ai/prompts/:type/preview", requireAdmin("ai.prompts.read"), (req, res) => {
  const input = z.object({ template: z.string(), variables: z.record(z.string(), z.string()) }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "A template and string variables are required." });
    return;
  }
  res.json({ preview: validatePromptVariables(input.data.template, input.data.variables) });
});

router.post("/admin/ai/generate", requireAdmin("ai.generate"), async (req, res) => {
  const input = z.object({
    type: z.enum(questGenerationTypes),
    variables: z.record(z.string(), z.string()).default({}),
    testOnly: z.boolean().default(true),
    quantity: z.number().int().min(1).max(20).default(1),
  }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Generation type and valid variables are required." });
    return;
  }
  const plan = getGenerationPlan(input.data.type, input.data.quantity, input.data.variables);
  const requestedBy = req.adminPrincipal?.userId ?? "staff";
  const quota = consumeGenerationQuota(requestedBy, input.data.quantity);
  if (!quota.allowed) {
    res.setHeader("Retry-After", String(quota.retryAfterSeconds));
    res.status(429).json({ error: "AI generation rate limit reached.", ...quota });
    return;
  }
  const results = await Promise.all(
    Array.from({ length: input.data.quantity }, () => generateQuest(input.data.type, input.data.variables, requestedBy)),
  );
  res.json({
    mode: input.data.testOnly ? "TEST_GENERATION — NOT SAVED" : "DRAFT_CANDIDATES — REVIEW REQUIRED",
    results,
    plan,
    saved: false,
  });
});

router.get("/admin/ai/history", requireAdmin("ai.read"), (_req, res) => {
  res.json({ items: listGenerationHistory(), persistence: "local-development-only" });
});

router.get("/admin/ai/settings", requireAdmin("ai.settings.read"), (_req, res) => {
  res.json({
    provider: aiConfiguration(),
    settings: {
       generationEnabled: aiConfiguration().configured,
      automatedGenerationEnabled: false,
      outputTokenLimit: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2000),
      temperature: Number(process.env.AI_TEMPERATURE ?? 0.4),
      requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 15000),
       maxRetries: Math.min(3, Math.max(0, Number(process.env.AI_MAX_RETRIES ?? 1))),
      dailyRequestLimit: 100,
      monthlyRequestLimit: 1000,
    },
  });
});

router.get("/admin/moderation/diagnostics", requireAdmin("moderation.read"), async (_req, res) => {
  res.json({ ...(await moderationDiagnostics()), state: getModerationStateDiagnostics() });
});

router.post("/admin/moderation/scan/text", requireAdmin("moderation.manage"), async (req, res) => {
  const input = z.object({
    text: z.string().trim().min(1).max(12000),
    context: z.enum(["public_text", "ai_quest", "profile", "private_proof"]),
    accountInGoodStanding: z.boolean().default(true),
    reported: z.boolean().default(false),
    entityType: z.string().trim().min(1).max(40).default("text"),
    entityId: z.string().trim().min(1).max(100).default("local"),
  }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Text and a supported moderation context are required." });
    return;
  }
  const outcome = await moderateText(input.data.text, input.data.context, input.data);
  res.json({ ...outcome, persistence: createModerationRequest({ entityType: input.data.entityType, entityId: input.data.entityId, context: input.data.context, contentHash: outcome.result.contentHash, result: outcome.result, outcome }) });
});

router.post("/admin/moderation/scan/image", requireAdmin("moderation.manage"), async (req, res) => {
  const input = z.object({
    contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    mediaUrl: z.string().url().max(2048).optional(),
    context: z.enum(["public_media", "private_proof", "profile"]),
    accountInGoodStanding: z.boolean().default(true),
    reported: z.boolean().default(false),
    entityType: z.string().trim().min(1).max(40).default("media"),
    entityId: z.string().trim().min(1).max(100).default("local"),
  }).refine((value) => value.contentHash || value.mediaUrl, "A content hash or server-accessible media URL is required.").safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "A content hash or server-accessible media URL and context are required." });
    return;
  }
  const outcome = await moderateImage(input.data, input.data);
  res.json({ ...outcome, persistence: createModerationRequest({ entityType: input.data.entityType, entityId: input.data.entityId, context: input.data.context, contentHash: outcome.result.contentHash, result: outcome.result, outcome }) });
});

router.post("/admin/integrity/evaluate", requireAdmin("integrity.manage"), (req, res) => {
  const input = z.object({
    mockLocation: z.boolean().optional(),
    horizontalAccuracyMeters: z.number().nonnegative().nullable().optional(),
    speedKmh: z.number().nonnegative().nullable().optional(),
    submissionsInWindow: z.number().int().nonnegative().optional(),
    duplicateParticipation: z.boolean().optional(),
    duplicateMediaReuse: z.boolean().optional(),
    vpnDetected: z.boolean().optional(),
    repeatedGeoFailures: z.number().int().nonnegative().optional(),
    repeatedRiddleGuesses: z.number().int().nonnegative().optional(),
    impossibleTimeSequence: z.boolean().optional(),
    serverTimestampAnomaly: z.boolean().optional(),
    userId: z.string().optional(),
    entityType: z.string().trim().min(1).max(40).default("proof"),
    entityId: z.string().trim().min(1).max(100).default("local"),
  }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Integrity signals are invalid." });
    return;
  }
  const { userId, entityType, entityId, ...signals } = input.data;
  res.json(createIntegritySnapshot({ userId, entityType, entityId, signals }));
});

router.post("/admin/reports/triage", requireAdmin("moderation.manage"), (req, res) => {
  const input = z.object({
    reason: z.string().trim().min(1).max(80),
    targetType: z.string().trim().min(1).max(40),
    independentReporters: z.number().int().nonnegative().default(0),
    relatedOpenCases: z.number().int().nonnegative().default(0),
    targetPublic: z.boolean().default(false),
    activeHuntRisk: z.boolean().default(false),
  }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Report triage inputs are invalid." });
    return;
  }
  res.json(triageReport(input.data));
});

router.get("/admin/moderation/cases", requireAdmin("moderation.read"), (req, res) => {
  const query = z.object({ status: z.enum(["open", "claimed", "resolved", "escalated"]).optional(), entityType: z.string().optional(), priority: z.string().optional() }).parse(req.query);
  res.json({ items: listModerationCases(query), persistence: getModerationStateDiagnostics().persistence });
});

router.get("/admin/moderation/cases/:id", requireAdmin("moderation.read"), (req, res) => {
  const caseId = String(req.params.id);
  const item = getModerationCase(caseId);
  if (!item) { res.status(404).json({ error: "Moderation case not found." }); return; }
  res.json({ case: item });
});

router.post("/admin/moderation/cases/:id/claim", requireAdmin("moderation.manage"), (req, res) => {
  const result = claimModerationCase(String(req.params.id), req.adminPrincipal!.userId);
  if (!result.ok) { res.status(result.code === "not_found" ? 404 : 409).json({ error: result.code === "claimed_by_other" ? "This case is already claimed by another moderator." : "This case cannot be claimed." }); return; }
  res.json(result);
});

router.post("/admin/moderation/cases/:id/resolve", requireAdmin("moderation.manage"), (req, res) => {
  const input = z.object({ decision: z.enum(["no_action", "warning", "content_removed", "account_restricted", "account_suspended", "quarantine", "release", "reverse"]), reason: z.string().trim().min(1).max(2000), expectedUpdatedAt: z.string().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "A decision and reason are required." }); return; }
  const result = resolveModerationCase(String(req.params.id), { ...input.data, actorId: req.adminPrincipal!.userId });
  if (!result.ok) { res.status(result.code === "not_found" ? 404 : 409).json({ error: result.code === "stale_case" ? "This case was updated by another moderator. Refresh before taking action." : "This case cannot be resolved." }); return; }
  res.json(result);
});

router.get("/admin/reports", requireAdmin("moderation.read"), (req, res) => {
  const query = z.object({ status: z.string().optional(), priority: z.string().optional() }).parse(req.query);
  res.json({ items: listReports(query) });
});

router.get("/admin/integrity/snapshots", requireAdmin("integrity.read"), (_req, res) => {
  res.json({ items: listIntegritySnapshots() });
});

router.post("/admin/rewards/quarantine", requireAdmin("integrity.manage"), (req, res) => {
  const input = z.object({ rewardId: z.string().min(1), userId: z.string().min(1), entityType: z.string().min(1), entityId: z.string().min(1), amount: z.number().int().positive(), reason: z.string().trim().min(1).max(1000), snapshotId: z.string().optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Reward quarantine inputs are invalid." }); return; }
  res.json(quarantineReward({ ...input.data, actorId: req.adminPrincipal!.userId }));
});

router.post("/admin/rewards/:id/:action", requireAdmin("integrity.manage"), (req, res) => {
  if (req.params.action !== "release" && req.params.action !== "reverse") { res.status(400).json({ error: "Unsupported reward action." }); return; }
  const input = z.object({ reason: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "A reason is required." }); return; }
  const result = resolveReward({ actorId: req.adminPrincipal!.userId, rewardId: String(req.params.id), action: String(req.params.action) as "release" | "reverse", reason: input.data.reason });
  if (!result.ok) { res.status(result.code === "not_found" ? 404 : 409).json({ error: result.code === "already_resolved" ? "This reward quarantine is already resolved." : "Reward not found." }); return; }
  res.json(result);
});

router.get("/admin/moderation/settings", requireAdmin("moderation.read"), (_req, res) => {
  res.json({ settings: getModerationSettings() });
});

router.put("/admin/moderation/settings", requireAdmin("ai.settings.edit"), (req, res) => {
  const input = z.object({ automationEnabled: z.boolean().optional(), autoApprovalMode: z.enum(["manual_only", "low_risk", "mixed"]).optional(), quarantineThreshold: z.number().int().min(0).max(100).optional(), reviewThreshold: z.number().int().min(0).max(100).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Moderation settings are invalid." }); return; }
  res.json({ settings: updateModerationSettings(input.data, req.adminPrincipal!.userId) });
});

router.get("/admin/moderation/audit", requireAdmin("admin.audit.read"), (_req, res) => {
  res.json({ items: listAuditEvents() });
});

export default router;