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

router.get("/admin/session", (req, res) => {
  res.json(getUnavailableSession(req));
});

router.get("/admin/dashboard", (_req, res) => {
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

router.get("/admin/users", (req, res) => {
  const query = ListAdminUsersQueryParams.parse(req.query);
  res.json(ListAdminUsersResponse.parse({
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  }));
});

router.get("/admin/quests", (req, res) => {
  const query = ListAdminQuestsQueryParams.parse(req.query);
  res.json(ListAdminQuestsResponse.parse({
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  }));
});

router.get("/admin/review-queues", (_req, res) => {
  res.json(GetAdminReviewQueuesResponse.parse({ queues: [] }));
});

router.get("/admin/audit", (req, res) => {
  const query = ListAdminAuditLogsQueryParams.parse(req.query);
  res.json(ListAdminAuditLogsResponse.parse({
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  }));
});

router.get("/admin/diagnostics", (_req, res) => {
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

export default router;