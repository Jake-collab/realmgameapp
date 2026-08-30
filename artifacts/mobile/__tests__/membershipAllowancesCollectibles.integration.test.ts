/**
 * Connected regression coverage for Task 88's revenue boundary.
 *
 * This suite deliberately uses a dedicated Supabase project. Player operations
 * use authenticated anon-key clients; the service role is limited to fixture
 * setup and provider-side events.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestUser = {
  id: string;
  email: string;
  password: string;
};

type DropFixture = {
  stopId: string;
  collectibleId: string;
  participationIds: [string, string];
};

const testUrl = process.env.TASK88_TEST_SUPABASE_URL ?? "";
const testAnonKey = process.env.TASK88_TEST_SUPABASE_ANON_KEY ?? "";
const testServiceRoleKey = process.env.TASK88_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";
const configured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = configured ? describe : describe.skip;

let admin: SupabaseClient<any>;
let sellerClient: SupabaseClient<any>;
let firstClient: SupabaseClient<any>;
let secondClient: SupabaseClient<any>;
let seller: TestUser;
let firstPlayer: TestUser;
let secondPlayer: TestUser;
let huntId = "";
const huntIds: string[] = [];
let finalFindDrop: DropFixture;
let paidDrop: DropFixture;
let winningOrderId = "";
let winningProviderEventId = "";
let paidStopSnapshot: any;
let paidHuntPointsSnapshot: any[] = [];
let paidQuestSnapshot: any[] = [];

const suffix = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

async function createUser(label: string): Promise<TestUser> {
  const unique = suffix();
  const email = `task88-${label}-${unique}@example.com`;
  const password = `Task88-${unique}-Password!`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: `Task 88 ${label}`,
      username: `t88_${unique}`.slice(0, 20),
    },
  });
  if (result.error || !result.data.user) {
    throw result.error ?? new Error(`Could not create the ${label} user.`);
  }
  return { id: result.data.user.id, email, password };
}

async function signIn(client: SupabaseClient<any>, user: TestUser): Promise<void> {
  const result = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (result.error || !result.data.session) {
    throw result.error ?? new Error(`Could not sign in ${user.email}.`);
  }
}

async function createDrop(
  title: string,
  findLimit: number | null,
  priceMinor: number,
  quantity: number,
): Promise<DropFixture> {
  const stop = await admin
    .from("hunt_stops")
    .insert({
      hunt_id: huntId,
      title,
      placement_status: "PASS",
      final_hunt_points: 37,
      base_hunt_points: 37,
    })
    .select("id")
    .single();
  if (stop.error || !stop.data) {
    throw stop.error ?? new Error(`Could not create ${title}.`);
  }

  const geofence = await admin.from("hunt_stop_geofences").insert({
    hunt_stop_id: stop.data.id,
    validation_point: "SRID=4326;POINT(-74.006 40.7128)",
    public_search_lat: 40.713,
    public_search_lng: -74.006,
    collection_radius_meters: 25,
  });
  if (geofence.error) throw geofence.error;

  const collectible = await admin
    .from("collectibles")
    .insert({
      hunt_stop_id: stop.data.id,
      creator_user_id: seller.id,
      name: `${title} collectible`,
      price_minor: priceMinor,
      currency: "USD",
      quantity,
      rarity: quantity === 1 ? "UNIQUE" : "LEGENDARY",
      sale_status: "active",
    })
    .select("id")
    .single();
  if (collectible.error || !collectible.data) {
    throw collectible.error ?? new Error(`Could not create the ${title} collectible.`);
  }

  const commerce = await admin.from("hunt_drop_commerce").insert({
    hunt_stop_id: stop.data.id,
    find_limit: findLimit,
    collectible_id: collectible.data.id,
  });
  if (commerce.error) throw commerce.error;

  const participantResults = await Promise.all(
    [firstPlayer, secondPlayer].map((player) =>
      admin
        .from("hunt_participants")
        .insert({ hunt_id: huntId, user_id: player.id, status: "active" })
        .select("id")
        .single(),
    ),
  );
  for (const result of participantResults) {
    if (result.error || !result.data) {
      throw result.error ?? new Error(`Could not create a participant for ${title}.`);
    }
  }
  const participationIds: [string, string] = [
    participantResults[0].data!.id,
    participantResults[1].data!.id,
  ];

  const progress = await admin.from("hunt_stop_progress").insert(
    participationIds.map((participationId) => ({
      hunt_participant_id: participationId,
      hunt_stop_id: stop.data!.id,
      status: "in_progress",
    })),
  );
  if (progress.error) throw progress.error;

  return {
    stopId: stop.data.id,
    collectibleId: collectible.data.id,
    participationIds,
  };
}

async function issueSession(
  client: SupabaseClient<any>,
  participationId: string,
  stopId: string,
): Promise<string> {
  const result = await client.rpc("issue_hunt_drop_collection_session", {
    p_participation_id: participationId,
    p_stop_id: stopId,
    p_latitude: 40.7128,
    p_longitude: -74.006,
    p_accuracy_meters: 5,
  });
  if (result.error || !result.data?.success || !result.data.sessionId) {
    throw result.error ?? new Error(`Could not issue a session for ${stopId}.`);
  }
  return result.data.sessionId;
}

async function collect(
  client: SupabaseClient<any>,
  sessionId: string,
): Promise<{ data: any; error: any }> {
  return client.rpc("collect_hunt_drop", {
    p_session_id: sessionId,
    p_latitude: 40.7128,
    p_longitude: -74.006,
    p_accuracy_meters: 5,
  });
}

async function cleanupFixtures(): Promise<void> {
  if (!admin) return;

  // Remove every mutable fixture that is not protected by the intentionally
  // immutable revenue/Hunt history triggers. A dedicated project's teardown
  // removes immutable audit evidence after this connected suite completes.
  await admin.from("hunt_stop_progress").delete().in(
    "hunt_participant_id",
    [
      ...(finalFindDrop?.participationIds ?? []),
      ...(paidDrop?.participationIds ?? []),
    ],
  );
  for (const disposableHuntId of huntIds) {
    await admin
      .from("hunt_drop_collection_sessions")
      .delete()
      .eq("hunt_id", disposableHuntId);
    await admin.from("hunt_participants").delete().eq("hunt_id", disposableHuntId);
    await admin.from("hunts").delete().eq("id", disposableHuntId);
  }

  for (const user of [firstPlayer, secondPlayer, seller]) {
    if (!user?.id) continue;
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error && !/foreign key|immutable_revenue_history/i.test(result.error.message)) {
      throw result.error;
    }
  }
}

describeIntegration("Task 88 membership, allowances, and collectibles", () => {
  beforeAll(async () => {
    admin = createClient(testUrl, testServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    sellerClient = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    firstClient = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    secondClient = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    seller = await createUser("seller");
    firstPlayer = await createUser("first");
    secondPlayer = await createUser("second");
    await Promise.all([
      signIn(sellerClient, seller),
      signIn(firstClient, firstPlayer),
      signIn(secondClient, secondPlayer),
    ]);

    const hunt = await admin
      .from("hunts")
      .insert({
        slug: `task88-${suffix()}`,
        title: "Task 88 connected fixture",
        summary: "Disposable Task 88 integration fixture.",
        description: "Exercises revenue behavior without replacing canonical Hunt tables.",
        hunt_type: "custom",
        status: "active",
        creator_user_id: seller.id,
        privacy: "private",
        join_policy: "open",
        points_reward: 100,
      })
      .select("id")
      .single();
    if (hunt.error || !hunt.data) {
      throw hunt.error ?? new Error("Could not create the Task 88 Hunt.");
    }
    huntId = hunt.data.id;
    huntIds.push(huntId);

    const sellerProfile = await admin.from("seller_profiles").upsert({
      user_id: seller.id,
      onboarding_status: "verified",
      provider_name: "task88-test",
      provider_account_id: `seller-${suffix()}`,
    });
    if (sellerProfile.error) throw sellerProfile.error;

    finalFindDrop = await createDrop("Final Find", 1, 0, 1);
  }, 30_000);

  afterAll(async () => {
    await Promise.allSettled([
      sellerClient?.auth.signOut(),
      firstClient?.auth.signOut(),
      secondClient?.auth.signOut(),
    ]);
    await cleanupFixtures();
  }, 30_000);

  test("an authenticated user cannot self-grant membership or credits", async () => {
    const entitlement = await firstClient.rpc("apply_membership_entitlement", {
      p_user_id: firstPlayer.id,
      p_plan_code: "worlds_monthly",
      p_status: "active",
      p_starts_at: new Date().toISOString(),
      p_ends_at: null,
      p_idempotency_key: `self-entitlement-${suffix()}`,
      p_provider_name: "forged",
      p_provider_entitlement_id: "forged",
    });
    expect(entitlement.error).toBeTruthy();

    const credits = await firstClient.rpc("grant_extra_drop_credits", {
      p_user_id: firstPlayer.id,
      p_quantity: 100,
      p_idempotency_key: `self-credit-${suffix()}`,
      p_provider_name: "forged",
      p_provider_event_id: "forged",
      p_reason: "forged",
    });
    expect(credits.error).toBeTruthy();

    const [membershipRows, creditRows] = await Promise.all([
      admin.from("membership_entitlements").select("id").eq("user_id", firstPlayer.id),
      admin.from("drop_credit_ledger").select("id").eq("user_id", firstPlayer.id),
    ]);
    expect(membershipRows.error).toBeNull();
    expect(membershipRows.data).toEqual([]);
    expect(creditRows.error).toBeNull();
    expect(creditRows.data).toEqual([]);
  });

  test("uses exact UTC allowance periods and consumes an idempotency key once", async () => {
    const summary = await firstClient.rpc("get_my_revenue_summary");
    expect(summary.error).toBeNull();

    const allowances = summary.data.allowances as Array<{
      kind: string;
      periodStart: string;
      periodEnd: string;
    }>;
    const weekly = allowances.find(
      (allowance) => allowance.kind === "hunt_drop_creation_weekly",
    )!;
    const monthly = allowances.find(
      (allowance) => allowance.kind === "quest_monthly",
    )!;
    const weeklyStart = new Date(weekly.periodStart);
    const weeklyEnd = new Date(weekly.periodEnd);
    const monthlyStart = new Date(monthly.periodStart);
    const monthlyEnd = new Date(monthly.periodEnd);
    expect(weeklyStart.getUTCDay()).toBe(1);
    expect(weeklyStart.getUTCHours()).toBe(0);
    expect(weeklyStart.getUTCMinutes()).toBe(0);
    expect(weeklyStart.getUTCSeconds()).toBe(0);
    expect(weeklyEnd.getTime() - weeklyStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(monthlyStart.getUTCDate()).toBe(1);
    expect(monthlyStart.getUTCHours()).toBe(0);
    expect(monthlyEnd.getUTCMonth()).toBe((monthlyStart.getUTCMonth() + 1) % 12);

    const key = `quest-monthly-${suffix()}`;
    const first = await firstClient.rpc("consume_quest_allowance", {
      p_kind: "quest_monthly",
      p_idempotency_key: key,
    });
    const replay = await firstClient.rpc("consume_quest_allowance", {
      p_kind: "quest_monthly",
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ success: true, alreadyConsumed: false });
    expect(replay.error).toBeNull();
    expect(replay.data).toMatchObject({ success: true, alreadyConsumed: true });

    const rows = await admin
      .from("revenue_allowance_consumptions")
      .select("id")
      .eq("user_id", firstPlayer.id)
      .eq("idempotency_key", key);
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(1);
  });

  test("consumes included weekly Drops before extra credits", async () => {
    const grantKey = `credit-grant-${suffix()}`;
    const grant = await admin.rpc("grant_extra_drop_credits", {
      p_user_id: firstPlayer.id,
      p_quantity: 1,
      p_idempotency_key: grantKey,
      p_provider_name: "task88-test",
      p_provider_event_id: `credit-event-${suffix()}`,
      p_reason: "Task 88 connected test",
    });
    expect(grant.error).toBeNull();

    const keys = [suffix(), suffix(), suffix()].map((key) => `drop-create-${key}`);
    const results = [];
    for (const key of keys) {
      results.push(
        await firstClient.rpc("consume_drop_creation_allowance", {
          p_idempotency_key: key,
        }),
      );
    }
    expect(results.map((result) => result.error)).toEqual([null, null, null]);
    expect(results.map((result) => result.data.source)).toEqual([
      "included_weekly",
      "included_weekly",
      "extra_credit",
    ]);

    const replay = await firstClient.rpc("consume_drop_creation_allowance", {
      p_idempotency_key: keys[2],
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toMatchObject({
      success: true,
      alreadyConsumed: true,
      source: "extra_credit",
    });

    const ledger = await admin
      .from("drop_credit_ledger")
      .select("quantity_delta, event_type")
      .eq("user_id", firstPlayer.id);
    expect(ledger.error).toBeNull();
    expect(ledger.data!.reduce((sum, row) => sum + row.quantity_delta, 0)).toBe(0);
    expect(ledger.data!.filter((row) => row.event_type === "consume")).toHaveLength(1);
  });

  test("serializes the final allowed find", async () => {
    const [firstSession, secondSession] = await Promise.all([
      issueSession(firstClient, finalFindDrop.participationIds[0], finalFindDrop.stopId),
      issueSession(secondClient, finalFindDrop.participationIds[1], finalFindDrop.stopId),
    ]);
    const results = await Promise.all([
      collect(firstClient, firstSession),
      collect(secondClient, secondSession),
    ]);
    const successful = results.filter(
      (result) => !result.error && result.data?.success === true,
    );
    const rejected = results.filter(
      (result) =>
        result.error ||
        result.data?.success === false,
    );
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [commerce, finds, points] = await Promise.all([
      admin
        .from("hunt_drop_commerce")
        .select("find_count")
        .eq("hunt_stop_id", finalFindDrop.stopId)
        .single(),
      admin.from("hunt_drop_finds").select("id").eq("hunt_stop_id", finalFindDrop.stopId),
      admin.from("hunt_point_ledger").select("id, amount").eq("hunt_stop_id", finalFindDrop.stopId),
    ]);
    expect(commerce.data?.find_count).toBe(1);
    expect(finds.data).toHaveLength(1);
    expect(points.data).toEqual([expect.objectContaining({ amount: 37 })]);
  });

  test("keeps a Find Badge separate from collectible ownership", async () => {
    // Reuse a second, independent Hunt because hunt_participants is unique by
    // Hunt/user. This also supplies both buyers with a badge for quantity races.
    const secondHunt = await admin
      .from("hunts")
      .insert({
        slug: `task88-paid-${suffix()}`,
        title: "Task 88 paid fixture",
        summary: "Disposable paid collectible fixture.",
        description: "A second canonical Hunt for paid collectible coverage.",
        hunt_type: "custom",
        status: "active",
        creator_user_id: seller.id,
        privacy: "private",
        join_policy: "open",
        points_reward: 100,
      })
      .select("id")
      .single();
    if (secondHunt.error || !secondHunt.data) {
      throw secondHunt.error ?? new Error("Could not create the paid Hunt.");
    }
    huntId = secondHunt.data.id;
    huntIds.push(huntId);
    paidDrop = await createDrop("Paid Quantity", null, 1000, 1);

    const sessions = await Promise.all([
      issueSession(firstClient, paidDrop.participationIds[0], paidDrop.stopId),
      issueSession(secondClient, paidDrop.participationIds[1], paidDrop.stopId),
    ]);
    const collections = await Promise.all([
      collect(firstClient, sessions[0]),
      collect(secondClient, sessions[1]),
    ]);
    expect(collections.every((result) => !result.error && result.data?.success)).toBe(true);

    const [badges, ownership, stop, huntPoints, questRows] = await Promise.all([
      admin
        .from("find_badges")
        .select("id, user_id")
        .eq("hunt_stop_id", paidDrop.stopId)
        .order("user_id"),
      admin
        .from("collectible_ownership")
        .select("id")
        .eq("collectible_id", paidDrop.collectibleId),
      admin
        .from("hunt_stops")
        .select("id, hunt_id, title, base_hunt_points, final_hunt_points, location_version")
        .eq("id", paidDrop.stopId)
        .single(),
      admin
        .from("hunt_point_ledger")
        .select("id, amount, event_type, state")
        .eq("hunt_stop_id", paidDrop.stopId)
        .order("id"),
      admin
        .from("quest_participations")
        .select("id, reward_snapshot_points, awarded_points")
        .in("user_id", [firstPlayer.id, secondPlayer.id])
        .order("id"),
    ]);
    expect(badges.error).toBeNull();
    expect(badges.data).toHaveLength(2);
    expect(ownership.error).toBeNull();
    expect(ownership.data).toEqual([]);
    expect(stop.error).toBeNull();
    expect(huntPoints.error).toBeNull();
    expect(questRows.error).toBeNull();
    paidStopSnapshot = stop.data;
    paidHuntPointsSnapshot = huntPoints.data ?? [];
    paidQuestSnapshot = questRows.data ?? [];
  });

  test("serializes final quantity, replays provider events, and caps cumulative refunds", async () => {
    const badges = await admin
      .from("find_badges")
      .select("id, user_id")
      .eq("hunt_stop_id", paidDrop.stopId);
    if (badges.error || !badges.data) throw badges.error;
    const firstBadge = badges.data.find((badge) => badge.user_id === firstPlayer.id)!;
    const secondBadge = badges.data.find((badge) => badge.user_id === secondPlayer.id)!;

    const intents = await Promise.all([
      firstClient.rpc("create_collectible_purchase_intent", {
        p_find_badge_id: firstBadge.id,
        p_idempotency_key: `intent-first-${suffix()}`,
      }),
      secondClient.rpc("create_collectible_purchase_intent", {
        p_find_badge_id: secondBadge.id,
        p_idempotency_key: `intent-second-${suffix()}`,
      }),
    ]);
    expect(intents.every((intent) => !intent.error && intent.data?.success)).toBe(true);

    const providerEvents = [`final-${suffix()}`, `final-${suffix()}`];
    const finalized = await Promise.all(
      intents.map((intent, index) =>
        admin.rpc("finalize_collectible_purchase", {
          p_order_id: intent.data.orderId,
          p_provider_name: "task88-test",
          p_provider_transaction_id: `transaction-${suffix()}`,
          p_provider_event_id: providerEvents[index],
        }),
      ),
    );
    const winnerIndex = finalized.findIndex(
      (result) => !result.error && result.data?.success === true,
    );
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(finalized.filter((result) => result.data?.success === true)).toHaveLength(1);
    expect(
      finalized.filter((result) => result.data?.reasonCode === "SOLD_OUT"),
    ).toHaveLength(1);
    winningOrderId = intents[winnerIndex].data.orderId;
    winningProviderEventId = providerEvents[winnerIndex];

    const replay = await admin.rpc("finalize_collectible_purchase", {
      p_order_id: winningOrderId,
      p_provider_name: "task88-test",
      p_provider_transaction_id: `ignored-on-replay-${suffix()}`,
      p_provider_event_id: winningProviderEventId,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toMatchObject({
      success: true,
      alreadyFinalized: true,
      orderId: winningOrderId,
    });

    const refundEvent = `refund-${suffix()}`;
    const firstRefund = await admin.rpc("reverse_collectible_purchase", {
      p_order_id: winningOrderId,
      p_event_type: "refund",
      p_provider_event_id: refundEvent,
      p_amount_minor: 400,
    });
    const refundReplay = await admin.rpc("reverse_collectible_purchase", {
      p_order_id: winningOrderId,
      p_event_type: "refund",
      p_provider_event_id: refundEvent,
      p_amount_minor: 400,
    });
    const secondRefund = await admin.rpc("reverse_collectible_purchase", {
      p_order_id: winningOrderId,
      p_event_type: "refund",
      p_provider_event_id: `refund-${suffix()}`,
      p_amount_minor: 500,
    });
    const excessiveRefund = await admin.rpc("reverse_collectible_purchase", {
      p_order_id: winningOrderId,
      p_event_type: "refund",
      p_provider_event_id: `refund-${suffix()}`,
      p_amount_minor: 101,
    });
    expect(firstRefund.error).toBeNull();
    expect(refundReplay.data).toMatchObject({ success: true, alreadyApplied: true });
    expect(secondRefund.error).toBeNull();
    expect(excessiveRefund.error?.message).toMatch(/invalid_reversal_amount/i);

    const events = await admin
      .from("marketplace_transaction_events")
      .select("event_type, amount_minor")
      .eq("order_id", winningOrderId)
      .in("event_type", ["refund", "partial_refund", "chargeback", "reversal"]);
    expect(events.error).toBeNull();
    expect(events.data!.reduce((sum, event) => sum + event.amount_minor, 0)).toBe(900);
  });

  test("revenue operations do not rewrite Quest/Hunt points or canonical hunt_stops", async () => {
    await firstClient.rpc("get_my_revenue_summary");
    const stopAfter = await admin
      .from("hunt_stops")
      .select("id, hunt_id, title, base_hunt_points, final_hunt_points, location_version")
      .eq("id", paidDrop.stopId)
      .single();
    const huntPointsAfter = await admin
      .from("hunt_point_ledger")
      .select("id, amount, event_type, state")
      .eq("hunt_stop_id", paidDrop.stopId)
      .order("id");
    const questAfter = await admin
      .from("quest_participations")
      .select("id, reward_snapshot_points, awarded_points")
      .in("user_id", [firstPlayer.id, secondPlayer.id])
      .order("id");

    expect(stopAfter.error).toBeNull();
    expect(stopAfter.data).toEqual(paidStopSnapshot);
    expect(huntPointsAfter.data).toEqual(paidHuntPointsSnapshot);
    expect(questAfter.data).toEqual(paidQuestSnapshot);
  });
});