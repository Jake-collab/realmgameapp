/**
 * Live rejected-media Storage retention coverage.
 *
 * This suite is intentionally skipped unless the disposable Supabase harness
 * provides QUEST_TEST_* credentials. It uses the real Storage API and the
 * production maintenance worker; the harness removes the complete Supabase
 * project after the run. The access test covers the bucket policies from
 * migrations 051 and 053, plus the proof folder contract from migration 052.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SupabaseNotificationStore } from "./durable-notifications";

type JsonObject = Record<string, unknown>;
type TestUser = {
  id: string;
  email: string;
  password: string;
};
type Fixture = {
  userId: string;
  mediaId: string;
  bucket: string;
  path: string;
  moderationCaseId: string;
};

const testUrl = process.env.QUEST_TEST_SUPABASE_URL ?? "";
const testAnonKey = process.env.QUEST_TEST_SUPABASE_ANON_KEY ?? "";
const testServiceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";
const testDbUrl = process.env.QUEST_TEST_DB_URL ?? "";
const configured = Boolean(testUrl && testAnonKey && testServiceRoleKey && testDbUrl);
const describeIntegration = configured ? describe : describe.skip;
const retentionBucket = "moderation-quarantine";
const canonicalBuckets = [
  "avatars",
  "quest-media",
  "hunt-media",
  "custom-game-media",
  "proof-submissions",
  "moderation-quarantine",
] as const;
const apiUrl = testUrl.replace(/\/$/, "");
const headers = {
  apikey: testServiceRoleKey,
  authorization: `Bearer ${testServiceRoleKey}`,
  "content-type": "application/json",
};

let store: SupabaseNotificationStore;
const fixtures: Fixture[] = [];
const users: TestUser[] = [];
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

async function createUser(): Promise<TestUser> {
  const password = `MediaRetention-${randomUUID()}-Password!`;
  const email = `media-retention-${randomUUID()}@example.com`;
  const response = await readJson<{ id?: string; user?: { id: string } }>(await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  }));
  const userId = response.user?.id ?? response.id;
  if (!userId) throw new Error("Supabase Auth did not return a fixture user.");
  const user = { id: userId, email, password };
  users.push(user);
  return user;
}

async function createBucket(targetBucket = retentionBucket): Promise<void> {
  const response = await fetch(`${apiUrl}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: targetBucket, name: targetBucket, public: false }),
  });
  const detail = response.ok ? "" : await response.text();
  if (!response.ok && response.status !== 409 && !detail.includes("BucketAlreadyExists")) {
    throw new Error(`Could not create Storage bucket: ${response.status} ${detail.slice(0, 500)}`);
  }
  bucketCreated = true;
}

function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function fixturePrefix(fixture: Fixture): string {
  return fixture.path.split("/").slice(0, -1).join("/");
}

async function uploadObject(targetBucket: string, path: string): Promise<void> {
  await readJson<unknown>(await fetch(
    `${apiUrl}/storage/v1/object/${encodeURIComponent(targetBucket)}/${encodeStoragePath(path)}`,
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

async function uploadObjectAsUser(
  targetBucket: string,
  path: string,
  user: TestUser,
): Promise<void> {
  const accessToken = await accessTokenFor(user);
  await readJson<unknown>(
    await fetch(
      `${apiUrl}/storage/v1/object/${encodeURIComponent(targetBucket)}/${encodeStoragePath(path)}`,
      {
        method: "POST",
        headers: {
          apikey: testAnonKey,
          authorization: `Bearer ${accessToken}`,
          "content-type": "image/jpeg",
          "x-upsert": "false",
        },
        body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      },
    ),
  );
}

async function listedObjectPaths(targetBucket: string, prefix: string): Promise<string[]> {
  const rows = await storage<Array<{ name: string }>>("object/list/" + encodeURIComponent(targetBucket), {
    method: "POST",
    body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
  });
  return rows.map((row) => row.name);
}

async function createFixture(hasObject: boolean, targetBucket = retentionBucket): Promise<Fixture> {
  const user = await createUser();
  const suffix = randomUUID();
  // Use the production folder shapes for owner-scoped policies. Reads below
  // always use a different authenticated user, so these objects remain
  // rejected/private even in buckets with an owner read policy.
  const path = targetBucket === "avatars"
    ? `${user.id}/rejected-${suffix}.jpg`
    : `${user.id}/${suffix}/rejected.jpg`;
  const fixture: Fixture = {
    userId: user.id,
    mediaId: "",
    bucket: targetBucket,
    path,
    moderationCaseId: "",
  };
  fixtures.push(fixture);
  if (hasObject) {
    if (targetBucket === "proof-submissions") {
      await uploadObjectAsUser(targetBucket, path, user);
    } else {
      await uploadObject(targetBucket, path);
    }
  }

  const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const media = await rest<Array<{ id: string }>>("media_assets?select=id", {
    method: "POST",
    headers: { ...headers, prefer: "return=representation" },
    body: JSON.stringify({
      owner_user_id: user.id,
      bucket: targetBucket,
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

async function accessTokenFor(user: TestUser): Promise<string> {
  const response = await readJson<{ access_token?: string }>(await fetch(
    `${apiUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: testAnonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: user.email, password: user.password }),
    },
  ));
  if (!response.access_token) throw new Error("Supabase Auth did not return a fixture access token.");
  return response.access_token;
}

async function assertStorageReadDenied(
  fixture: Fixture,
  authorization: string,
  clientLabel: string,
): Promise<void> {
  const response = await fetch(
    `${apiUrl}/storage/v1/object/${encodeURIComponent(fixture.bucket)}/${encodeStoragePath(fixture.path)}`,
    {
      headers: {
        apikey: testAnonKey,
        authorization,
      },
    },
  );
  await response.arrayBuffer();
  assert.equal(
    response.ok,
    false,
    `${clientLabel} unexpectedly read rejected ${fixture.bucket}/${fixture.path} (HTTP ${response.status}).`,
  );
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${clientLabel} received a server error instead of an access denial for ${fixture.bucket}/${fixture.path} (HTTP ${response.status}).`,
  );
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
  await fetch(`${apiUrl}/storage/v1/object/${encodeURIComponent(fixture.bucket)}`, {
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
  for (const user of users) {
    const response = await fetch(`${apiUrl}/auth/v1/admin/users/${user.id}`, {
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
    await createBucket("avatars");
    await createBucket("quest-media");
    await createBucket("hunt-media");
    await createBucket("custom-game-media");
    await createBucket("proof-submissions");
    store = new SupabaseNotificationStore();
    await createUser();
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
      const response = await fetch(`${apiUrl}/storage/v1/bucket/${encodeURIComponent(retentionBucket)}`, {
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
    assert.deepEqual(await listedObjectPaths(fixture.bucket, fixturePrefix(fixture)), ["rejected.jpg"]);

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
    assert.deepEqual(await listedObjectPaths(fixture.bucket, fixturePrefix(fixture)), []);

    const media = await queryMedia(fixture);
    assert.equal(media.deleted_at !== null, true);
    assert.equal(media.moderation_status, "rejected");
    assert.equal(media.visibility, "private");
    const cleanup = await queryCleanup(fixture);
    assert.equal(cleanup.status, "completed");
    assert.equal(cleanup.storage_delete_outcome, "deleted");
    assert.equal(cleanup.failure_classification, null);
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
    assert.equal(cleanup.failure_classification, null);
    assert.equal((await queryMedia(fixture)).moderation_status, "rejected");
  });

  it("keeps a transient Storage error retryable, then deletes on retry", async () => {
    const fixture = await createFixture(true);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (String(input).includes(`/storage/v1/object/${retentionBucket}`) && body.includes(fixture.path)) {
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
    assert.equal(retryable.failure_classification, "retryable");
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
    assert.deepEqual(await listedObjectPaths(fixture.bucket, fixturePrefix(fixture)), []);
    const completed = await queryCleanup(fixture);
    assert.equal(completed.status, "completed");
    assert.equal(completed.attempt_count, 2);
    assert.equal(completed.storage_delete_outcome, "deleted");
    assert.equal(completed.failure_classification, null);
  });

  it("persists reference drift as a blocked classification", async () => {
    const fixture = await createFixture(false);
    await rest<void>("media_retention_cleanups", {
      method: "POST",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify({
        media_id: fixture.mediaId,
        bucket: fixture.bucket,
        storage_path: fixture.path,
        status: "failed",
        attempt_count: 1,
        next_attempt_at: new Date(Date.now() - 1_000).toISOString(),
        failure_classification: "retryable",
        last_error: "previous transient failure",
      }),
    });
    await rest<void>(`media_assets?id=eq.${fixture.mediaId}`, {
      method: "PATCH",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify({
        storage_path: `${fixture.path}.changed`,
        updated_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const result = await store.runMaintenance(30);
    assert.deepEqual(result.moderation_media, {
      candidates: 1,
      claimed: 0,
      deleted: 0,
      missing: 0,
      failed: 0,
      skipped: 1,
      errors: [],
    });
    const blocked = await queryCleanup(fixture);
    assert.equal(blocked.status, "failed");
    assert.equal(blocked.failure_classification, "blocked_reference");
    assert.equal(blocked.next_attempt_at, null);
    assert.equal(blocked.last_error, "Media Storage reference changed; manual review required.");
  });

  it("denies rejected private media to anonymous and ordinary clients while trusted cleanup removes it", async () => {
    const viewer = users[0];
    if (!viewer) throw new Error("The ordinary authenticated fixture user was not created.");
    const viewerToken = await accessTokenFor(viewer);
    const accessFixtures: Fixture[] = [];
    for (const targetBucket of canonicalBuckets) {
      accessFixtures.push(await createFixture(true, targetBucket));
    }

    for (const fixture of accessFixtures) {
      await assertStorageReadDenied(
        fixture,
        `Bearer ${testAnonKey}`,
        "Anonymous client",
      );
      await assertStorageReadDenied(
        fixture,
        `Bearer ${viewerToken}`,
        "Ordinary authenticated client",
      );
    }

    const result = await store.runMaintenance(30);
    assert.deepEqual(result.moderation_media, {
      candidates: accessFixtures.length,
      claimed: accessFixtures.length,
      deleted: accessFixtures.length,
      missing: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    });
    for (const fixture of accessFixtures) {
      assert.deepEqual(await listedObjectPaths(fixture.bucket, fixturePrefix(fixture)), []);
      const media = await queryMedia(fixture);
      assert.equal(media.deleted_at !== null, true);
      assert.equal(media.moderation_status, "rejected");
      assert.equal(media.visibility, "private");
    }
  });
});