/**
 * Live moderator cleanup RPC coverage.
 *
 * The disposable database harness applies every checked-in migration before
 * this suite runs. The suite is skipped outside that harness so ordinary
 * mobile tests never need a Supabase connection.
 */

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestUser = {
  id: string;
  email: string;
  password: string;
};

type Fixture = {
  mediaId: string;
  storagePath: string;
};

type CleanupRow = {
  status: string;
  failure_classification: string | null;
  bucket: string;
  storage_path: string;
  operator_resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
};

type AuditRow = {
  action: string;
  actor_user_id: string;
  actor_role: string;
  entity_id: string;
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

const testUrl = process.env.QUEST_TEST_SUPABASE_URL ?? "";
const testAnonKey = process.env.QUEST_TEST_SUPABASE_ANON_KEY ?? "";
const testServiceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";
const configured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = configured ? describe : describe.skip;

const bucket = "moderation-quarantine";
const api = testUrl.replace(/\/$/, "");

let admin: SupabaseClient;
let anonymous: SupabaseClient;
let authenticated: SupabaseClient;
let moderator: TestUser;
const fixtures: Fixture[] = [];

function canonicalFingerprint(storagePath: string): string {
  return createHash("md5").update(`${bucket}|${storagePath}`).digest("hex");
}

async function createUser(): Promise<TestUser> {
  const suffix = cryptoRandomSuffix();
  const email = `moderation-retention-${suffix}@example.com`;
  const password = `ModerationRetention-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Retention Moderator" },
  });
  if (error || !data.user) {
    throw error ?? new Error("Supabase Auth did not return a fixture user.");
  }
  return { id: data.user.id, email, password };
}

function cryptoRandomSuffix(): string {
  return Math.random().toString(36).slice(2, 12);
}

async function createBlockedFixture(): Promise<Fixture> {
  const storagePath = `${moderator.id}/${cryptoRandomSuffix()}/rejected.jpg`;
  const media = await admin
    .from("media_assets")
    .insert({
      owner_user_id: moderator.id,
      bucket,
      storage_path: storagePath,
      media_type: "image",
      mime_type: "image/jpeg",
      file_size: 4,
      purpose: "moderation_retention_contract",
      visibility: "private",
      moderation_status: "rejected",
      moderation_reason: "live operator-action contract fixture",
    })
    .select("id")
    .single();
  if (media.error || !media.data) {
    throw media.error ?? new Error("Could not create media fixture.");
  }

  const cleanup = await admin.from("media_retention_cleanups").insert({
    media_id: media.data.id,
    bucket: "quest-media",
    storage_path: `${moderator.id}/stale/rejected.jpg`,
    status: "failed",
    attempt_count: 2,
    failure_classification: "blocked_reference",
    last_error: "Media Storage reference changed; manual review required.",
  });
  if (cleanup.error) throw cleanup.error;

  const fixture = { mediaId: media.data.id, storagePath };
  fixtures.push(fixture);
  return fixture;
}

async function signIn(): Promise<void> {
  const { data, error } = await authenticated.auth.signInWithPassword({
    email: moderator.email,
    password: moderator.password,
  });
  if (error || !data.session) {
    throw error ?? new Error("The moderator fixture did not receive a session.");
  }
}

async function expectRejected(
  client: SupabaseClient,
  label: string,
): Promise<void> {
  const result = await client.rpc("moderate_media_retention_cleanup", {
    p_media_id: fixtures[0]?.mediaId,
    p_action: "requeue",
    p_reference_fingerprint: "0".repeat(32),
    p_actor_id: moderator.id,
    p_actor_role: "moderator",
    p_reason: `${label} must not be able to call this RPC`,
  });
  expect(result.error).toBeTruthy();
}

async function queryCleanup(mediaId: string): Promise<CleanupRow> {
  const result = await admin
    .from("media_retention_cleanups")
    .select(
      "status, failure_classification, bucket, storage_path, operator_resolution, resolved_by, resolved_at",
    )
    .eq("media_id", mediaId)
    .single();
  if (result.error || !result.data) {
    throw result.error ?? new Error("Cleanup fixture was not persisted.");
  }
  return result.data as CleanupRow;
}

async function queryAudit(
  mediaId: string,
  action: string,
): Promise<AuditRow[]> {
  const result = await admin
    .from("audit_logs")
    .select(
      "action, actor_user_id, actor_role, entity_id, before_snapshot, after_snapshot, metadata",
    )
    .eq("entity_id", mediaId)
    .eq("action", action);
  if (result.error) throw result.error;
  return (result.data ?? []) as AuditRow[];
}

async function deleteFixtures(): Promise<void> {
  for (const fixture of fixtures) {
    const cleanup = await admin
      .from("media_retention_cleanups")
      .delete()
      .eq("media_id", fixture.mediaId);
    if (cleanup.error) throw cleanup.error;

    const media = await admin
      .from("media_assets")
      .delete()
      .eq("id", fixture.mediaId);
    if (media.error) throw media.error;
  }
}

async function deleteModerator(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await admin.auth.admin.deleteUser(moderator.id);
      if (!result.error) return;
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError ?? new Error("Could not remove the moderator fixture.");
}

describeIntegration("moderation media retention operator actions", () => {
  beforeAll(async () => {
    admin = createClient(testUrl, testServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anonymous = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    authenticated = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    moderator = await createUser();

    const role = await admin
      .from("profiles")
      .update({ role: "moderator" })
      .eq("id", moderator.id);
    if (role.error) throw role.error;
  }, 30_000);

  afterAll(async () => {
    await authenticated?.auth.signOut();
    await deleteFixtures();
    if (moderator?.id) {
      try {
        await deleteModerator();
      } catch (error) {
        // The database harness destroys the complete disposable project after
        // the suite. Do not turn a transient GoTrue teardown fetch failure
        // into a false-negative after the database assertions have passed.
        console.warn("Could not remove the disposable moderator user.", error);
      }
    }
  }, 30_000);

  test("rejects anonymous, authenticated, and non-service-role callers", async () => {
    const fixture = await createBlockedFixture();
    await expectRejected(anonymous, "anonymous");

    await signIn();
    await expectRejected(authenticated, "authenticated");

    const fingerprint = canonicalFingerprint(fixture.storagePath);
    const trusted = await admin.rpc("moderate_media_retention_cleanup", {
      p_media_id: fixture.mediaId,
      p_action: "requeue",
      p_reference_fingerprint: fingerprint,
      p_actor_id: moderator.id,
      p_actor_role: "moderator",
      p_reason: "Confirm the canonical reference before retrying cleanup.",
    });
    expect(trusted.error).toBeNull();
    expect(trusted.data).toMatchObject({
      status: "completed",
      action: "requeue",
      media_id: fixture.mediaId,
    });
  });

  test("requires the canonical fingerprint and records a redacted requeue audit", async () => {
    const fixture = await createBlockedFixture();
    const fingerprint = canonicalFingerprint(fixture.storagePath);
    const wrongFingerprint = canonicalFingerprint(`${fixture.storagePath}-changed`);

    const mismatch = await admin.rpc("moderate_media_retention_cleanup", {
      p_media_id: fixture.mediaId,
      p_action: "requeue",
      p_reference_fingerprint: wrongFingerprint,
      p_actor_id: moderator.id,
      p_actor_role: "moderator",
      p_reason: "This stale fingerprint must not change cleanup state.",
    });
    expect(mismatch.error).toBeNull();
    expect(mismatch.data).toEqual({ status: "reference_mismatch" });
    expect(await queryAudit(fixture.mediaId, "moderation_media_retention_requeued")).toHaveLength(0);

    const reason = `Retry ${bucket}/${fixture.storagePath} from https://storage.example/${fixture.storagePath}`;
    const requeued = await admin.rpc("moderate_media_retention_cleanup", {
      p_media_id: fixture.mediaId,
      p_action: "requeue",
      p_reference_fingerprint: fingerprint.toUpperCase(),
      p_actor_id: moderator.id,
      p_actor_role: "moderator",
      p_reason: reason,
    });
    expect(requeued.error).toBeNull();
    expect(requeued.data).toMatchObject({ status: "completed", action: "requeue" });

    const cleanup = await queryCleanup(fixture.mediaId);
    expect(cleanup).toMatchObject({
      status: "failed",
      failure_classification: "retryable",
      bucket,
      storage_path: fixture.storagePath,
      operator_resolution: null,
      resolved_by: null,
      resolved_at: null,
    });
    const audits = await queryAudit(
      fixture.mediaId,
      "moderation_media_retention_requeued",
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actor_user_id: moderator.id,
      actor_role: "moderator",
      entity_id: fixture.mediaId,
      before_snapshot: {
        status: "failed",
        failure_classification: "blocked_reference",
        attempt_count: 2,
      },
      after_snapshot: {
        status: "failed",
        failure_classification: "retryable",
        action: "requeue",
      },
      metadata: {
        reference_fingerprint: fingerprint,
        service_role_cleanup_boundary: true,
      },
    });
    expect(audits[0]?.metadata.reason).not.toContain(fixture.storagePath);
    expect(audits[0]?.metadata.reason).not.toContain("https://");
    expect(audits[0]?.metadata.reason).toContain("[redacted storage reference]");
  });

  test("requires the canonical fingerprint and records a resolve audit", async () => {
    const fixture = await createBlockedFixture();
    const fingerprint = canonicalFingerprint(fixture.storagePath);

    const mismatch = await admin.rpc("moderate_media_retention_cleanup", {
      p_media_id: fixture.mediaId,
      p_action: "resolve",
      p_reference_fingerprint: "f".repeat(32),
      p_actor_id: moderator.id,
      p_actor_role: "moderator",
      p_reason: "The incorrect reference must not resolve this cleanup.",
    });
    expect(mismatch.error).toBeNull();
    expect(mismatch.data).toEqual({ status: "reference_mismatch" });

    const resolved = await admin.rpc("moderate_media_retention_cleanup", {
      p_media_id: fixture.mediaId,
      p_action: "resolve",
      p_reference_fingerprint: fingerprint,
      p_actor_id: moderator.id,
      p_actor_role: "moderator",
      p_reason: "Canonical reference verified; resolve the blocked cleanup.",
    });
    expect(resolved.error).toBeNull();
    expect(resolved.data).toMatchObject({ status: "completed", action: "resolve" });

    const cleanup = await queryCleanup(fixture.mediaId);
    expect(cleanup.status).toBe("resolved");
    expect(cleanup.failure_classification).toBeNull();
    expect(cleanup.operator_resolution).toBe("moderator_resolved");
    expect(cleanup.resolved_by).toBe(moderator.id);
    expect(cleanup.resolved_at).toEqual(expect.any(String));

    const audits = await queryAudit(
      fixture.mediaId,
      "moderation_media_retention_resolved",
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actor_user_id: moderator.id,
      actor_role: "moderator",
      entity_id: fixture.mediaId,
      before_snapshot: {
        status: "failed",
        failure_classification: "blocked_reference",
        attempt_count: 2,
      },
      after_snapshot: {
        status: "resolved",
        operator_resolution: "moderator_resolved",
        action: "resolve",
      },
      metadata: {
        reference_fingerprint: fingerprint,
        service_role_cleanup_boundary: true,
      },
    });
  });

  test("serializes concurrent requeue and resolve actions on the locked rows", async () => {
    const fixture = await createBlockedFixture();
    const fingerprint = canonicalFingerprint(fixture.storagePath);
    const [requeue, resolve] = await Promise.all([
      admin.rpc("moderate_media_retention_cleanup", {
        p_media_id: fixture.mediaId,
        p_action: "requeue",
        p_reference_fingerprint: fingerprint,
        p_actor_id: moderator.id,
        p_actor_role: "moderator",
        p_reason: "Concurrent requeue lock contract.",
      }),
      admin.rpc("moderate_media_retention_cleanup", {
        p_media_id: fixture.mediaId,
        p_action: "resolve",
        p_reference_fingerprint: fingerprint,
        p_actor_id: moderator.id,
        p_actor_role: "moderator",
        p_reason: "Concurrent resolve lock contract.",
      }),
    ]);

    expect(requeue.error).toBeNull();
    expect(resolve.error).toBeNull();
    const statuses = [requeue.data?.status, resolve.data?.status];
    expect(statuses.filter((status) => status === "completed")).toHaveLength(1);
    expect(statuses.filter((status) => status === "not_blocked")).toHaveLength(1);

    const cleanup = await queryCleanup(fixture.mediaId);
    expect(["failed", "resolved"]).toContain(cleanup.status);
    expect(cleanup.status === "failed"
      ? cleanup.failure_classification
      : cleanup.operator_resolution).toBeTruthy();
    const audits = await admin
      .from("audit_logs")
      .select("id")
      .eq("entity_id", fixture.mediaId)
      .in("action", [
        "moderation_media_retention_requeued",
        "moderation_media_retention_resolved",
      ]);
    expect(audits.error).toBeNull();
    expect(audits.data).toHaveLength(1);
  });
});