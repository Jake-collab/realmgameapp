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

    const draft = await authenticatedClient.rpc('create_hunt_draft', {
      p_payload: {
        title: 'Advanced Helper Privilege Test',
        summary: 'A disposable Hunt for helper privilege verification.',
        description: 'A disposable Hunt for helper privilege verification.',
        pointsReward: 100,
        estimatedDurationMinutes: 10,
        privacy: 'public',
        stopOrdering: 'ordered',
        participationMode: 'solo',
        startModel: 'individual',
        defaultRevealMode: 'ALWAYS_VISIBLE',
        defaultRevealRadiusMeters: 250,
        fogOfWarEnabled: true,
        persistentExploration: true,
        trailEnabled: false,
        zones: [
          {
            key: 'zone-alpha',
            name: 'Alpha',
            sortOrder: 0,
            required: true,
            prerequisiteZoneKeys: [],
            publicCenterLat: 40.7128,
            publicCenterLng: -74.006,
            publicRadiusMeters: 500,
          },
        ],
        stops: [
          {
            id: 'start-stop',
            title: 'Start stop',
            description: 'A disposable start stop.',
            clueText: 'Find the marked place.',
            hintText: '',
            completionMethod: 'none',
            isRequired: true,
            publicLat: 40.7128,
            publicLng: -74.006,
            publicRadius: 500,
            validationRadius: 30,
            revealMode: 'ALWAYS_VISIBLE',
            revealRadiusMeters: 250,
            zoneKey: 'zone-alpha',
            prerequisiteStopIds: [],
          },
        ],
      },
    });
    if (draft.error || !draft.data?.id) {
      throw draft.error ?? new Error('Could not create the advanced Hunt draft fixture.');
    }
    huntId = draft.data.id;

    const stop = await admin
      .from('hunt_stops')
      .select('id')
      .eq('hunt_id', huntId)
      .single();
    if (stop.error || !stop.data) {
      throw stop.error ?? new Error('Could not load the advanced Hunt stop fixture.');
    }

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