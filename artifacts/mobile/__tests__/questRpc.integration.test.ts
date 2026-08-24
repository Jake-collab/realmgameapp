/**
 * Live Quest RPC and RLS integration coverage.
 *
 * This suite uses disposable users against an isolated Supabase project. It
 * is intentionally skipped unless all QUEST_TEST_* variables are configured,
 * keeping the normal unit suite safe for disconnected development.
 *
 * Required variables:
 * QUEST_TEST_SUPABASE_URL
 * QUEST_TEST_SUPABASE_ANON_KEY
 * QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY
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
let questId: string;
let otherQuestId: string;
let objectiveId: string;
let otherObjectiveId: string;
let participationId: string;
let abandonParticipationId: string;
let expireParticipationId: string;
let proofParticipationId: string;
let completeQuest: typeof import('../features/quests/services/questCompletion.service')['completeQuest'];
let abandonQuest: typeof import('../features/quests/services/questAbandonment.service')['abandonQuest'];
let expireParticipation: typeof import('../features/quests/services/questAbandonment.service')['expireParticipation'];
let createQuestProofDraft: typeof import('../features/quests/services/questProof.service')['createQuestProofDraft'];
let submitQuestProof: typeof import('../features/quests/services/questProof.service')['submitQuestProof'];

async function createUser(label: string, suffix: string): Promise<TestUser> {
  const email = `quest-rpc-${label}-${suffix}@example.com`;
  const password = `QuestRpc-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: `Quest ${label}` },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${label}`);
  return { id: data.user.id, email, password };
}

async function insertFixtureRows(): Promise<void> {
  const now = new Date().toISOString();
  const quest = {
    slug: `rpc-quest-${Date.now()}`,
    title: 'RPC Quest Fixture',
    summary: 'A fixture quest for live RPC verification.',
    description: 'A fixture quest for live RPC and RLS verification.',
    quest_type: 'daily',
    status: 'published',
    difficulty: 'easy',
    estimated_duration_minutes: 10,
    points_reward: 37,
    proof_type: 'none',
    location_requirement_type: 'none',
    available_from: new Date(Date.now() - 60_000).toISOString(),
    available_until: new Date(Date.now() + 3_600_000).toISOString(),
    published_at: now,
    created_by: owner.id,
    completion_mode: 'auto',
  };
  const secondQuest = { ...quest, slug: `${quest.slug}-other`, title: 'Other RPC Quest' };
  const quests = await admin.from('quests').insert([quest, secondQuest]).select('id, slug');
  if (quests.error || !quests.data || quests.data.length !== 2) throw quests.error ?? new Error('Quest fixture failed');
  questId = quests.data.find((row) => row.slug === quest.slug)!.id;
  otherQuestId = quests.data.find((row) => row.slug === secondQuest.slug)!.id;

  const objectives = await admin.from('quest_objectives').insert([
    { quest_id: questId, sort_order: 1, title: 'Complete fixture step', instructions: 'Complete the fixture step.', proof_type: 'none', completion_rule: 'manual' },
    { quest_id: otherQuestId, sort_order: 1, title: 'Other fixture step', instructions: 'Complete the other fixture step.', proof_type: 'none', completion_rule: 'manual' },
  ]).select('id, quest_id');
  if (objectives.error || !objectives.data || objectives.data.length !== 2) throw objectives.error ?? new Error('Objective fixture failed');
  objectiveId = objectives.data.find((row) => row.quest_id === questId)!.id;
  otherObjectiveId = objectives.data.find((row) => row.quest_id === otherQuestId)!.id;

  const participations = await admin.from('quest_participations').insert([
    { quest_id: questId, user_id: owner.id, status: 'in_progress', reward_snapshot_points: 91 },
    { quest_id: questId, user_id: owner.id, status: 'started', reward_snapshot_points: 37 },
    { quest_id: questId, user_id: owner.id, status: 'started', reward_snapshot_points: 37 },
    { quest_id: questId, user_id: owner.id, status: 'started', reward_snapshot_points: 37 },
  ]).select('id, status');
  if (participations.error || !participations.data || participations.data.length !== 4) throw participations.error ?? new Error('Participation fixture failed');
  [participationId, abandonParticipationId, expireParticipationId, proofParticipationId] =
    participations.data.map((row) => row.id);
}

async function signIn(user: TestUser): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
}

async function expectRpcError(promise: PromiseLike<{ error: unknown }>): Promise<void> {
  const result = await promise;
  expect(result.error).toBeTruthy();
}

describeIntegration('Quest live RPC and RLS contracts', () => {
  beforeAll(async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = testUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = testAnonKey;
    admin = createClient(testUrl, testServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    client = createClient(testUrl, testAnonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    ({ completeQuest } = await import('../features/quests/services/questCompletion.service'));
    ({ abandonQuest, expireParticipation } = await import('../features/quests/services/questAbandonment.service'));
    ({ createQuestProofDraft, submitQuestProof } = await import('../features/quests/services/questProof.service'));
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    owner = await createUser('owner', suffix);
    other = await createUser('other', suffix);
    await insertFixtureRows();
  }, 30_000);

  afterAll(async () => {
    await client?.auth.signOut();
    if (questId) await admin.from('quests').delete().eq('id', questId);
    if (otherQuestId) await admin.from('quests').delete().eq('id', otherQuestId);
    if (owner?.id) await admin.auth.admin.deleteUser(owner.id);
    if (other?.id) await admin.auth.admin.deleteUser(other.id);
  }, 30_000);

  test('completes with the reward snapshot and is idempotent', async () => {
    await signIn(owner);
    const key = `quest_completion:${participationId}`;
    const first = await completeQuest({ participationId, userId: owner.id });
    expect(first).toMatchObject({
      success: true, awardedPoints: 91, wasAlreadyCompleted: false,
    });

    const second = await client.rpc('complete_quest', {
      p_participation_id: participationId, p_user_id: owner.id, p_idempotency_key: key,
    });
    expect(second.error).toBeNull();
    expect(second.data).toMatchObject({ awarded_points: 91, was_already_completed: true });

    const ledger = await admin.from('points_ledger').select('id, amount').eq('quest_participation_id', participationId);
    expect(ledger.error).toBeNull();
    expect(ledger.data).toHaveLength(1);
    expect(ledger.data?.[0].amount).toBe(91);
  });

  test('rejects cross-user RPC and direct participation/step writes', async () => {
    await signIn(other);
    await expectRpcError(client.rpc('complete_quest', {
      p_participation_id: participationId, p_user_id: other.id, p_idempotency_key: `quest_completion:tampered:${participationId}`,
    }));
    const directUpdate = await client.from('quest_participations')
      .update({ status: 'completed', awarded_points: 999 }).eq('id', participationId);
    expect(directUpdate.error).toBeTruthy();

    await signIn(owner);
    const wrongObjective = await client.from('quest_step_progress').insert({
      participation_id: abandonParticipationId, quest_step_id: otherObjectiveId, status: 'completed',
    });
    expect(wrongObjective.error).toBeTruthy();
    expect(wrongObjective.error?.message).toMatch(/Objective does not belong|row-level security|policy/i);
  });

  test('persists step progress, abandonment, expiration, and proof transitions', async () => {
    await signIn(owner);
    const progress = await client.from('quest_step_progress').insert({
      participation_id: abandonParticipationId, quest_step_id: objectiveId, status: 'completed',
    }).select().single();
    expect(progress.error).toBeNull();

    const abandoned = await abandonQuest({
      participationId: abandonParticipationId, userId: owner.id,
    });
    expect(abandoned).toMatchObject({
      success: true, participation: { status: 'abandoned', id: abandonParticipationId },
    });

    const expired = await expireParticipation({
      participationId: expireParticipationId, userId: owner.id, questId,
    });
    expect(expired).toMatchObject({ success: true, participation: { status: 'expired' } });

    const draft = await createQuestProofDraft({
      participationId: proofParticipationId, userId: owner.id,
      submissionType: 'text', textResponse: 'A live proof draft.',
    });
    expect(draft).toMatchObject({ success: true, proof: { status: 'draft' } });
    const submitted = await submitQuestProof(draft.proof!.id, owner.id, proofParticipationId);
    expect(submitted).toMatchObject({ success: true, proof: { status: 'submitted' } });
    const immutable = await client.from('proof_submissions')
      .update({ text_response: 'tampered after submit' }).eq('id', draft.proof!.id);
    expect(immutable.error).toBeTruthy();
  });
});