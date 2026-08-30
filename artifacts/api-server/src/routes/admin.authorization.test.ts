import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

type StartedServer = { server: Server; origin: string };

const identities: Record<string, { id: string; role: string }> = {
  user: { id: "staff-user", role: "user" },
  creator: { id: "staff-creator", role: "creator" },
  moderator: { id: "staff-moderator", role: "moderator" },
  admin: { id: "staff-admin", role: "admin" },
};
const testMediaId = "11111111-1111-4111-8111-111111111111";
const blockedMediaId = "66666666-6666-4666-8666-666666666666";
const currentBlockedPath = "current-user/game/blocked-v2.jpg";
const currentBlockedFingerprint = createHash("md5").update(`custom-game-media|${currentBlockedPath}`).digest("hex");
let lastRetentionAction: Record<string, unknown> | null = null;
type RetentionTestRow = {
  media_id: string;
  status: "pending" | "processing" | "failed" | "completed";
  attempt_count: number;
  lease_acquired_at: string | null;
  next_attempt_at: string | null;
  storage_delete_outcome: "deleted" | "missing" | null;
  storage_deleted_at: string | null;
  failure_classification: "retryable" | "blocked_reference" | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  bucket: string;
  storage_path: string;
  storage_url: string;
  media_bytes: string;
};
const retentionRows: RetentionTestRow[] = [
  {
    media_id: "22222222-2222-4222-8222-222222222222",
    status: "pending",
    attempt_count: 0,
    lease_acquired_at: null,
    next_attempt_at: null,
    storage_delete_outcome: null,
    storage_deleted_at: null,
    failure_classification: null,
    last_error: null,
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T00:10:00.000Z",
    bucket: "proof-submissions",
    storage_path: "pending-user/proof/pending.jpg",
    storage_url: "https://storage.example.test/object/pending-user/proof/pending.jpg",
    media_bytes: "ffd8ffd9",
  },
  {
    media_id: "33333333-3333-4333-8333-333333333333",
    status: "failed",
    attempt_count: 2,
    lease_acquired_at: null,
    next_attempt_at: "2026-08-30T02:00:00.000Z",
    storage_delete_outcome: null,
    storage_deleted_at: null,
    failure_classification: "retryable",
    last_error: "Supabase Storage deletion failed for proof-submissions/retry-user/proof/retry.png with status 503. Source URL: https://storage.example.test/object/retry-user/proof/retry.png",
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T01:00:00.000Z",
    bucket: "proof-submissions",
    storage_path: "retry-user/proof/retry.png",
    storage_url: "https://storage.example.test/object/retry-user/proof/retry.png",
    media_bytes: "ffd8ffd9",
  },
  {
    media_id: "44444444-4444-4444-8444-444444444444",
    status: "completed",
    attempt_count: 1,
    lease_acquired_at: "2026-08-30T01:00:00.000Z",
    next_attempt_at: null,
    storage_delete_outcome: "deleted",
    storage_deleted_at: "2026-08-30T01:01:00.000Z",
    failure_classification: null,
    last_error: null,
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T01:01:00.000Z",
    bucket: "quest-media",
    storage_path: "deleted-user/quest/deleted.jpg",
    storage_url: "https://storage.example.test/object/deleted-user/quest/deleted.jpg",
    media_bytes: "ffd8ffd9",
  },
  {
    media_id: "55555555-5555-4555-8555-555555555555",
    status: "completed",
    attempt_count: 1,
    lease_acquired_at: "2026-08-30T01:10:00.000Z",
    next_attempt_at: null,
    storage_delete_outcome: "missing",
    storage_deleted_at: "2026-08-30T01:11:00.000Z",
    failure_classification: null,
    last_error: null,
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T01:11:00.000Z",
    bucket: "hunt-media",
    storage_path: "missing-user/hunt/missing.jpg",
    storage_url: "https://storage.example.test/object/missing-user/hunt/missing.jpg",
    media_bytes: "ffd8ffd9",
  },
  {
    media_id: "66666666-6666-4666-8666-666666666666",
    status: "failed",
    attempt_count: 3,
    lease_acquired_at: null,
    next_attempt_at: null,
    storage_delete_outcome: null,
    storage_deleted_at: null,
    failure_classification: "blocked_reference",
    last_error: "Storage reference no longer matches the moderation record; review required.",
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T01:12:00.000Z",
    bucket: "custom-game-media",
    storage_path: "blocked-user/game/blocked.jpg",
    storage_url: "https://storage.example.test/object/blocked-user/game/blocked.jpg",
    media_bytes: "ffd8ffd9",
  },
];

const generatedRetentionRows: RetentionTestRow[] = Array.from({ length: 125 }, (_, index) => {
  const updatedAt = new Date(Date.UTC(2026, 7, 29, 0, index)).toISOString();
  const kind = index % 5;
  const status = kind === 0
    ? "pending"
    : kind === 1
      ? "processing"
      : kind === 2 || kind === 3
        ? "failed"
        : "completed";
  const failureClassification = kind === 2 ? "retryable" : kind === 3 ? "blocked_reference" : null;
  return {
    media_id: `${(0x70000000 + index).toString(16)}-7000-4700-8700-${index.toString(16).padStart(12, "0")}`,
    status,
    attempt_count: kind === 0 ? 0 : index % 4,
    lease_acquired_at: status === "pending" ? null : updatedAt,
    next_attempt_at: status === "processing" || status === "failed" ? updatedAt : null,
    storage_delete_outcome: status === "completed" ? "deleted" : null,
    storage_deleted_at: status === "completed" ? updatedAt : null,
    failure_classification: failureClassification,
    last_error: failureClassification === "blocked_reference" ? "Review required." : null,
    created_at: "2026-08-28T00:00:00.000Z",
    updated_at: updatedAt,
    bucket: "generated-private-bucket",
    storage_path: `generated-user/proof/${index}.jpg`,
    storage_url: `https://storage.example.test/object/generated-user/proof/${index}.jpg`,
    media_bytes: "ffd8ffd9",
  };
});
retentionRows.push(...generatedRetentionRows);

let supabase: StartedServer;
let api: StartedServer;
let stateDirectory: string;
let moderationState: typeof import("../lib/moderation-state");
let caseId: string;

function listen(server: Server): Promise<StartedServer> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function request(pathname: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");
  return fetch(`${api.origin}/api${pathname}`, { ...options, headers });
}

describe("admin moderation authorization", () => {
  before(async () => {
    supabase = await listen(createServer((req, res) => {
      const token = req.headers.authorization?.replace(/^Bearer\s+/, "");
      const identity = token ? identities[token] : undefined;
      res.setHeader("Content-Type", "application/json");
      if (req.url?.startsWith("/rest/v1/media_assets")) {
        if (token !== "test-service-key") {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "trusted access required" }));
          return;
        }
        const url = new URL(req.url, "http://supabase.test");
        const mediaId = url.searchParams.get("id")?.replace(/^eq\./, "");
        res.end(JSON.stringify([mediaId === blockedMediaId ? {
          id: blockedMediaId,
          media_type: "image",
          mime_type: "image/jpeg",
          file_size: 1024,
          width: 640,
          height: 480,
          purpose: "custom_game",
          visibility: "private",
          moderation_status: "rejected",
          moderation_reason: "Blocked by policy",
          bucket: "custom-game-media",
          storage_path: currentBlockedPath,
          created_at: "2026-08-29T00:00:00.000Z",
          updated_at: "2026-08-30T01:13:00.000Z",
          deleted_at: "2026-08-30T01:12:00.000Z",
        } : {
          id: testMediaId,
          bucket: "proof-submissions",
          storage_path: "target-user/proof/test.png",
          deleted_at: null,
        }]));
        return;
      }
      if (req.url?.startsWith("/rest/v1/media_retention_cleanups")) {
        const url = new URL(req.url, "http://supabase.test");
        const mediaId = url.searchParams.get("media_id")?.replace(/^eq\./, "");
        const status = url.searchParams.get("status")?.replace(/^eq\./, "");
        const failureClassification = url.searchParams.get("failure_classification")?.replace(/^eq\./, "");
        const lastError = url.searchParams.get("last_error")?.replace(/^eq\./, "");
        const createdAt = url.searchParams.get("created_at")?.replace(/^lte\./, "");
        const matchingRows = retentionRows.filter((row) =>
          (!mediaId || row.media_id === mediaId)
          && (!createdAt || row.created_at <= createdAt)
          &&
          (!status || row.status === status)
          && (!failureClassification || row.failure_classification === failureClassification)
          && (!lastError || row.last_error === lastError),
        );
        if (req.headers.prefer === "count=exact") {
          res.setHeader(
            "content-range",
            matchingRows.length > 0
              ? `0-${matchingRows.length - 1}/${matchingRows.length}`
              : "0-0/0",
          );
          res.end("[]");
          return;
        }
        const limit = Number(url.searchParams.get("limit") ?? retentionRows.length);
        const page = matchingRows
          .slice()
          .sort((left, right) => right.created_at.localeCompare(left.created_at)
            || right.media_id.localeCompare(left.media_id))
          .slice(Number(url.searchParams.get("offset") ?? 0), Number(url.searchParams.get("offset") ?? 0) + limit);
        res.end(JSON.stringify(page));
        return;
      }
      if (req.url?.startsWith("/rest/v1/moderation_cases")) {
        res.end(JSON.stringify([{
          id: "77777777-7777-4777-8777-777777777777",
          status: "resolved",
          automated_provider: "test-provider",
          risk_categories: ["unsafe_media"],
          risk_score: 0.91,
          moderator_id: "staff-moderator",
          moderator_notes: `Review custom-game-media/${currentBlockedPath}.`,
          decision: "content_removed",
          decision_reason: "Policy violation",
          created_at: "2026-08-30T01:00:00.000Z",
          updated_at: "2026-08-30T01:10:00.000Z",
        }]));
        return;
      }
      if (req.url?.startsWith("/rest/v1/rpc/moderate_media_retention_cleanup") && req.method === "POST") {
        let rawBody = "";
        req.on("data", (chunk) => { rawBody += chunk; });
        req.on("end", () => {
          lastRetentionAction = JSON.parse(rawBody) as Record<string, unknown>;
          const status = lastRetentionAction.p_reference_fingerprint === currentBlockedFingerprint
            ? { status: "completed", action: lastRetentionAction.p_action, media_id: blockedMediaId }
            : { status: "reference_mismatch" };
          res.end(JSON.stringify(status));
        });
        return;
      }
      if (req.url?.startsWith("/storage/v1/object/sign/proof-submissions/")) {
        if (token !== "test-service-key" || req.method !== "POST") {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "trusted access required" }));
          return;
        }
        res.end(JSON.stringify({
          signedURL: "/object/sign/proof-submissions/target-user/proof/test.png?token=test-only",
        }));
        return;
      }
      if (!identity) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: "invalid token" }));
        return;
      }
      if (req.url === "/auth/v1/user") {
        res.end(JSON.stringify({ id: identity.id }));
        return;
      }
      if (req.url?.startsWith("/rest/v1/profiles")) {
        res.end(JSON.stringify([{
          id: identity.id,
          display_name: identity.role,
          username: identity.role,
          role: identity.role,
          account_status: "active",
        }]));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    }));

    stateDirectory = mkdtempSync(path.join(tmpdir(), "worlds-admin-auth-"));
    process.env.SUPABASE_URL = supabase.origin;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.MODERATION_LOCAL_STATE_PATH = path.join(stateDirectory, "moderation-state.json");

    const [{ default: app }, state] = await Promise.all([
      import("../app"),
      import("../lib/moderation-state"),
    ]);
    moderationState = state;
    api = await listen(createServer(app));

    const created = moderationState.createModerationRequest({
      entityType: "profile",
      entityId: "target-user",
      context: "profile",
      contentHash: "case-hash",
      result: {
        decision: "manual_review",
        categories: [],
        provider: "test",
        checkedAt: new Date().toISOString(),
        contentHash: "case-hash",
        policyVersion: "test",
        reviewRequired: true,
        userVisibleReason: "Review required",
      },
      outcome: {
        action: "manual_review",
        reason: "Review required",
        publicSafe: false,
        result: {
          decision: "manual_review",
          categories: [],
          provider: "test",
          checkedAt: new Date().toISOString(),
          contentHash: "case-hash",
          policyVersion: "test",
          reviewRequired: true,
          userVisibleReason: "Review required",
        },
      },
    });
    assert.ok(created.case);
    caseId = created.case.id;
    moderationState.quarantineReward({
      actorId: "seed",
      rewardId: "reward-under-review",
      userId: "target-user",
      entityType: "quest",
      entityId: "quest-1",
      amount: 25,
      reason: "Seeded for authorization verification",
    });
  });

  after(async () => {
    await Promise.all([
      new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())),
      new Promise<void>((resolve, reject) => supabase.server.close((error) => error ? reject(error) : resolve())),
    ]);
    rmSync(stateDirectory, { recursive: true, force: true });
  });

  it("rejects missing, invalid, and non-staff roles from moderation settings", async () => {
    assert.equal((await request("/admin/moderation/settings")).status, 401);
    assert.equal((await request("/admin/moderation/settings", {}, "invalid-token")).status, 403);
    assert.equal((await request("/admin/moderation/settings", {}, "user")).status, 403);
    assert.equal((await request("/admin/moderation/settings", {}, "creator")).status, 403);
  });

  it("does not let moderators suspend accounts or reverse quarantined rewards", async () => {
    const originalCase = structuredClone(moderationState.getModerationCase(caseId));
    const rewardsBefore = moderationState.getModerationStateDiagnostics().counts.quarantinedRewards;

    const suspended = await request(`/admin/moderation/cases/${caseId}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        decision: "account_suspended",
        reason: "Attempted escalation",
        confirmed: true,
      }),
    }, "moderator");
    assert.equal(suspended.status, 403);
    assert.deepEqual(moderationState.getModerationCase(caseId), originalCase);

    const reversed = await request("/admin/rewards/reward-under-review/reverse", {
      method: "POST",
      body: JSON.stringify({ reason: "Attempted reversal", confirmed: true }),
    }, "moderator");
    assert.equal(reversed.status, 403);
    assert.equal(moderationState.getModerationStateDiagnostics().counts.quarantinedRewards, rewardsBefore);
  });

  it("keeps moderation settings writes restricted and leaves settings unchanged on denial", async () => {
    const originalSettings = structuredClone(moderationState.getModerationSettings());
    const body = JSON.stringify({ automationEnabled: !originalSettings.automationEnabled });

    assert.equal((await request("/admin/moderation/settings", { method: "PUT", body }, "moderator")).status, 403);
    assert.equal((await request("/admin/moderation/settings", { method: "PUT", body }, "admin")).status, 403);
    assert.deepEqual(moderationState.getModerationSettings(), originalSettings);
  });

  it("issues short-lived media URLs only after staff moderation authorization", async () => {
    assert.equal((await request(`/admin/media/${testMediaId}/signed-url`)).status, 401);
    assert.equal((await request(`/admin/media/${testMediaId}/signed-url`, {}, "user")).status, 403);

    const response = await request(`/admin/media/${testMediaId}/signed-url`, {}, "moderator");
    assert.equal(response.status, 200);
    const body = await response.json() as { mediaId: string; signedUrl: string; expiresAt: string; storagePath?: string };
    assert.equal(body.mediaId, testMediaId);
    assert.match(body.signedUrl, /^http:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/sign\/proof-submissions\//);
    assert.ok(Date.parse(body.expiresAt) > Date.now());
    assert.equal(body.storagePath, undefined);
  });

  it("keeps media retention status staff-only, preserves persisted states, and excludes Storage references", async () => {
    assert.equal((await request("/admin/moderation/media-retention")).status, 401);
    assert.equal((await request("/admin/moderation/media-retention", {}, "user")).status, 403);
    assert.equal((await request("/admin/moderation/media-retention?page=0", {}, "moderator")).status, 400);
    assert.equal((await request("/admin/moderation/media-retention?page=not-a-number", {}, "moderator")).status, 400);
    assert.equal((await request("/admin/moderation/media-retention?snapshotAt=not-a-date", {}, "moderator")).status, 400);

    const response = await request("/admin/moderation/media-retention", {}, "moderator");
    assert.equal(response.status, 200);
    const serialized = await response.text();
    const body = JSON.parse(serialized) as {
      items: Array<Record<string, unknown>>;
      summary: Record<string, number>;
      list: {
        scope: string;
        ordering: string;
        limit: number;
        returned: number;
        hasMore: boolean;
        totalsScope: string;
      };
    };
    assert.deepEqual(body.summary, {
      pending: 26,
      retrying: 51,
      completed: 27,
      resolved: 0,
      blocked: 26,
      total: 130,
    });
    assert.deepEqual(body.list, {
      scope: "all",
      ordering: "created_at_desc",
      page: 1,
      pageSize: 100,
      offset: 0,
      limit: 100,
      returned: 100,
      hasMore: true,
      totalPages: 2,
      totalsScope: "all",
    });
    assert.equal(body.items.length, body.list.returned);
    assert.equal(body.items.length < body.summary.total, true);
    assert.equal(body.items[0]!.mediaId, retentionRows[4]!.media_id);
    assert.equal(body.items.some((item) => item.mediaId === generatedRetentionRows[29]!.media_id), false);
    assert.deepEqual(
      new Set(body.items.map((item) => item.state)),
      new Set(["pending", "retrying", "completed", "blocked"]),
    );

    const states = new Map(body.items.map((item) => [
      item.mediaId,
      { state: item.state, deletionOutcome: item.deletionOutcome, lastError: item.lastError },
    ]));
    assert.deepEqual(states.get(retentionRows[0]!.media_id), {
      state: "pending",
      deletionOutcome: null,
      lastError: null,
    });
    assert.deepEqual(states.get(retentionRows[1]!.media_id), {
      state: "retrying",
      deletionOutcome: null,
      lastError: "Supabase Storage deletion failed for [redacted storage reference] with status 503. Source URL: [redacted URL]",
    });
    assert.deepEqual(states.get(retentionRows[2]!.media_id), {
      state: "completed",
      deletionOutcome: "deleted",
      lastError: null,
    });
    assert.deepEqual(states.get(retentionRows[3]!.media_id), {
      state: "completed",
      deletionOutcome: "missing",
      lastError: null,
    });
    assert.deepEqual(states.get(retentionRows[4]!.media_id), {
      state: "blocked",
      deletionOutcome: null,
      lastError: "Storage reference no longer matches the moderation record; review required.",
    });

    for (const row of retentionRows) {
      assert.equal(serialized.includes(row.bucket), false);
      assert.equal(serialized.includes(row.storage_path), false);
      assert.equal(serialized.includes(row.storage_url), false);
      assert.equal(serialized.includes(row.media_bytes), false);
    }
    assert.equal(serialized.includes("bucket"), false);
    assert.equal(serialized.includes("storagePath"), false);
    assert.equal(serialized.includes("storageUrl"), false);
    assert.equal(serialized.includes("mediaBytes"), false);
  });

  it("returns older cleanup pages without changing all-history totals or exposing Storage references", async () => {
    const response = await request("/admin/moderation/media-retention?page=2", {}, "moderator");
    assert.equal(response.status, 200);
    const serialized = await response.text();
    const body = JSON.parse(serialized) as {
      items: Array<{ mediaId: string }>;
      summary: Record<string, number>;
      list: { page: number; pageSize: number; offset: number; returned: number; hasMore: boolean; totalPages: number };
    };
    assert.deepEqual(body.summary, {
      pending: 26,
      retrying: 51,
      completed: 27,
      resolved: 0,
      blocked: 26,
      total: 130,
    });
    assert.deepEqual(body.list, {
      scope: "all",
      ordering: "created_at_desc",
      page: 2,
      pageSize: 100,
      offset: 100,
      limit: 100,
      returned: 30,
      hasMore: false,
      totalPages: 2,
      totalsScope: "all",
    });
    assert.equal(body.items[0]!.mediaId, generatedRetentionRows[29]!.media_id);
    assert.equal(body.items.some((item) => item.mediaId === retentionRows[4]!.media_id), false);
    for (const row of retentionRows) {
      assert.equal(serialized.includes(row.bucket), false);
      assert.equal(serialized.includes(row.storage_path), false);
      assert.equal(serialized.includes(row.storage_url), false);
      assert.equal(serialized.includes(row.media_bytes), false);
    }
  });

  it("keeps numbered cleanup pages on one creation snapshot while worker activity continues", async () => {
    const firstResponse = await request("/admin/moderation/media-retention?page=1", {}, "moderator");
    assert.equal(firstResponse.status, 200);
    const firstBody = await firstResponse.json() as { snapshotAt: string };
    assert.ok(firstBody.snapshotAt);

    const originalUpdatedAt = retentionRows[0]!.updated_at;
    const newMediaId = "88888888-8888-4888-8888-888888888888";
    const newCreatedAt = new Date(Date.parse(firstBody.snapshotAt) + 1).toISOString();
    retentionRows[0]!.updated_at = "2026-08-31T00:00:00.000Z";
    retentionRows.push({
      ...retentionRows[0]!,
      media_id: newMediaId,
      created_at: newCreatedAt,
      updated_at: newCreatedAt,
    });

    try {
      const pageTwo = await request(
        `/admin/moderation/media-retention?page=2&snapshotAt=${encodeURIComponent(firstBody.snapshotAt)}`,
        {},
        "moderator",
      );
      assert.equal(pageTwo.status, 200);
      const pageTwoBody = await pageTwo.json() as {
        items: Array<{ mediaId: string }>;
        snapshotAt: string;
        list: { returned: number; totalPages: number };
      };
      assert.equal(pageTwoBody.snapshotAt, firstBody.snapshotAt);
      assert.equal(pageTwoBody.list.returned, 30);
      assert.equal(pageTwoBody.list.totalPages, 2);
      assert.equal(pageTwoBody.items[0]!.mediaId, generatedRetentionRows[29]!.media_id);
      assert.equal(pageTwoBody.items.some((item) => item.mediaId === newMediaId), false);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const refreshed = await request("/admin/moderation/media-retention?page=1", {}, "moderator");
      assert.equal(refreshed.status, 200);
      const refreshedBody = await refreshed.json() as {
        items: Array<{ mediaId: string }>;
        snapshotAt: string;
      };
      assert.notEqual(refreshedBody.snapshotAt, firstBody.snapshotAt);
      assert.equal(refreshedBody.items[0]!.mediaId, newMediaId);
    } finally {
      retentionRows.splice(retentionRows.findIndex((row) => row.media_id === newMediaId), 1);
      retentionRows[0]!.updated_at = originalUpdatedAt;
    }
  });

  it("lets only moderators inspect redacted cleanup evidence", async () => {
    assert.equal((await request(`/admin/moderation/media-retention/${blockedMediaId}`)).status, 401);
    assert.equal((await request(`/admin/moderation/media-retention/${blockedMediaId}`, {}, "user")).status, 403);

    const response = await request(`/admin/moderation/media-retention/${blockedMediaId}`, {}, "moderator");
    assert.equal(response.status, 200);
    const serialized = await response.text();
    const body = JSON.parse(serialized) as {
      mediaId: string;
      cleanup: { state: string };
      media: { preview: unknown };
      moderationCases: Array<{ riskCategories: string[] | null }>;
      canonicalReference: { fingerprint: string | null; matchesCleanup: boolean };
    };
    assert.equal(body.mediaId, blockedMediaId);
    assert.equal(body.cleanup.state, "blocked");
    assert.equal(body.media.preview, null);
    assert.deepEqual(body.moderationCases[0]?.riskCategories, ["unsafe_media"]);
    assert.equal(body.canonicalReference.fingerprint, currentBlockedFingerprint);
    assert.equal(body.canonicalReference.matchesCleanup, false);
    assert.equal(serialized.includes("custom-game-media"), false);
    assert.equal(serialized.includes("blocked-user/game/blocked.jpg"), false);
    assert.equal(serialized.includes(currentBlockedPath), false);
  });

  it("requires confirmation and routes retention actions through the trusted audited RPC", async () => {
    assert.equal((await request(`/admin/moderation/media-retention/${blockedMediaId}/action`, { method: "POST", body: JSON.stringify({ action: "requeue", reason: "Reference confirmed" }) }, "moderator")).status, 400);
    assert.equal((await request(`/admin/moderation/media-retention/${blockedMediaId}/action`, { method: "POST", body: JSON.stringify({ action: "requeue", referenceFingerprint: "00000000000000000000000000000000", reason: "Reference confirmed", confirmed: true }) }, "user")).status, 403);

    const response = await request(`/admin/moderation/media-retention/${blockedMediaId}/action`, {
      method: "POST",
      body: JSON.stringify({
        action: "requeue",
        referenceFingerprint: currentBlockedFingerprint,
        reason: "Reference confirmed after reviewing the current media record.",
        confirmed: true,
      }),
    }, "moderator");
    assert.equal(response.status, 200);
    assert.deepEqual(lastRetentionAction, {
      p_media_id: blockedMediaId,
      p_action: "requeue",
      p_reference_fingerprint: currentBlockedFingerprint,
      p_actor_id: "staff-moderator",
      p_actor_role: "moderator",
      p_reason: "Reference confirmed after reviewing the current media record.",
    });
    assert.deepEqual(await response.json(), { ok: true, action: "requeue", mediaId: blockedMediaId, auditRecorded: true });
  });

  it("rejects a stale canonical reference instead of changing cleanup state", async () => {
    const response = await request(`/admin/moderation/media-retention/${blockedMediaId}/action`, {
      method: "POST",
      body: JSON.stringify({
        action: "resolve",
        referenceFingerprint: "00000000000000000000000000000000",
        reason: "Stale reference",
        confirmed: true,
      }),
    }, "moderator");
    assert.equal(response.status, 409);
    assert.match(await response.text(), /canonical media reference changed/i);
  });
});