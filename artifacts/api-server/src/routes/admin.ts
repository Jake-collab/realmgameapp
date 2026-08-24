import { Router, type IRouter, type Request, type Response as ExpressResponse } from "express";
import { randomUUID } from "node:crypto";
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
  comparePromptVersions,
  consumeGenerationQuota,
  generateQuest,
  getGenerationPlan,
  generatedQuestSchema,
  inspectCandidate,
  listPromptVersions,
  listGenerationHistory,
  createLocalCandidateDraft,
  recordRateLimitedGeneration,
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
  recordAuditEvent,
} from "../lib/moderation-state";
import { persistIntegritySnapshot, persistModerationResult } from "../lib/supabase-moderation";
import { ExpoPushProvider, NoopPushProvider, notificationStore, renderNotification, type NotificationEvent } from "../lib/notifications";
import { supabaseAdminConfigured, supabaseAdminRequest } from "../lib/supabase-admin";
import { evaluateHuntPlacement, type HuntPlacementSignals } from "../lib/hunt-placement";

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

async function adminRead<T>(path: string, options: RequestInit = {}) {
  if (!supabaseAdminConfigured()) throw new Error("Live admin data requires trusted Supabase access.");
  return supabaseAdminRequest<T>(path, options);
}

async function adminCount(path: string) {
  if (!supabaseAdminConfigured()) throw new Error("Live admin data requires trusted Supabase access.");
  const response = await fetch(`${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      prefer: "count=exact",
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed with status ${response.status}.`);
  const range = response.headers.get("content-range");
  return range ? Number(range.split("/")[1]) || 0 : 0;
}

function liveUnavailable(res: ExpressResponse, error: unknown, resource: string) {
  res.status(503).json({ error: error instanceof Error ? error.message : `${resource} is unavailable.` });
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

const pushProvider = process.env.EXPO_ACCESS_TOKEN ? new ExpoPushProvider() : new NoopPushProvider();

router.get("/admin/notifications", requireAdmin("admin.read"), async (_req, res) => {
  const items = notificationStore.all();
  const delivery = notificationStore.deliveryRecords();
  const health = await pushProvider.healthCheck();
  res.json({
    metrics: {
      notificationsCreatedToday: items.filter(item => item.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
      pushAttempts: delivery.filter(item => item.channel === "push").reduce((sum, item) => sum + item.attemptCount, 0),
      successfulPushes: delivery.filter(item => item.channel === "push" && ["sent", "delivered"].includes(item.status)).length,
      failedSends: delivery.filter(item => item.status === "failed").length,
      invalidTokens: delivery.filter(item => item.failureCategory === "invalid_token").length,
      pendingScheduled: notificationStore.scheduledCount(),
      queueBacklog: notificationStore.queuedDeliveryCount(),
      averageDeliveryLatencyMs: null,
    },
    provider: { ...health, reason: health.configured ? "Provider configured; receipts require provider receipt processing." : "Configure Expo access before push delivery can begin." },
    delivery: delivery.slice(0, 100),
    persistence: "local_restart_safe",
  });
});

router.post("/admin/notifications/run-due", requireAdmin("admin.diagnostics.read"), async (_req, res) => {
  const results = notificationStore.runDue();
  const delivery = await notificationStore.flushQueued(pushProvider);
  res.json({ processed: results.length, delivery, results: results.map(result => ({ jobId: result.job.id, status: result.job.status, notificationId: result.notification?.id ?? null })) });
});

router.get("/admin/notifications/diagnostics", requireAdmin("admin.diagnostics.read"), async (_req, res) => {
  const health = await pushProvider.healthCheck();
  const delivery = notificationStore.deliveryRecords();
  res.json({
    providerConfigured: health.configured,
    providerReachable: health.reachable,
    queueHealth: notificationStore.queuedDeliveryCount() ? "queued" : "clear",
    oldestQueuedJob: null,
    invalidTokenCount: delivery.filter(item => item.failureCategory === "invalid_token").length,
    lastSuccessfulSend: delivery.find(item => ["sent", "delivered"].includes(item.status))?.lastAttemptAt ?? null,
    lastFailedSend: delivery.find(item => item.status === "failed")?.lastAttemptAt ?? null,
    receiptProcessing: "not_configured",
    fanoutHealth: "not_configured",
  });
});

router.post("/admin/notifications/test", requireAdmin("admin.read"), async (req, res) => {
  const principal = req.adminPrincipal;
  if (!principal) { res.status(403).json({ error: "Staff authorization required." }); return; }
  const event: NotificationEvent = {
    eventId: randomUUID(),
    idempotencyKey: `admin_test:${principal.userId}:${Date.now()}`,
    userId: principal.userId,
    type: "ACCOUNT_SECURITY",
    category: "account",
    variables: { message: "This is a test notification from the Worlds Admin Panel." },
    deepLink: "worlds://notifications",
  };
  const record = notificationStore.process(event);
  const delivery = await notificationStore.flushQueued(pushProvider);
  res.status(201).json({ test: true, notification: record ?? renderNotification(event), delivery });
});

router.get("/admin/dashboard", requireAdmin("admin.read"), async (_req, res) => {
  try {
    const [users, quests, proofs, hunts, reports, cases] = await Promise.all([
      adminCount("profiles?account_status=eq.active"),
      adminCount("quests?status=eq.published"),
      adminCount("proof_submissions?status=in.(submitted,under_review)"),
      adminCount("hunts?status=in.(pending_review,active)"),
      adminCount("reports?status=eq.open"),
      adminCount("moderation_cases?status=in.(open,under_review)"),
    ]);
    const actionQueue = [
      { id: "proofs", category: "proof", title: `${proofs} proof submissions need review`, priority: proofs ? "high" : "normal", href: "/quests/submissions", age: null },
      { id: "hunts", category: "hunts", title: `${hunts} Hunts need attention`, priority: hunts ? "high" : "normal", href: "/hunts", age: null },
      { id: "reports", category: "safety", title: `${reports} safety reports are open`, priority: reports ? "critical" : "normal", href: "/moderation/reports", age: null },
    ].filter((item) => !item.title.startsWith("0 "));
    res.json(GetAdminDashboardResponse.parse({
      metrics: [
        { label: "Active users", value: users, status: "available" },
        { label: "Published Quests", value: quests, status: "available" },
        { label: "Pending proof", value: proofs, status: "available" },
        { label: "Custom Hunt review", value: hunts, status: "available" },
        { label: "Open safety reports", value: reports, status: "available" },
        { label: "Open moderation cases", value: cases, status: "available" },
      ],
      actionQueue,
      generatedAt: new Date(),
    }));
  } catch (error) { liveUnavailable(res, error, "Dashboard data"); }
});

router.get("/admin/users", requireAdmin("admin.users.read"), async (req, res) => {
  const query = ListAdminUsersQueryParams.parse(req.query);
  const offset = (query.page - 1) * query.pageSize;
  const filters = [
    query.status ? `&account_status=eq.${encodeURIComponent(query.status)}` : "",
    query.search ? `&or=(username.ilike.*${encodeURIComponent(query.search)}*,display_name.ilike.*${encodeURIComponent(query.search)}*)` : "",
  ].join("");
  try {
    const [rows, total] = await Promise.all([
      adminRead<Array<Record<string, unknown>>>(`profiles?select=id,display_name,username,role,account_status,created_at,last_active_at&order=created_at.desc&offset=${offset}&limit=${query.pageSize}${filters}`),
      adminCount(`profiles?select=id${filters.replace(/^&/, "&")}`),
    ]);
    res.json(ListAdminUsersResponse.parse({
      items: rows.map((row) => ({ id: String(row.id), displayName: String(row.display_name), username: String(row.username), publicUserRef: null, role: String(row.role), accountStatus: String(row.account_status), createdAt: row.created_at, lastActiveAt: row.last_active_at ?? null, questCompletions: null, huntCompletions: null, totalPoints: null, openCases: null })),
      page: query.page, pageSize: query.pageSize, total,
    }));
  } catch (error) { liveUnavailable(res, error, "User data"); }
});

router.get("/admin/quests", requireAdmin("admin.quests.read"), async (req, res) => {
  const query = ListAdminQuestsQueryParams.parse(req.query);
  const offset = (query.page - 1) * query.pageSize;
  const filters = `${query.status ? `&status=eq.${encodeURIComponent(query.status)}` : ""}${query.type ? `&quest_type=eq.${encodeURIComponent(query.type)}` : ""}${query.search ? `&title=ilike.*${encodeURIComponent(query.search)}*` : ""}`;
  try {
    const [rows, total] = await Promise.all([
      adminRead<Array<Record<string, unknown>>>(`quests?select=id,title,quest_type,status,difficulty,points_reward,source_type,updated_at&order=updated_at.desc&offset=${offset}&limit=${query.pageSize}${filters}`),
      adminCount(`quests?select=id${filters}`),
    ]);
    res.json(ListAdminQuestsResponse.parse({
      items: rows.map((row) => ({ id: String(row.id), title: String(row.title), type: String(row.quest_type), status: String(row.status), difficulty: row.difficulty ?? null, points: row.points_reward ?? null, source: String(row.source_type), completionCount: null, reviewCount: null, updatedAt: row.updated_at })),
      page: query.page, pageSize: query.pageSize, total,
    }));
  } catch (error) { liveUnavailable(res, error, "Quest data"); }
});

router.get("/admin/hunts", requireAdmin("admin.review.read"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const offset = (page - 1) * pageSize;
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const filter = search ? `&or=(title.ilike.*${encodeURIComponent(search)}*,slug.ilike.*${encodeURIComponent(search)}*)` : "";
  try {
    const [rows, total] = await Promise.all([
      adminRead<Array<Record<string, unknown>>>(`hunts?select=id,title,slug,status,privacy,created_at,updated_at,starts_at&order=updated_at.desc&offset=${offset}&limit=${pageSize}${filter}`),
      adminCount(`hunts?select=id${filter}`),
    ]);
    res.json({ items: rows.map((row) => ({
      id: row.id, title: row.title, slug: row.slug, status: row.status, privacy: row.privacy,
      createdAt: row.created_at, updatedAt: row.updated_at, startsAt: row.starts_at ?? null,
    })), page, pageSize, total });
  } catch (error) { liveUnavailable(res, error, "Hunt data"); }
});

router.get("/admin/interests", requireAdmin("admin.quests.read"), async (_req, res) => {
  if (!supabaseAdminConfigured()) {
    res.status(503).json({ error: "Interest Bubble administration requires Supabase." });
    return;
  }
  try {
    const items = await supabaseAdminRequest<Array<Record<string, unknown>>>("interests?select=*&order=sort_order.asc,name.asc");
    res.json({ items });
  } catch {
    res.status(503).json({ error: "Interest Bubble records are unavailable." });
  }
});

router.post("/admin/interests", requireAdmin("admin.quests.manage"), async (req, res) => {
  const parsed = z.object({
    slug: z.string().regex(/^[a-z0-9_-]+$/).min(1).max(60),
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(500).nullable().optional(),
    icon_key: z.string().trim().max(60).nullable().optional(),
    sort_order: z.number().int().min(0).max(10000).default(0),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid Interest Bubble." }); return; }
  try {
    const items = await supabaseAdminRequest<Array<Record<string, unknown>>>("interests", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ ...parsed.data, is_active: true }),
    });
    res.status(201).json({ item: items[0] ?? null });
  } catch { res.status(503).json({ error: "Interest Bubble could not be created." }); }
});

router.patch("/admin/interests/:id", requireAdmin("admin.quests.manage"), async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    icon_key: z.string().trim().max(60).nullable().optional(),
    sort_order: z.number().int().min(0).max(10000).optional(),
    is_active: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) { res.status(400).json({ error: "Invalid Interest Bubble update." }); return; }
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const items = await supabaseAdminRequest<Array<Record<string, unknown>>>(`interests?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify(parsed.data),
    });
    res.json({ item: items[0] ?? null });
  } catch { res.status(503).json({ error: "Interest Bubble could not be updated." }); }
});

router.get("/admin/review-queues", requireAdmin("admin.review.read"), async (_req, res) => {
  try {
    const [proofs, hunts, reports] = await Promise.all([
      adminCount("proof_submissions?status=in.(submitted,under_review)"),
      adminCount("hunts?status=eq.pending_review"),
      adminCount("reports?status=eq.open"),
    ]);
    res.json(GetAdminReviewQueuesResponse.parse({ queues: [
      { id: "proofs", category: "Proof review", title: "Quest and Hunt proof submissions", priority: proofs ? "high" : "normal", href: "/quests/submissions", age: null, count: proofs },
      { id: "hunts", category: "Hunt review", title: "Creator Hunt submissions", priority: hunts ? "high" : "normal", href: "/hunts", age: null, count: hunts },
      { id: "reports", category: "Safety", title: "Open safety reports", priority: reports ? "critical" : "normal", href: "/moderation/reports", age: null, count: reports },
    ] }));
  } catch (error) { liveUnavailable(res, error, "Review queue data"); }
});

router.get("/admin/audit", requireAdmin("admin.audit.read"), async (req, res) => {
  const query = ListAdminAuditLogsQueryParams.parse(req.query);
  const offset = (query.page - 1) * query.pageSize;
  const filter = query.search ? `&or=(action.ilike.*${encodeURIComponent(query.search)}*,entity_type.ilike.*${encodeURIComponent(query.search)}*)` : "";
  try {
    const [rows, total] = await Promise.all([
      adminRead<Array<Record<string, unknown>>>(`audit_logs?select=id,created_at,actor_id,action,entity_type,entity_id,result,reason&order=created_at.desc&offset=${offset}&limit=${query.pageSize}${filter}`),
      adminCount(`audit_logs?select=id${filter}`),
    ]);
    res.json(ListAdminAuditLogsResponse.parse({ items: rows.map((row) => ({ id: String(row.id), timestamp: row.created_at, actor: row.actor_id ?? null, actorRole: null, action: String(row.action), entityType: String(row.entity_type), entity: row.entity_id ?? null, result: String(row.result), reason: row.reason ?? null })), page: query.page, pageSize: query.pageSize, total }));
  } catch (error) { liveUnavailable(res, error, "Audit data"); }
});

router.get("/admin/diagnostics", requireAdmin("admin.diagnostics.read"), async (_req, res) => {
  const checkedAt = new Date();
  let database: { status: "healthy" | "unavailable"; summary: string };
  try {
    await adminRead<Array<{ id: string }>>("profiles?select=id&limit=1");
    database = { status: "healthy", summary: "Trusted Supabase reads are available." };
  } catch {
    database = { status: "unavailable", summary: "Trusted Supabase reads are unavailable." };
  }
  res.json(GetAdminDiagnosticsResponse.parse({
    checks: [
      { name: "Supabase", status: database.status, summary: database.summary, checkedAt },
      { name: "Mapbox", status: "missing", summary: "Mapbox diagnostics will appear when the native map configuration is connected.", checkedAt },
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

router.get("/admin/ai/prompts/:type/compare", requireAdmin("ai.prompts.read"), (req, res) => {
  const type = req.params.type as QuestGenerationType;
  const left = Number(req.query.left);
  const right = Number(req.query.right);
  if (!questGenerationTypes.includes(type) || !Number.isInteger(left) || !Number.isInteger(right)) {
    res.status(400).json({ error: "Two valid prompt versions are required." });
    return;
  }
  const comparison = comparePromptVersions(type, left, right);
  if (!comparison) { res.status(404).json({ error: "Prompt version not found." }); return; }
  res.json(comparison);
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
    recordRateLimitedGeneration(requestedBy, input.data.type, input.data.quantity, quota.retryAfterSeconds);
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

router.post("/admin/ai/candidates/draft", requireAdmin("admin.quests.manage"), async (req, res) => {
  const candidate = generatedQuestSchema.safeParse(req.body?.candidate);
  if (!candidate.success) {
    res.status(400).json({ error: "A complete, validated Quest candidate is required." });
    return;
  }
  const review = inspectCandidate(candidate.data, candidate.data.quest_type);
  if (!review.valid) {
    res.status(400).json({ error: "This candidate must be fixed before it can enter review.", diagnostics: review.diagnostics });
    return;
  }
   if (!supabaseAdminConfigured() && process.env.NODE_ENV !== "production") {
     const draft = createLocalCandidateDraft(candidate.data, req.adminPrincipal?.userId ?? "staff");
     res.status(201).json({ draft: { id: draft.id, status: draft.status, createdAt: draft.createdAt, reviewRequired: true }, persistence: "local-development-only", message: "AI candidate saved to local development review storage. It is not a published Quest." });
     return;
   }
   if (!supabaseAdminConfigured()) {
     res.status(503).json({ error: "Saving AI drafts requires trusted Supabase access." });
     return;
   }
  try {
    const rows = await supabaseAdminRequest<Array<{ id: string; approval_status: string; created_at: string }>>("ai_generated_content", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        content_type: "quest",
        output_draft: candidate.data,
        suggested_points: candidate.data.recommended_points,
        approval_status: "pending_review",
      }),
    });
    const draft = rows[0];
    if (!draft) throw new Error("Draft record was not returned.");
    res.status(201).json({
      draft: {
        id: draft.id,
        status: draft.approval_status,
        createdAt: draft.created_at,
        reviewRequired: true,
      },
      message: "AI candidate saved for human review. It is not a published Quest.",
    });
  } catch {
    res.status(503).json({ error: "The AI candidate could not be saved to the review workflow." });
  }
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
  const localPersistence = createModerationRequest({ entityType: input.data.entityType, entityId: input.data.entityId, context: input.data.context, contentHash: outcome.result.contentHash, result: outcome.result, outcome });
  const databasePersistence = await persistModerationResult({ idempotencyKey: localPersistence.request.idempotencyKey, entityType: input.data.entityType, entityId: input.data.entityId, context: input.data.context, contentHash: outcome.result.contentHash, result: outcome.result, outcome }).catch((error: unknown) => ({ persisted: false, reason: error instanceof Error ? error.message : "Database persistence failed." }));
  res.json({ ...outcome, persistence: { local: localPersistence, database: databasePersistence } });
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
  const localPersistence = createModerationRequest({ entityType: input.data.entityType, entityId: input.data.entityId, context: input.data.context, contentHash: outcome.result.contentHash, result: outcome.result, outcome });
  const databasePersistence = await persistModerationResult({ idempotencyKey: localPersistence.request.idempotencyKey, entityType: input.data.entityType, entityId: input.data.entityId, context: input.data.context, contentHash: outcome.result.contentHash, result: outcome.result, outcome }).catch((error: unknown) => ({ persisted: false, reason: error instanceof Error ? error.message : "Database persistence failed." }));
  res.json({ ...outcome, persistence: { local: localPersistence, database: databasePersistence } });
});

router.post("/admin/integrity/evaluate", requireAdmin("integrity.manage"), async (req, res) => {
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
  const snapshot = createIntegritySnapshot({ userId, entityType, entityId, signals });
  const databasePersistence = await persistIntegritySnapshot({ userId, entityType, entityId, snapshot }).catch((error: unknown) => ({ persisted: false, reason: error instanceof Error ? error.message : "Database persistence failed." }));
  res.json({ ...snapshot, persistence: databasePersistence });
});

router.get("/admin/hunts/drops/review", requireAdmin("admin.review.read"), async (_req, res) => {
  if (!supabaseAdminConfigured()) {
    res.json({ items: [], configured: false, reason: "Live Hunt Drop reviews require trusted Supabase access." });
    return;
  }
  try {
    const items = await supabaseAdminRequest<unknown[]>(
      "hunt_drop_placements?select=id,hunt_stop_id,placement_method,decision,policy_version,safety_signals,created_at&order=created_at.desc&limit=100",
    );
    res.json({ items, configured: true });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Hunt Drop review is unavailable." });
  }
});

router.post("/admin/hunts/drops/placement-diagnostic", requireAdmin("admin.review.read"), (req, res) => {
  const input = z.object({
    latitude: z.number().nullable(), longitude: z.number().nullable(),
    gpsAccuracyMeters: z.number().nonnegative().nullable(),
    scanComplete: z.boolean(), motionCoverageDegrees: z.number().nonnegative().nullable(),
    creatorDeclarationConfirmed: z.boolean(),
    mapClassification: z.enum(["PUBLIC_OUTDOOR", "PUBLIC_INDOOR", "COMMERCIAL_PUBLIC_ACCESS", "PEDESTRIAN_PUBLIC_AREA", "UNKNOWN", "RESIDENTIAL_PRIVATE_LIKELY", "ROADWAY", "RESTRICTED_LIKELY", "HAZARDOUS_LIKELY"]),
    moderation: z.enum(["approved", "pending", "rejected", "not_required"]),
    visionAvailable: z.boolean(), locationSceneMismatch: z.boolean(), mockLocationDetected: z.boolean().optional(),
    scene: z.object({
      roadwayVisible: z.boolean(), restrictedSignage: z.boolean(), constructionOrHazard: z.boolean(),
      trafficRisk: z.boolean(), safeDropAreaLikely: z.boolean(),
    }).nullable().optional(),
  }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Placement diagnostic inputs are invalid." }); return; }
  res.json(evaluateHuntPlacement(input.data as HuntPlacementSignals));
});

router.post("/admin/hunts/drops/:id/relocation-requests", requireAdmin("admin.review.read"), async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(1).max(2000) }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "A relocation reason is required." }); return; }
  if (!supabaseAdminConfigured()) { res.status(503).json({ error: "Live Hunt Drop reviews require trusted Supabase access." }); return; }
  try {
    const records = await supabaseAdminRequest<unknown[]>("hunt_drop_relocation_requests", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ hunt_stop_id: req.params.id, requested_by: req.adminPrincipal!.userId, reason: input.data.reason }),
    });
    res.status(201).json({ request: records[0] ?? null });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to create relocation request." });
  }
});

router.post("/admin/hunts/drops/:id/safety-reports", requireAdmin("moderation.manage"), async (req, res) => {
  const input = z.object({
    category: z.enum(["unsafe_access", "private_property", "roadway", "restricted_area", "hazard", "moved_or_missing", "other"]),
    detail: z.string().trim().max(2000).optional(),
  }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Safety report inputs are invalid." }); return; }
  if (!supabaseAdminConfigured()) { res.status(503).json({ error: "Live Hunt Drop reviews require trusted Supabase access." }); return; }
  try {
    const records = await supabaseAdminRequest<unknown[]>("hunt_drop_safety_reports", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ hunt_stop_id: req.params.id, reporter_id: req.adminPrincipal!.userId, ...input.data }),
    });
    res.status(201).json({ report: records[0] ?? null });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to create safety report." });
  }
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

router.post("/admin/moderation/cases/:id/claim", requireAdmin("moderation.case.claim"), (req, res) => {
  const result = claimModerationCase(String(req.params.id), req.adminPrincipal!.userId);
  if (!result.ok) { res.status(result.code === "not_found" ? 404 : 409).json({ error: result.code === "claimed_by_other" ? "This case is already claimed by another moderator." : "This case cannot be claimed." }); return; }
  res.json(result);
});

router.post("/admin/moderation/cases/:id/resolve", requireAdmin("moderation.case.resolve"), (req, res) => {
  const input = z.object({ decision: z.enum(["no_action", "warning", "content_removed", "account_restricted", "account_suspended", "quarantine", "release", "reverse"]), reason: z.string().trim().min(1).max(2000), confirmed: z.literal(true), expectedUpdatedAt: z.string().optional(), idempotencyKey: z.string().trim().min(8).max(100).optional() }).safeParse(req.body);
  if (!input.success) {
    recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "moderation_decision", entityType: "moderation_case", entityId: String(req.params.id), result: "rejected", metadata: { validation: "confirmation_reason_or_decision_missing" } });
    res.status(400).json({ error: "Explicit confirmation, a decision, and a reason are required." }); return;
  }
  const actionPermission = input.data.decision === "account_restricted" ? "moderation.manage" : input.data.decision === "account_suspended" ? "moderation.manage" : "moderation.case.resolve";
  if (!req.adminPrincipal?.permissions.includes(actionPermission)) {
    recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "moderation_decision", entityType: "moderation_case", entityId: String(req.params.id), result: "rejected", reason: input.data.reason, metadata: { decision: input.data.decision, permission: actionPermission } });
    res.status(403).json({ error: "You do not have permission for this moderation action." }); return;
  }
  recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "moderation_decision", entityType: "moderation_case", entityId: String(req.params.id), result: "attempted", reason: input.data.reason, metadata: { decision: input.data.decision, idempotencyKey: input.data.idempotencyKey ?? null } });
  const result = resolveModerationCase(String(req.params.id), { ...input.data, actorId: req.adminPrincipal!.userId });
  if (!result.ok) {
    recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "moderation_decision", entityType: "moderation_case", entityId: String(req.params.id), result: result.code === "stale_case" ? "conflict" : "rejected", reason: input.data.reason, metadata: { decision: input.data.decision, code: result.code } });
    res.status(result.code === "not_found" ? 404 : 409).json({ error: result.code === "stale_case" ? "This case was updated by another moderator. Refresh before taking action." : "This case cannot be resolved." }); return;
  }
  recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "moderation_decision", entityType: "moderation_case", entityId: String(req.params.id), result: "completed", reason: input.data.reason, metadata: { decision: input.data.decision } });
  res.json(result);
});

router.get("/admin/reports", requireAdmin("moderation.read"), (req, res) => {
  const query = z.object({ status: z.string().optional(), priority: z.string().optional() }).parse(req.query);
  res.json({ items: listReports(query) });
});

router.get("/admin/integrity/snapshots", requireAdmin("integrity.read"), (_req, res) => {
  res.json({ items: listIntegritySnapshots() });
});

router.post("/admin/rewards/quarantine", requireAdmin("integrity.reward.quarantine"), (req, res) => {
  const input = z.object({ rewardId: z.string().min(1), userId: z.string().min(1), entityType: z.string().min(1), entityId: z.string().min(1), amount: z.number().int().positive(), reason: z.string().trim().min(1).max(1000), confirmed: z.literal(true), snapshotId: z.string().optional(), idempotencyKey: z.string().trim().min(8).max(100).optional() }).safeParse(req.body);
  if (!input.success) { recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "points_quarantined", entityType: "reward", entityId: String(req.body?.rewardId ?? ""), result: "rejected", metadata: { validation: "confirmation_reason_or_fields_missing" } }); res.status(400).json({ error: "Explicit confirmation, a reason, and valid reward inputs are required." }); return; }
  recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: "points_quarantined", entityType: input.data.entityType, entityId: input.data.entityId, result: "attempted", reason: input.data.reason, metadata: { rewardId: input.data.rewardId, idempotencyKey: input.data.idempotencyKey ?? null } });
  res.json(quarantineReward({ ...input.data, actorId: req.adminPrincipal!.userId }));
});

router.post("/admin/rewards/:id/:action", async (req, res, next) => {
  if (req.params.action !== "release" && req.params.action !== "reverse") { res.status(400).json({ error: "Unsupported reward action." }); return; }
  const permission = req.params.action === "release" ? "integrity.reward.release" : "integrity.reward.reverse";
  return requireAdmin(permission)(req, res, next);
}, (req, res) => {
  if (req.params.action !== "release" && req.params.action !== "reverse") { res.status(400).json({ error: "Unsupported reward action." }); return; }
  const input = z.object({ reason: z.string().trim().min(1).max(1000), confirmed: z.literal(true), idempotencyKey: z.string().trim().min(8).max(100).optional() }).safeParse(req.body);
  if (!input.success) { recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: `points_${String(req.params.action)}`, entityType: "reward", entityId: String(req.params.id), result: "rejected", metadata: { validation: "confirmation_or_reason_missing" } }); res.status(400).json({ error: "Explicit confirmation and a reason are required." }); return; }
  recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: `points_${String(req.params.action)}`, entityType: "reward", entityId: String(req.params.id), result: "attempted", reason: input.data.reason, metadata: { idempotencyKey: input.data.idempotencyKey ?? null } });
  const result = resolveReward({ actorId: req.adminPrincipal!.userId, rewardId: String(req.params.id), action: String(req.params.action) as "release" | "reverse", reason: input.data.reason });
  if (!result.ok) { recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: `points_${String(req.params.action)}`, entityType: "reward", entityId: String(req.params.id), result: "conflict", reason: input.data.reason, metadata: { code: result.code } }); res.status(result.code === "not_found" ? 404 : 409).json({ error: result.code === "already_resolved" ? "This reward quarantine is already resolved." : "Reward not found." }); return; }
  recordAuditEvent({ actorId: req.adminPrincipal?.userId ?? null, action: `points_${String(req.params.action)}`, entityType: "reward", entityId: String(req.params.id), result: "completed", reason: input.data.reason });
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