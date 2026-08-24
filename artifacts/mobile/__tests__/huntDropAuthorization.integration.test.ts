/**
 * Direct-RPC authorization regression coverage for Hunt Drop collection.
 *
 * This suite intentionally calls the SECURITY DEFINER RPC directly rather
 * than going through UI search zones. Rejected and unavailable Drops must
 * never issue a collection session, even for an authenticated participant.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type TestUser = {
  id: string;
  email: string;
  password: string;
};

const testUrl = process.env.HUNT_DROP_TEST_SUPABASE_URL
  ?? process.env.SOCIAL_TEST_SUPABASE_URL
  ?? '';
const testAnonKey = process.env.HUNT_DROP_TEST_SUPABASE_ANON_KEY
  ?? process.env.SOCIAL_TEST_SUPABASE_ANON_KEY
  ?? '';
const testServiceRoleKey = process.env.HUNT_DROP_TEST_SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.SOCIAL_TEST_SUPABASE_SERVICE_ROLE_KEY
  ?? '';
const integrationConfigured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = integrationConfigured ? describe : describe.skip;

let adminClient: SupabaseClient<any>;
let playerClient: SupabaseClient<any>;
let player: TestUser;
let huntId: string;
let participationId: string;
let rejectedStopId: string;
let futureStopId: string;

describeIntegration('Hunt Drop collection authorization', () => {
  beforeAll(async () => {
    adminClient = createClient(testUrl, testServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    playerClient = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const email = `hunt-drop-rpc-${suffix}@example.com`;
    const password = `HuntDrop-${suffix}-Password!`;
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Hunt Drop RPC Test' },
    });
    if (createError || !created.user) {
      throw createError ?? new Error('Could not create Hunt Drop integration user');
    }
    player = { id: created.user.id, email, password };

    const { error: signInError } = await playerClient.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const slug = `hunt-drop-rpc-${suffix.slice(-10)}`;
    const { data: hunt, error: huntError } = await adminClient
      .from('hunts')
      .insert({
        slug,
        title: 'Hunt Drop RPC Test',
        summary: 'Disposable authorization fixture',
        description: 'Disposable authorization fixture for direct RPC tests.',
        hunt_type: 'community',
        status: 'active',
        privacy: 'public',
        join_policy: 'open',
        points_reward: 50,
      })
      .select('id')
      .single();
    if (huntError || !hunt) throw huntError ?? new Error('Could not create Hunt fixture');
    huntId = hunt.id;

    const { data: participation, error: participationError } = await adminClient
      .from('hunt_participants')
      .insert({ hunt_id: huntId, user_id: player.id, status: 'active' })
      .select('id')
      .single();
    if (participationError || !participation) {
      throw participationError ?? new Error('Could not create participant fixture');
    }
    participationId = participation.id;

    const { data: stops, error: stopError } = await adminClient
      .from('hunt_stops')
      .insert([
        {
          hunt_id: huntId,
          title: 'Rejected Drop',
          placement_status: 'REJECT',
          final_hunt_points: 50,
        },
        {
          hunt_id: huntId,
          title: 'Future Drop',
          placement_status: 'PASS',
          final_hunt_points: 50,
          drop_available_from: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      ])
      .select('id, title');
    if (stopError || !stops) throw stopError ?? new Error('Could not create Drop fixtures');
    rejectedStopId = stops.find(stop => stop.title === 'Rejected Drop')!.id;
    futureStopId = stops.find(stop => stop.title === 'Future Drop')!.id;
  }, 30_000);

  afterAll(async () => {
    await playerClient?.auth.signOut();
    if (huntId) {
      const { error } = await adminClient.from('hunts').delete().eq('id', huntId);
      if (error) throw error;
    }
    if (player?.id) {
      const { error } = await adminClient.auth.admin.deleteUser(player.id);
      if (error) throw error;
    }
  }, 30_000);

  test.each([
    ['a rejected Drop', () => rejectedStopId],
    ['a Drop before its availability window', () => futureStopId],
  ])('refuses to issue a collection session for %s', async (_label, getStopId) => {
    const { data, error } = await playerClient.rpc('issue_hunt_drop_collection_session', {
      p_participation_id: participationId,
      p_stop_id: getStopId(),
      p_latitude: 40.7128,
      p_longitude: -74.006,
      p_accuracy_meters: 5,
    });

    expect(error).toBeNull();
    expect(data).toEqual(
      expect.objectContaining({
        success: false,
        reasonCode: 'DROP_UNAVAILABLE',
      }),
    );

    const { data: sessions, error: sessionError } = await adminClient
      .from('hunt_drop_collection_sessions')
      .select('id')
      .eq('hunt_participant_id', participationId)
      .eq('hunt_stop_id', getStopId());
    expect(sessionError).toBeNull();
    expect(sessions).toEqual([]);
  });
});
