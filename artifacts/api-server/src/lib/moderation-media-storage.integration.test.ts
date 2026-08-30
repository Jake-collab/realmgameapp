/**
 * Live rejected-media Storage retention coverage.
 *
 * This suite is intentionally skipped unless the disposable Supabase harness
 * provides QUEST_TEST_* credentials. It uses the real Storage API and the
 * production maintenance worker; the harness removes the complete Supabase
 * project after the run.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SupabaseNotificationStore } from "./durable-notifications";

type JsonObject = Record<string, unknown>;
type Fixture = {
  userId: string;
  mediaId: string;
  path: string;
  moderationCaseId: string;
};

const testUrl = process.env.QUEST_TEST_SUPABASE_URL ?? "";
const testServiceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";
const testDbUrl = process.env.QUEST_TEST_DB_URL ?? "";
const configured = Boolean(testUrl && testServiceRoleKey && testDbUrl);
const describeIntegration = configured ? describe : describe.skip;
const bucket = "moderation-quarantine";
const apiUrl = testUrl.replace(/\/$/, "");
const headers = {
  apikey: testServiceRoleKey,
  authorization: `Bearer ${testServiceRoleKey}`,
  "content-type": "application/json",
};

let store: SupabaseNotificationStore;
const fixtures: Fixture[] = [];
let bucketCreated = false;
const execFileAsync = promisify(execFile);

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) as T : undefined as T;
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return readJson<T>(await fetch(`${apiUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  }));
}

async function storage<T>(path: string, init: RequestInit = {}): Promise<T> {
  return readJson<T>(await fetch(`${apiUrl}/storage/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  }));
}

async function createUser(): Promise<string> {
  const response = await readJson<{ id?: string; user?: { id: string } }>(await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: `media-retention-${randomUUID()}@example.com`,
      password: `MediaRetention-${randomUUID()}-Password!`,
      email_confirm: true,
    }),
  }));
  const userId = response.user?.id ?? response.id;
  if (!userId) throw new Error("Supabase Auth did not return a fixture user.");
  return userId;
}

async function createBucket(): Promise<void> {
  const response = await fetch(`${apiUrl}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
  });
  const detail = response.ok ? "" : await response.text();
  if (!response.ok && response.status !== 409 && !detail.includes("BucketAlreadyExists")) {
    throw new Error(`Could not create Storage bucket: ${response.status} ${detail.slice(0, 500)}`);
  }
  bucketCreated = true;
}

async function uploadObject(path: string): Promise<void> {
  await readJson<unknown>(await fetch(
    `${apiUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: testServiceRoleKey,
        authorization: `Bearer ${testServiceRoleKey}`,
        "content-type": "image/jpeg",
        "x-upsert": "false",
      },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    },
  ));
}

async function listedObjectPaths(prefix: string): Promise<string[]> {
  const rows = await storage<Array<{ name: string }>>("object/list/" + encodeURIComponent(bucket), {
    method: "POST",
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  return rows.map((row) => row.name);
}

async function createFixture(hasObject: boolean): Promise<Fixture> {
  const userId = await createUser();
  const suffix = randomUUID();
  const path = `integration/${suffix}/rejected.jpg`;
  const fixture: Fixture = { userId, mediaId: "", path, moderationCaseId: "" };
  fixtures.push(fixture);
  if (hasObject) await uploadObject(path);

  const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const media = await rest<Array<{ id: string }>>("media_assets?select=id", {
    method: "POST",
    headers: { ...headers, prefer: "return=representation" },
    body: JSON.stringify({
      owner_user_id: userId,
      bucket,
      storage_path: path,
      media_type: "image",
      mime_type: "image/jpeg",
      file_size: 4,
      purpose: "moderation_test",
      visibility: "private",
      moderation_status: "rejected",
      moderation_reason: "disposable integration fixture",
      created_at: oldTimestamp,
      updated_at: oldTimestamp,
    }),
  });
  const mediaId = media[0]?.id;
  if (!mediaId) throw new Error("Media fixture was not created.");
  fixture.mediaId = mediaId;

  const moderationCases = await rest<Array<{ id: string }>>("moderation_cases?select=id", {
    method: "POST",
    headers: { ...headers, prefer: "return=representation" },
    body: JSON.stringify({
      entity_type: "media",
      entity_id: mediaId,
      status: "closed",
      decision: "content_removed",
      decision_reason: "disposable integration fixture",
    }),
  });
  const moderationCaseId = moderationCases[0]?.id;
  if (!moderationCaseId) throw new Error("Moderation evidence fixture was not created.");
  fixture.moderationCaseId = moderationCaseId;
  return fixture;
}

async function queryMedia(fixture: Fixture): Promise<JsonObject> {
  const rows = await rest<JsonObject[]>(
    `media_assets?select=id,deleted_at,moderation_status,visibility&id=eq.${fixture.mediaId}`,
  );
  const row = rows[0];
  if (!row) throw new Error("Media evidence row is no longer queryable.");
  return row;
}

async function queryCleanup(fixture: Fixture): Promise<JsonObject> {
  const rows = await rest<JsonObject[]>(
    `media_retention_cleanups?select=*&media_id=eq.${fixture.mediaId}`,
  );
  const row = rows[0];
  if (!row) throw new Error("Cleanup evidence row was not persisted.");
  return row;
}

async function removeFixture(fixture: Fixture): Promise<void> {
  await fetch(`${apiUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: [fixture.path] }),
  });
}

async function removeDatabaseFixtures(): Promise<void> {
  const mediaIds = fixtures
    .map((fixture) => fixture.mediaId)
    .filter((mediaId): mediaId is string => Boolean(mediaId));
  const caseIds = fixtures
    .map((fixture) => fixture.moderationCaseId)
    .filter((caseId): caseId is string => Boolean(caseId));
  if (mediaIds.length === 0) return;
  for (const id of [...mediaIds, ...caseIds]) {
    assert.match(id, /^[0-9a-f-]+$/i);
  }
  await execFileAsync("psql", [
    testDbUrl,
    "--no-psqlrc",
    "--quiet",
    "--set=ON_ERROR_STOP=1",
    "-c",
    [
      `DELETE FROM media_retention_cleanups WHERE media_id IN (${mediaIds.map((id) => `'${id}'`).join(",")});`,
      ...(caseIds.length > 0
        ? [`DELETE FROM moderation_cases WHERE id IN (${caseIds.map((id) => `'${id}'`).join(",")});`]
        : []),
      `DELETE FROM media_assets WHERE id IN (${mediaIds.map((id) => `'${id}'`).join(",")});`,
    ].join("\n"),
  ]);
}

async function removeAuthFixtures(): Promise<void> {
  for (const fixture of fixtures) {
    const response = await fetch(`${apiUrl}/auth/v1/admin/users/${fixture.userId}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Could not remove disposable Auth user: ${response.status}`);
    }
  }
}

describeIntegration("rejected media Storage retention", () => {
  before(async () => {
    process.env.SUPABASE_URL = testUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = testServiceRoleKey;
    await createBucket();
    store = new SupabaseNotificationStore();
  });

  after(async () => {
    let cleanupError: unknown;
    for (const fixture of fixtures) {
      try {
        await removeFixture(fixture);
      } catch (error) {
        cleanupError ??= error;
      }
    }
    try {
      await removeDatabaseFixtures();
    } catch (error) {
      cleanupError ??= error;
    }
    try {
      await removeAuthFixtures();
    } catch (error) {
      cleanupError ??= error;
    }
    if (bucketCreated) {
      const response = await fetch(`${apiUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok && response.status !== 404) {
        cleanupError ??= new Error(`Could not remove disposable Storage bucket: ${response.status}`);
      }
    }
    if (cleanupError) throw cleanupError;
  });

  it("deletes real objects while retaining media, moderation, cleanup, and audit evidence", async () => {
    const fixture = await createFixture(true);
    assert.deepEqual(await listedObjectPaths(`integration/${fixture.path.split("/")[1]}`), ["rejected.jpg"]);

    const result = await store.runMaintenance(30);
    assert.deepEqual(result.moderation_media, {
      candidates: 1,
      claimed: 1,
      deleted: 1,
      missing: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    });
    assert.deepEqual(await listedObjectPaths(`integration/${fixture.path.split("/")[1]}`), []);

    const media = await queryMedia(fixture);
    assert.equal(media.deleted_at !== null, true);
    assert.equal(media.moderation_status, "rejected");
    assert.equal(media.visibility, "private");
    const cleanup = await queryCleanup(fixture);
    assert.equal(cleanup.status, "completed");
    assert.equal(cleanup.storage_delete_outcome, "deleted");
    const cases = await rest<JsonObject[]>(
      `moderation_cases?select=id,decision&id=eq.${fixture.moderationCaseId}`,
    );
    assert.deepEqual(cases, [{ id: fixture.moderationCaseId, decision: "content_removed" }]);
    const audit = await rest<JsonObject[]>(
      `audit_logs?select=action,entity_id,after_snapshot&action=eq.moderation_media_storage_deleted&entity_id=eq.${fixture.mediaId}`,
    );
    assert.equal(audit.length, 1);
    assert.deepEqual((audit[0]?.after_snapshot as JsonObject).storage_outcome, "deleted");
  });

  it("records a missing object as a terminal idempotent success", async () => {
    const fixture = await createFixture(false);
    const result = await store.runMaintenance(30);
    assert.deepEqual(result.moderation_media, {
      candidates: 1,
      claimed: 1,
      deleted: 0,
      missing: 1,
      failed: 0,
      skipped: 0,
      errors: [],
    });
    const cleanup = await queryCleanup(fixture);
    assert.equal(cleanup.status, "completed");
    assert.equal(cleanup.storage_delete_outcome, "missing");
    assert.equal((await queryMedia(fixture)).moderation_status, "rejected");
  });

  it("keeps a transient Storage error retryable, then deletes on retry", async () => {
    const fixture = await createFixture(true);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (String(input).includes(`/storage/v1/object/${bucket}`) && body.includes(fixture.path)) {
        return new Response("temporary Storage outage", { status: 503 });
      }
      return originalFetch(input, init);
    };
    try {
      const failed = await store.runMaintenance(30);
      assert.deepEqual(failed.moderation_media, {
        candidates: 1,
        claimed: 1,
        deleted: 0,
        missing: 0,
        failed: 1,
        skipped: 0,
        errors: [{ mediaId: fixture.mediaId, error: "Supabase Storage deletion failed with status 503." }],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const retryable = await queryCleanup(fixture);
    assert.equal(retryable.status, "failed");
    assert.equal(retryable.attempt_count, 1);
    assert.equal(typeof retryable.next_attempt_at, "string");
    assert.equal(retryable.last_error, "Supabase Storage deletion failed with status 503.");
    await rest<void>(`media_retention_cleanups?media_id=eq.${fixture.mediaId}`, {
      method: "PATCH",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify({ next_attempt_at: new Date(Date.now() - 1_000).toISOString() }),
    });

    const retried = await store.runMaintenance(30);
    assert.deepEqual(retried.moderation_media, {
      candidates: 1,
      claimed: 1,
      deleted: 1,
      missing: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    });
    assert.deepEqual(await listedObjectPaths(`integration/${fixture.path.split("/")[1]}`), []);
    const completed = await queryCleanup(fixture);
    assert.equal(completed.status, "completed");
    assert.equal(completed.attempt_count, 2);
    assert.equal(completed.storage_delete_outcome, "deleted");
  });
});