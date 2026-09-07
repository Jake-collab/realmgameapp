/**
 * Hunt map security wrapper contracts.
 *
 * Runs only from the disposable Supabase harness. The tests intentionally use
 * an empty database contract: malformed requests and cross-user context must
 * return no rows without reaching the legacy RPC with attacker-controlled
 * identity.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type TestUser = { id: string; email: string; password: string };

const testUrl = process.env.QUEST_TEST_SUPABASE_URL ?? '';
const testAnonKey = process.env.QUEST_TEST_SUPABASE_ANON_KEY ?? '';
const testServiceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
const configured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = configured ? describe : describe.skip;

let admin: SupabaseClient;
let client: SupabaseClient;
let owner: TestUser;
let other: TestUser;

async function createUser(label: string): Promise<TestUser> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `hunt-map-${label}-${suffix}@example.com`;
  const password = `HuntMap-${suffix}-Password!`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error || !result.data.user) {
    throw result.error ?? new Error(`Could not create ${label} test user.`);
  }
  return { id: result.data.user.id, email, password };
}

async function signIn(user: TestUser): Promise<void> {
  const result = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (result.error || !result.data.session) {
    throw result.error ?? new Error('Could not sign in Hunt map test user.');
  }
}

describeIntegration('Hunt map security wrapper contracts', () => {
  beforeAll(async () => {
    admin = createClient(testUrl, testServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    client = createClient(testUrl, testAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    owner = await createUser('owner');
    other = await createUser('other');
    await signIn(owner);
  }, 30_000);

  afterAll(async () => {
    await client?.auth.signOut();
    if (owner?.id) await admin.auth.admin.deleteUser(owner.id);
    if (other?.id) await admin.auth.admin.deleteUser(other.id);
  }, 30_000);

  test('rejects a caller-supplied UUID that differs from auth.uid()', async () => {
    const result = await client.rpc('get_hunt_map_viewport_secure', {
      p_west: -74.1,
      p_south: 40.6,
      p_east: -73.8,
      p_north: 40.9,
      p_user_id: other.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test('rejects oversized viewports and incomplete nearby coordinates', async () => {
    const oversized = await client.rpc('get_hunt_map_viewport_secure', {
      p_west: -180,
      p_south: -90,
      p_east: 180,
      p_north: 90,
      p_user_id: owner.id,
    });
    expect(oversized.error).toBeNull();
    expect(oversized.data).toEqual([]);

    const incomplete = await client.rpc('get_nearby_hunts_secure', {
      p_lat: 40.7,
      p_lng: null,
      p_user_id: owner.id,
    });
    expect(incomplete.error).toBeNull();
    expect(incomplete.data).toEqual([]);
  });
});