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
});