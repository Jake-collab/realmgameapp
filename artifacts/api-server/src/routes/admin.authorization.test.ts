import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type StartedServer = { server: Server; origin: string };

const identities: Record<string, { id: string; role: string }> = {
  user: { id: "staff-user", role: "user" },
  creator: { id: "staff-creator", role: "creator" },
  moderator: { id: "staff-moderator", role: "moderator" },
  admin: { id: "staff-admin", role: "admin" },
};
const testMediaId = "11111111-1111-4111-8111-111111111111";
const retentionRows = [
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
        res.end(JSON.stringify([{
          id: testMediaId,
          bucket: "proof-submissions",
          storage_path: "target-user/proof/test.png",
          deleted_at: null,
        }]));
        return;
      }
      if (req.url?.startsWith("/rest/v1/media_retention_cleanups")) {
        const url = new URL(req.url, "http://supabase.test");
        const status = url.searchParams.get("status")?.replace(/^eq\./, "");
        const failureClassification = url.searchParams.get("failure_classification")?.replace(/^eq\./, "");
        const lastError = url.searchParams.get("last_error")?.replace(/^eq\./, "");
        const matchingRows = retentionRows.filter((row) =>
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
        res.end(JSON.stringify(retentionRows));
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

    const response = await request("/admin/moderation/media-retention", {}, "moderator");
    assert.equal(response.status, 200);
    const serialized = await response.text();
    const body = JSON.parse(serialized) as {
      items: Array<Record<string, unknown>>;
      summary: Record<string, number>;
    };
    assert.deepEqual(body.summary, {
      pending: 1,
      retrying: 1,
      completed: 2,
      blocked: 1,
      total: 5,
    });
    assert.equal(body.items.length, body.summary.total);

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
});