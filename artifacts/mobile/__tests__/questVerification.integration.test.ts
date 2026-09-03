/**
 * Live method-driven Quest verification coverage.
 *
 * This suite runs only from scripts/quest-database-check.sh, which provisions
 * a disposable Supabase project with the complete checked-in migration history.
 * All player actions use the anon key and an authenticated session; the service
 * role is used only to create isolated fixtures and model trusted moderation
 * or server-side validation outcomes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestUser = {
  id: string;
  email: string;
  password: string;
};

type QuestFixture = {
  questId: string;
  participationId: string;
};

const testUrl = process.env.QUEST_TEST_SUPABASE_URL ?? "";
const testAnonKey = process.env.QUEST_TEST_SUPABASE_ANON_KEY ?? "";
const testServiceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";
const configured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = configured ? describe : describe.skip;

let admin: SupabaseClient;
let client: SupabaseClient;
let owner: TestUser;
let other: TestUser;
const fixtures: QuestFixture[] = [];
const proofSubmissionIds: string[] = [];
const mediaIds: string[] = [];

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

async function createUser(label: string): Promise<TestUser> {
  const suffix = uniqueSuffix();
  const email = `quest-verification-${label}-${suffix}@example.com`;
  const password = `QuestVerification-${suffix}-Password!`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Quest Verification ${label}` },
  });
  if (result.error || !result.data.user) {
    throw result.error ?? new Error(`Could not create ${label} fixture user.`);
  }
  return { id: result.data.user.id, email, password };
}

async function createQuest(
  methods: string[],
  requiredDurationMinutes?: number,
): Promise<QuestFixture> {
  const suffix = uniqueSuffix();
  const quest = await admin
    .from("quests")
    .insert({
      slug: `verification-${suffix}`,
      title: `Verification Quest ${suffix}`,
      summary: "A live verification contract fixture.",
      description: "A disposable database fixture for method-driven Quest verification.",
      quest_type: "daily",
      status: "published",
      difficulty: "easy",
      estimated_duration_minutes: requiredDurationMinutes ?? 10,
      points_reward: 100,
      proof_type: "none",
      location_requirement_type: "none",
      available_from: new Date(Date.now() - 60_000).toISOString(),
      available_until: new Date(Date.now() + 3_600_000).toISOString(),
      published_at: new Date().toISOString(),
      created_by: owner.id,
      completion_mode: "auto",
      verification_methods: methods,
      ...(requiredDurationMinutes === undefined
        ? {}
        : { required_duration_minutes: requiredDurationMinutes }),
    })
    .select("id")
    .single();
  if (quest.error || !quest.data) {
    throw quest.error ?? new Error("Could not create Quest fixture.");
  }

  const participation = await admin
    .from("quest_participations")
    .insert({
      quest_id: quest.data.id,
      user_id: owner.id,
      status: "started",
      reward_snapshot_points: 100,
    })
    .select("id")
    .single();
  if (participation.error || !participation.data) {
    throw participation.error ?? new Error("Could not create participation fixture.");
  }

  const fixture = {
    questId: quest.data.id,
    participationId: participation.data.id,
  };
  fixtures.push(fixture);
  return fixture;
}

async function addCompletionGeometry(questId: string): Promise<void> {
  const geometry = await admin.from("quest_geo_validation_geometry").insert({
    quest_id: questId,
    validation_type: "completion",
    center_lat: 40,
    center_lng: -74,
    radius_meters: 100,
    required_accuracy_meters: 50,
    max_location_age_seconds: 45,
  });
  if (geometry.error) throw geometry.error;
}

async function signIn(user: TestUser): Promise<void> {
  await client.auth.signOut();
  const result = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (result.error || !result.data.session) {
    throw result.error ?? new Error("The fixture user did not receive a session.");
  }
}

async function expectRpcFailure(
  operation: PromiseLike<{ error: { message?: string } | null }>,
  message?: RegExp,
): Promise<void> {
  const result = await operation;
  expect(result.error).toBeTruthy();
  if (message) expect(result.error?.message).toMatch(message);
}

async function createCameraProof(
  participationId: string,
  attachMedia: boolean,
): Promise<{ proofId: string; mediaId: string }> {
  const suffix = uniqueSuffix();
  const session = await client.rpc("issue_quest_proof_verification_session", {
    p_participation_id: participationId,
    p_user_id: owner.id,
    p_evidence_kind: "photo",
  });
  if (session.error || !session.data) {
    throw session.error ?? new Error("Could not create camera verification session.");
  }

  const media = await admin
    .from("media_assets")
    .insert({
      owner_user_id: owner.id,
      bucket: "proof-submissions",
      storage_path: `${owner.id}/quest-verification/${suffix}.jpg`,
      media_type: "image",
      mime_type: "image/jpeg",
      file_size: 4,
      purpose: "proof",
      visibility: "private",
      moderation_status: "pending",
    })
    .select("id")
    .single();
  if (media.error || !media.data) {
    throw media.error ?? new Error("Could not create camera media fixture.");
  }
  mediaIds.push(media.data.id);

  const proof = await admin
    .from("proof_submissions")
    .insert({
      user_id: owner.id,
      quest_participation_id: participationId,
      submission_type: "photo",
      status: "submitted",
      moderation_status: "pending",
      submitted_at: new Date().toISOString(),
      verification_session_id: session.data,
    })
    .select("id")
    .single();
  if (proof.error || !proof.data) {
    throw proof.error ?? new Error("Could not create camera proof fixture.");
  }
  proofSubmissionIds.push(proof.data.id);

  if (attachMedia) {
    const relation = await admin.from("proof_media").insert({
      submission_id: proof.data.id,
      media_id: media.data.id,
    });
    if (relation.error) throw relation.error;
  }

  return { proofId: proof.data.id, mediaId: media.data.id };
}

async function cleanupFixtures(): Promise<void> {
  if (!admin) return;

  if (proofSubmissionIds.length > 0) {
    await admin.from("proof_media").delete().in("submission_id", proofSubmissionIds);
    await admin.from("proof_submissions").delete().in("id", proofSubmissionIds);
  }
  if (mediaIds.length > 0) {
    await admin.from("media_assets").delete().in("id", mediaIds);
  }

  for (const fixture of fixtures) {
    await admin
      .from("quest_geo_validation_geometry")
      .delete()
      .eq("quest_id", fixture.questId);
    await admin
      .from("quest_participations")
      .delete()
      .eq("id", fixture.participationId);
    await admin.from("quests").delete().eq("id", fixture.questId);
  }
}

describeIntegration("Quest method verification against disposable Supabase", () => {
  beforeAll(async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = testUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = testAnonKey;
    admin = createClient(testUrl, testServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    client = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    owner = await createUser("owner");
    other = await createUser("other");
  }, 30_000);

  afterAll(async () => {
    await client?.auth.signOut();
    await cleanupFixtures();
    for (const user of [owner, other]) {
      if (!user?.id) continue;
      try {
        await admin.auth.admin.deleteUser(user.id);
      } catch (error) {
        // Completed fixtures retain immutable ledger rows. The disposable
        // project teardown removes those rows after the assertions finish.
        console.warn("Could not remove disposable Quest fixture user.", error);
      }
    }
  }, 30_000);

  test("does not let one user start or confirm another user's participation", async () => {
    const fixture = await createQuest(["timer", "integrity_confirmation"], 1);
    await signIn(other);

    await expectRpcFailure(
      client.rpc("start_quest_verification_timer", {
        p_participation_id: fixture.participationId,
        p_user_id: other.id,
      }),
      /not found|unauthorized|identity mismatch/i,
    );
    await expectRpcFailure(
      client.rpc("start_quest_verification_timer", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
      }),
      /identity mismatch/i,
    );
    await expectRpcFailure(
      client.rpc("confirm_quest_integrity", {
        p_participation_id: fixture.participationId,
        p_user_id: other.id,
      }),
      /not found|unauthorized|identity mismatch/i,
    );
    await expectRpcFailure(
      client.rpc("confirm_quest_integrity", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
      }),
      /identity mismatch/i,
    );
  });

  test("uses server time for timers and rejects client timestamp tampering", async () => {
    const fixture = await createQuest(["timer", "integrity_confirmation"], 1);
    await signIn(owner);

    const started = await client.rpc("start_quest_verification_timer", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
    });
    expect(started.error).toBeNull();
    expect(started.data).toMatchObject({
      participation_id: fixture.participationId,
    });

    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `early:${fixture.participationId}`,
      }),
      /timer requirement has not elapsed/i,
    );
    await expectRpcFailure(
      client.rpc("confirm_quest_integrity", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
      }),
      /timer requirement has not elapsed/i,
    );

    const tampered = await client
      .from("quest_participations")
      .update({
        verification_started_at: new Date(0).toISOString(),
        verification_earliest_completion_at: new Date(0).toISOString(),
        integrity_confirmed_at: new Date(0).toISOString(),
      })
      .eq("id", fixture.participationId)
      .select("id")
      .single();
    expect(tampered.error).toBeTruthy();

    // Move the server-owned deadline only through the trusted fixture client
    // so this test need not sleep for the configured one-minute duration.
    const advanced = await admin
      .from("quest_participations")
      .update({
        verification_earliest_completion_at: new Date(Date.now() - 1_000).toISOString(),
      })
      .eq("id", fixture.participationId);
    expect(advanced.error).toBeNull();

    const confirmed = await client.rpc("confirm_quest_integrity", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
    });
    expect(confirmed.error).toBeNull();

    const first = await client.rpc("complete_quest", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
      p_idempotency_key: `timer-completion:${fixture.participationId}`,
    });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({
      awarded_points: 100,
      was_already_completed: false,
    });

    const replay = await client.rpc("complete_quest", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
      p_idempotency_key: `timer-completion:${fixture.participationId}`,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toMatchObject({
      awarded_points: 100,
      was_already_completed: true,
    });

    const ledger = await admin
      .from("points_ledger")
      .select("id, amount")
      .eq("quest_participation_id", fixture.participationId);
    expect(ledger.error).toBeNull();
    expect(ledger.data).toHaveLength(1);
    expect(ledger.data?.[0].amount).toBe(100);
  });

  test("fails camera and GPS closed, then requires every composite method", async () => {
    const fixture = await createQuest(["camera", "gps", "integrity_confirmation"]);
    await addCompletionGeometry(fixture.questId);
    await signIn(owner);

    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `composite-before-integrity:${fixture.participationId}`,
      }),
      /integrity confirmation is required/i,
    );

    const confirmed = await client.rpc("confirm_quest_integrity", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
    });
    expect(confirmed.error).toBeNull();

    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `composite-before-camera:${fixture.participationId}`,
      }),
      /approved camera proof is required/i,
    );

    const approvedWithoutMedia = await createCameraProof(
      fixture.participationId,
      false,
    );
    const approved = await admin
      .from("proof_submissions")
      .update({
        status: "approved",
        moderation_status: "approved",
        moderation_review_required: false,
      })
      .eq("id", approvedWithoutMedia.proofId);
    expect(approved.error).toBeNull();

    const pendingWithMedia = await createCameraProof(
      fixture.participationId,
      true,
    );
    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `composite-unapproved-camera:${fixture.participationId}`,
      }),
      /approved camera proof is required/i,
    );

    const approvedAttachedProof = await admin
      .from("proof_submissions")
      .update({
        status: "approved",
        moderation_status: "approved",
        moderation_review_required: false,
      })
      .eq("id", pendingWithMedia.proofId);
    expect(approvedAttachedProof.error).toBeNull();

    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `composite-before-gps:${fixture.participationId}`,
      }),
      /validated GPS proof is required/i,
    );

    const outside = await client.rpc("validate_geo_quest_location", {
      p_participation_id: fixture.participationId,
      p_latitude: 41,
      p_longitude: -74,
      p_horizontal_accuracy_meters: 10,
      p_captured_at: new Date().toISOString(),
      p_request_id: `outside:${fixture.participationId}`,
      p_validation_type: "completion",
      p_app_version: "quest-verification-test",
    });
    expect(outside.error).toBeNull();
    expect(outside.data).toMatchObject({ result: "outside_region" });

    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `composite-outside-gps:${fixture.participationId}`,
      }),
      /validated GPS proof is required/i,
    );

    const validated = await client.rpc("validate_geo_quest_location", {
      p_participation_id: fixture.participationId,
      p_latitude: 40,
      p_longitude: -74,
      p_horizontal_accuracy_meters: 10,
      p_captured_at: new Date().toISOString(),
      p_request_id: `validated:${fixture.participationId}`,
      p_validation_type: "completion",
      p_app_version: "quest-verification-test",
    });
    expect(validated.error).toBeNull();
    expect(validated.data).toMatchObject({ result: "validated" });

    const completed = await client.rpc("complete_quest", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
      p_idempotency_key: `composite-completion:${fixture.participationId}`,
    });
    expect(completed.error).toBeNull();
    expect(completed.data).toMatchObject({
      awarded_points: 100,
      was_already_completed: false,
    });
  });

  test("integrity-only Quests complete without creating irrelevant media rows", async () => {
    const fixture = await createQuest(["integrity_confirmation"]);
    await signIn(owner);

    await expectRpcFailure(
      client.rpc("complete_quest", {
        p_participation_id: fixture.participationId,
        p_user_id: owner.id,
        p_idempotency_key: `integrity-before-confirmation:${fixture.participationId}`,
      }),
      /integrity confirmation is required/i,
    );

    const confirmed = await client.rpc("confirm_quest_integrity", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
    });
    expect(confirmed.error).toBeNull();

    const completed = await client.rpc("complete_quest", {
      p_participation_id: fixture.participationId,
      p_user_id: owner.id,
      p_idempotency_key: `integrity-completion:${fixture.participationId}`,
    });
    expect(completed.error).toBeNull();

    const proofs = await admin
      .from("proof_submissions")
      .select("id")
      .eq("quest_participation_id", fixture.participationId);
    expect(proofs.error).toBeNull();
    expect(proofs.data).toHaveLength(0);

    const media = await admin
      .from("proof_media")
      .select("id, proof_submissions!inner(quest_participation_id)")
      .eq(
        "proof_submissions.quest_participation_id",
        fixture.participationId,
      );
    expect(media.error).toBeNull();
    expect(media.data).toHaveLength(0);
  });
});