/**
 * Migration 079 privilege and wrapper contracts.
 *
 * This suite runs only in the disposable Supabase harness. The advanced Hunt
 * helpers are SECURITY DEFINER implementation details: clients must not call
 * them directly, while the authorized creator and participant wrappers must
 * still be able to call them internally.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type TestUser = { id: string; email: string; password: string };

const testUrl = process.env.QUEST_TEST_SUPABASE_URL ?? '';
const testAnonKey = process.env.QUEST_TEST_SUPABASE_ANON_KEY ?? '';
const testServiceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
const configured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = configured ? describe : describe.skip;

let admin: SupabaseClient;
let anonymousClient: SupabaseClient;
let authenticatedClient: SupabaseClient;
let owner: TestUser;
let huntId: string;
let participationId: string;

function makeClient(key: string): SupabaseClient {
  return createClient(testUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createUser(): Promise<TestUser> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `hunt-advanced-${suffix}@example.com`;
  const password = `HuntAdvanced-${suffix}-Password!`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Advanced Hunt Test' },
  });
  if (result.error || !result.data.user) {
    throw result.error ?? new Error('Could not create the advanced Hunt test user.');
  }
  return { id: result.data.user.id, email, password };
}

async function signIn(): Promise<void> {
  const result = await authenticatedClient.auth.signInWithPassword({
    email: owner.email,
    password: owner.password,
  });
  if (result.error || !result.data.session) {
    throw result.error ?? new Error('Could not sign in the advanced Hunt test user.');
  }
}

const internalHelperCalls = (participationIdForCall: string, huntIdForCall: string) => [
  [
    'assert_hunt_dependency_graph_acyclic',
    { p_hunt_id: huntIdForCall },
  ],
  [
    'validate_advanced_hunt_config',
    { p_hunt_id: huntIdForCall },
  ],
  [
    'apply_advanced_hunt_config',
    {
      p_hunt_id: huntIdForCall,
      p_payload: { defaultRevealMode: 'ALWAYS_VISIBLE', zones: [], stops: [] },
    },
  ],
  [
    'replace_creator_hunt_stops',
    { p_hunt_id: huntIdForCall, p_stops: [], p_ordering: 'ordered' },
  ],
  [
    'refresh_hunt_reveals',
    { p_participation_id: participationIdForCall },
  ],
] as const;

async function expectInternalHelperRejected(
  client: SupabaseClient,
  participationIdForCall: string,
  huntIdForCall: string,
): Promise<void> {
  for (const [functionName, args] of internalHelperCalls(
    participationIdForCall,
    huntIdForCall,
  )) {
    const result = await client.rpc(functionName, args);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  }
}

describeIntegration('Advanced Hunt helper privilege contracts', () => {
  beforeAll(async () => {
    admin = makeClient(testServiceRoleKey);
    anonymousClient = makeClient(testAnonKey);
    authenticatedClient = makeClient(testAnonKey);
    owner = await createUser();
    await signIn();

    const hunt = await admin
      .from('hunts')
      .insert({
        slug: `advanced-helper-${owner.id}`,
        title: 'Advanced Helper Privilege Test',
        summary: 'A disposable Hunt for helper privilege verification.',
        description: 'A disposable Hunt for helper privilege verification.',
        hunt_type: 'custom',
        status: 'draft',
        creator_user_id: owner.id,
        privacy: 'public',
        join_policy: 'open',
        points_reward: 100,
        estimated_duration_minutes: 10,
        advanced_config: {
          defaultRevealMode: 'ALWAYS_VISIBLE',
          defaultRevealRadiusMeters: 250,
          fogOfWarEnabled: true,
          persistentExploration: true,
          trailEnabled: false,
        },
      })
      .select('id')
      .single();
    if (hunt.error || !hunt.data) {
      throw hunt.error ?? new Error('Could not create the advanced Hunt fixture.');
    }
    huntId = hunt.data.id;

    const zone = await admin.from('hunt_zones').insert({
      hunt_id: huntId,
      zone_key: 'zone-alpha',
      name: 'Alpha',
      sort_order: 0,
      is_required: true,
      prerequisite_zone_keys: [],
      public_center_lat: 40.7128,
      public_center_lng: -74.006,
      public_radius_meters: 500,
    });
    if (zone.error) throw zone.error;

    const createdStop = await admin
      .from('hunt_stops')
      .insert({
        hunt_id: huntId,
        sort_order: 0,
        title: 'Start stop',
        description: 'A disposable start stop.',
        is_ordered: true,
        is_required: true,
        is_hidden: false,
        stop_role: 'start',
        completion_method: 'location_check',
        proof_required: false,
        server_reveal_state: 'public',
        creator_key: 'start-stop',
        zone_key: 'zone-alpha',
        reveal_mode: 'ALWAYS_VISIBLE',
        reveal_radius_meters: 250,
      })
      .select('id')
      .single();
    if (createdStop.error || !createdStop.data) {
      throw createdStop.error ?? new Error('Could not create the advanced Hunt stop fixture.');
    }

    const stop = await admin
      .from('hunt_stops')
      .select('id')
      .eq('hunt_id', huntId)
      .single();
    if (stop.error || !stop.data) {
      throw stop.error ?? new Error('Could not load the advanced Hunt stop fixture.');
    }

    const geofence = await admin.from('hunt_stop_geofences').insert({
      hunt_stop_id: stop.data.id,
      public_lat: 40.7128,
      public_lng: -74.006,
      public_radius_meters: 500,
      validation_radius_meters: 30,
      is_validation_zone: true,
    });
    if (geofence.error) throw geofence.error;

    const participation = await admin
      .from('hunt_participants')
      .insert({
        hunt_id: huntId,
        user_id: owner.id,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (participation.error || !participation.data) {
      throw participation.error ?? new Error('Could not create the participation fixture.');
    }
    participationId = participation.data.id;

    const progress = await admin.from('hunt_stop_progress').insert({
      hunt_participant_id: participationId,
      hunt_stop_id: stop.data.id,
      status: 'not_started',
    });
    if (progress.error) throw progress.error;
  }, 30_000);

  afterAll(async () => {
    await authenticatedClient?.auth.signOut();
    if (participationId) {
      const result = await admin
        .from('hunt_participants')
        .delete()
        .eq('id', participationId);
      if (result.error) throw result.error;
    }
    if (huntId) {
      const result = await admin.from('hunts').delete().eq('id', huntId);
      if (result.error) throw result.error;
    }
    if (owner?.id) {
      const result = await admin.auth.admin.deleteUser(owner.id);
      if (result.error) throw result.error;
    }
  }, 30_000);

  test('blocks anonymous and authenticated direct access to internal helpers', async () => {
    await expectInternalHelperRejected(anonymousClient, participationId, huntId);
    await expectInternalHelperRejected(
      authenticatedClient,
      participationId,
      huntId,
    );
  });

  test('keeps authorized creator and participant wrappers functional', async () => {
    const locations = await authenticatedClient.rpc(
      'get_active_hunt_stop_locations',
      { p_participation_id: participationId },
    );

    expect(locations.error).toBeNull();
    expect(locations.data).toEqual([
      expect.objectContaining({
        public_lat: 40.7128,
        public_lng: -74.006,
        progress_status: 'available',
      }),
    ]);
  });
});