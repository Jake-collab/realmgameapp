/**
 * Live activity verification coverage. This suite is skipped unless the
 * disposable Supabase harness provides its three QUEST_TEST_* variables.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.QUEST_TEST_SUPABASE_URL ?? '';
const anonKey = process.env.QUEST_TEST_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
const describeIntegration = url && anonKey && serviceRoleKey ? describe : describe.skip;

describeIntegration('Quest activity tracking RPC', () => {
  let admin: SupabaseClient;
  let client: SupabaseClient;
  let userId = '';
  let questId = '';
  let participationId = '';
  let abandonedParticipationId = '';

  beforeAll(async () => {
    admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const email = `quest-activity-${suffix}@example.com`;
    const password = `QuestActivity-${suffix}-Password!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('Could not create activity test user.');
    userId = created.data.user.id;

    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('Could not sign in activity test user.');

    const quest = await admin.from('quests').insert({
      slug: `activity-quest-${suffix}`,
      title: 'Activity tracking fixture',
      summary: 'A fixture for server-measured distance.',
      description: 'Walk a short, safe route while the server measures progress.',
      quest_type: 'daily',
      status: 'published',
      difficulty: 'easy',
      estimated_duration_minutes: 20,
      points_reward: 100,
      proof_type: 'none',
      location_requirement_type: 'none',
      verification_methods: ['activity_tracking'],
      required_distance_meters: 20,
      activity_type: 'walking',
      completion_mode: 'auto',
      published_at: new Date().toISOString(),
    }).select('id').single();
    if (quest.error || !quest.data) throw quest.error ?? new Error('Could not create activity quest.');
    questId = quest.data.id;

    const participations = await admin.from('quest_participations').insert([
      { quest_id: questId, user_id: userId, status: 'started', reward_snapshot_points: 100 },
      { quest_id: questId, user_id: userId, status: 'abandoned', reward_snapshot_points: 100 },
    ]).select('id, status');
    if (participations.error || !participations.data || participations.data.length !== 2) {
      throw participations.error ?? new Error('Could not create activity participations.');
    }
    participationId = participations.data.find((row) => row.status === 'started')!.id;
    abandonedParticipationId = participations.data.find((row) => row.status === 'abandoned')!.id;
  }, 30_000);

  afterAll(async () => {
    await client?.auth.signOut();
    if (questId) await admin.from('quests').delete().eq('id', questId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }, 30_000);

  async function sample(id: string, latitude: number, capturedAt: string) {
    return client.rpc('record_quest_activity_sample', {
      p_participation_id: participationId,
      p_user_id: userId,
      p_client_sample_id: id,
      p_latitude: latitude,
      p_longitude: 0,
      p_accuracy_meters: 5,
      p_captured_at: capturedAt,
    });
  }

  test('accepts sequential samples, rejects spoof-like samples, and is idempotent', async () => {
    const base = Date.now() + 1_000;
    const first = await sample('first', 0, new Date(base).toISOString());
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ accepted: true, was_duplicate: false, total_distance_meters: 0 });

    const second = await sample('second', 0.0001, new Date(base + 10_000).toISOString());
    expect(second.error).toBeNull();
    expect(second.data.accepted).toBe(true);
    expect(Number(second.data.total_distance_meters)).toBeGreaterThan(10);

    const duplicate = await sample('second', 0.0001, new Date(base + 10_000).toISOString());
    expect(duplicate.error).toBeNull();
    expect(duplicate.data).toMatchObject({ accepted: true, was_duplicate: true });

    const outOfOrder = await sample('out-of-order', 0.0002, new Date(base + 5_000).toISOString());
    expect(outOfOrder.error).toBeNull();
    expect(outOfOrder.data).toMatchObject({ accepted: false, rejection_code: 'out_of_order' });

    const unrealistic = await sample('unrealistic', 0.1, new Date(base + 11_000).toISOString());
    expect(unrealistic.error).toBeNull();
    expect(unrealistic.data).toMatchObject({ accepted: false, rejection_code: 'unrealistic_speed' });

    const third = await sample('third', 0.0002, new Date(base + 20_000).toISOString());
    expect(third.error).toBeNull();
    expect(third.data.accepted).toBe(true);
  }, 30_000);

  test('does not record after abandonment and completion remains atomic', async () => {
    const abandoned = await client.rpc('record_quest_activity_sample', {
      p_participation_id: abandonedParticipationId,
      p_user_id: userId,
      p_client_sample_id: 'abandoned',
      p_latitude: 0,
      p_longitude: 0,
      p_accuracy_meters: 5,
      p_captured_at: new Date(Date.now() + 1_000).toISOString(),
    });
    expect(abandoned.error).toBeNull();
    expect(abandoned.data).toMatchObject({ accepted: false, rejection_code: 'participation_not_active' });

    const completion = await client.rpc('complete_quest', {
      p_participation_id: participationId,
      p_user_id: userId,
      p_idempotency_key: `quest_completion:${participationId}`,
    });
    expect(completion.error).toBeNull();
    expect(completion.data).toMatchObject({ awarded_points: 100, was_already_completed: false });

    const retry = await client.rpc('complete_quest', {
      p_participation_id: participationId,
      p_user_id: userId,
      p_idempotency_key: `quest_completion:${participationId}`,
    });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ awarded_points: 100, was_already_completed: true });
  }, 30_000);
});