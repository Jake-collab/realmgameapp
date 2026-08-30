/**
 * Live Social RPC integration coverage.
 *
 * Unlike socialRoundTrip.test.ts, this suite does not replace Supabase with a
 * test double. It creates disposable users, signs in through the mobile
 * Supabase client, and calls the production repository RPC wrappers.
 *
 * Run with SOCIAL_TEST_* variables (see docs/SOCIAL_TESTING.md). The suite is
 * skipped when those variables are not present so the normal unit-test command
 * remains useful in disconnected development environments. The missing-session
 * suite needs only live public credentials; it deliberately does not require a
 * service-role key because it must run wherever the mobile client can connect.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SocialRepository = typeof import('../features/social/repositories/social.repository');

type TestUser = {
  id: string;
  email: string;
  password: string;
  username: string;
};

const testUrl = process.env.SOCIAL_TEST_SUPABASE_URL ?? '';
const testAnonKey = process.env.SOCIAL_TEST_SUPABASE_ANON_KEY ?? '';
const testServiceRoleKey = process.env.SOCIAL_TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
const integrationConfigured = Boolean(testUrl && testAnonKey && testServiceRoleKey);
const describeIntegration = integrationConfigured ? describe : describe.skip;
const liveMobileUrl = testUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const liveMobileAnonKey = testAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const liveMobileConfigured = Boolean(liveMobileUrl && liveMobileAnonKey);
const describeLiveMobile = liveMobileConfigured ? describe : describe.skip;

let social: SocialRepository;
let mobileClient: SupabaseClient;
let adminClient: SupabaseClient;
let viewer: TestUser;
let target: TestUser;

async function createTestUser(
  role: 'viewer' | 'target',
  suffix: string,
): Promise<TestUser> {
  const email = `social-rpc-${role}-${suffix}@example.com`;
  const password = `SocialRpc-${suffix}-Password!`;
  // Keep the fixture handle below profiles.username's 20-character limit.
  const username = `rpc_${role === 'viewer' ? 'a' : 'b'}_${suffix.slice(-8)}`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Social RPC ${role}` },
  });
  if (error || !data.user) {
    throw error ?? new Error(`Could not create ${role} integration user`);
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ username, display_name: `Social RPC ${role}` })
    .eq('id', data.user.id);
  if (profileError) throw profileError;

  return { id: data.user.id, email, password, username };
}

async function signInAs(user: TestUser): Promise<void> {
  const { error } = await mobileClient.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
}

describeIntegration('Social RPC contracts', () => {
  beforeAll(async () => {
    // The repository's production client reads EXPO_PUBLIC_* at module load.
    // Keep the test-only names explicit while still exercising that client.
    process.env.EXPO_PUBLIC_SUPABASE_URL = testUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = testAnonKey;
    social = jest.requireActual('../features/social/repositories/social.repository') as SocialRepository;

    const { requireSupabase } = jest.requireActual('../lib/supabase/client') as typeof import('../lib/supabase/client');
    mobileClient = requireSupabase();
    adminClient = createClient(testUrl, testServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    viewer = await createTestUser('viewer', suffix);
    target = await createTestUser('target', suffix);
  }, 30_000);

  afterAll(async () => {
    await mobileClient?.auth.signOut();
    if (target?.id) {
      const { error } = await adminClient.auth.admin.deleteUser(target.id);
      if (error) throw error;
    }
    if (viewer?.id) {
      const { error } = await adminClient.auth.admin.deleteUser(viewer.id);
      if (error) throw error;
    }
  }, 30_000);

  test('friend requests, acceptance, search, blocking, and privacy survive fresh reads', async () => {
    await signInAs(viewer);

    const privacy = await social.fetchSocialPrivacySettings();
    expect(privacy).toMatchObject({
      userId: viewer.id,
      profileVisibility: 'public',
      allowFriendRequests: true,
      discoverableByUsername: true,
    });

    const initialSearch = await social.searchPublicUsers(target.username);
    expect(initialSearch).toEqual([
      expect.objectContaining({
        publicUserRef: target.username,
        username: target.username,
        relationshipState: 'none',
      }),
    ]);

    const sentResult = await social.sendFriendRequest(target.username, 'search');
    expect(sentResult).toMatchObject({
      ok: true,
      code: 'sent',
      state: 'outgoing_request',
    });
    expect(sentResult.requestId).toEqual(expect.any(String));

    // The active-pair rule is a partial unique index. A repeated send should
    // return the existing request instead of raising a database conflict.
    await expect(social.sendFriendRequest(target.username, 'search')).resolves.toEqual({
      ok: true,
      code: 'request_exists',
      requestId: sentResult.requestId,
      state: 'outgoing_request',
    });

    const sentRequests = await social.fetchSentFriendRequests();
    expect(sentRequests).toEqual([
      expect.objectContaining({
        requestId: sentResult.requestId,
        publicUserRef: target.username,
        username: target.username,
      }),
    ]);

    // Switch identities and read the request from the recipient's session.
    await signInAs(target);
    const receivedRequests = await social.fetchReceivedFriendRequests();
    expect(receivedRequests).toEqual([
      expect.objectContaining({
        requestId: sentResult.requestId,
        publicUserRef: viewer.username,
        username: viewer.username,
      }),
    ]);

    const acceptedResult = await social.acceptFriendRequest(sentResult.requestId!);
    expect(acceptedResult).toEqual({ ok: true, code: 'accepted' });
    await expect(social.fetchFriends()).resolves.toEqual([
      expect.objectContaining({
        publicUserRef: viewer.username,
        username: viewer.username,
      }),
    ]);

    // A new request is now represented as a friendship for the requester too.
    await signInAs(viewer);
    await expect(social.fetchSentFriendRequests()).resolves.toEqual([]);
    await expect(social.fetchFriends()).resolves.toEqual([
      expect.objectContaining({
        publicUserRef: target.username,
        username: target.username,
      }),
    ]);
    await expect(social.searchPublicUsers(target.username)).resolves.toEqual([
      expect.objectContaining({
        username: target.username,
        relationshipState: 'friends',
      }),
    ]);

    const blockResult = await social.blockUser(target.username);
    expect(blockResult).toEqual({ ok: true, code: 'blocked' });

    // Blocking removes the friendship server-side and persists independently
    // of the in-memory client/session state.
    await expect(social.fetchBlockedUsers()).resolves.toEqual([
      expect.objectContaining({
        publicUserRef: target.username,
        username: target.username,
      }),
    ]);
    await expect(social.fetchFriends()).resolves.toEqual([]);
    await expect(social.fetchSocialRelationship(target.username)).resolves.toEqual({
      state: 'blocked_by_me',
    });
    await expect(social.searchPublicUsers(target.username)).resolves.toEqual([]);

    await signInAs(target);
    await expect(social.fetchSocialPrivacySettings()).resolves.toMatchObject({
      userId: target.id,
      profileVisibility: 'public',
      allowFriendRequests: true,
    });
    // A blocked user is excluded from public search in the other direction.
    await expect(social.searchPublicUsers(viewer.username)).resolves.toEqual([]);
  });
});

describeLiveMobile('Social RPC missing-session boundary', () => {
  let unauthenticatedSocial: SocialRepository;
  let unauthenticatedMobileClient: SupabaseClient;

  beforeAll(async () => {
    // This suite must exercise the production repository, not a privileged
    // client. It has no fixture setup and therefore remains runnable without
    // service-role credentials.
    process.env.EXPO_PUBLIC_SUPABASE_URL = liveMobileUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = liveMobileAnonKey;
    unauthenticatedSocial = jest.requireActual('../features/social/repositories/social.repository') as SocialRepository;
    const { requireSupabase } = jest.requireActual('../lib/supabase/client') as typeof import('../lib/supabase/client');
    unauthenticatedMobileClient = requireSupabase();
    const { error } = await unauthenticatedMobileClient.auth.signOut();
    if (error) throw error;
  });

  afterAll(async () => {
    await unauthenticatedMobileClient?.auth.signOut();
  });

  test('does not return account-scoped reads or permit social writes without a session', async () => {
    const protectedReads = [
      () => unauthenticatedSocial.fetchFriends(),
      () => unauthenticatedSocial.fetchReceivedFriendRequests(),
      () => unauthenticatedSocial.fetchSentFriendRequests(),
      () => unauthenticatedSocial.fetchBlockedUsers(),
      () => unauthenticatedSocial.fetchSocialPrivacySettings(),
    ];
    const writes = [
      () => unauthenticatedSocial.sendFriendRequest('missing-session-target'),
      () => unauthenticatedSocial.acceptFriendRequest('00000000-0000-0000-0000-000000000000'),
      () => unauthenticatedSocial.declineFriendRequest('00000000-0000-0000-0000-000000000000'),
      () => unauthenticatedSocial.cancelFriendRequest('00000000-0000-0000-0000-000000000000'),
      () => unauthenticatedSocial.removeFriend('missing-session-target'),
      () => unauthenticatedSocial.blockUser('missing-session-target'),
      () => unauthenticatedSocial.unblockUser('missing-session-target'),
      () => unauthenticatedSocial.updateSocialPrivacySettings({ profileVisibility: 'private' }),
    ];

    for (const read of protectedReads) {
      await expect(read()).rejects.toBeTruthy();
    }
    for (const write of writes) {
      await expect(write()).rejects.toBeTruthy();
    }
  });
});
