// Jest globals are provided by the Expo test runtime; the app tsconfig does
// not include Jest types because production code is typechecked separately.
// @ts-nocheck

import {
  completeQuest,
} from '@/features/quests/services/questCompletion.service';
import {
  abandonQuest,
  expireParticipation,
} from '@/features/quests/services/questAbandonment.service';
import {
  createQuestProofDraft,
  submitQuestProof,
  updateQuestProofDraft,
} from '@/features/quests/services/questProof.service';
import {
  beginStep,
  completeSimpleStep,
  isClientObjectiveCompatible,
  isParticipationOwner,
  skipOptionalStep,
} from '@/features/quests/services/questProgress.service';
import type { QuestObjectiveRow } from '@/lib/supabase/database.types';

const objective: QuestObjectiveRow = {
  id: 'step-1',
  quest_id: 'quest-1',
  sort_order: 1,
  title: 'Find the marker',
  instructions: 'Find the marker.',
  is_required: true,
  is_optional: false,
  proof_type: 'none',
  location_requirement_type: 'none',
  completion_rule: 'manual',
  completion_mode: 'auto',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const describeWithoutSupabase = (
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)
  ? describe.skip
  : describe;

describeWithoutSupabase('Quest trust boundary without Supabase', () => {
  it.each([
    ['complete', () => completeQuest({ participationId: 'participation-1', userId: 'user-1' })],
    ['abandon', () => abandonQuest({ participationId: 'participation-1', userId: 'user-1' })],
    ['expire', () => expireParticipation({ participationId: 'participation-1', userId: 'user-1', questId: 'quest-1' })],
    ['create proof', () => createQuestProofDraft({ participationId: 'participation-1', userId: 'user-1', submissionType: 'text' })],
    ['update proof', () => updateQuestProofDraft('proof-1', 'user-1', { textResponse: 'changed' })],
    ['submit proof', () => submitQuestProof('proof-1', 'user-1', 'participation-1')],
    ['begin step', () => beginStep({ participationId: 'participation-1', stepId: 'step-1', userId: 'user-1' })],
    ['complete step', () => completeSimpleStep({ participationId: 'participation-1', stepId: 'step-1', userId: 'user-1', objective })],
    ['skip step', () => skipOptionalStep('participation-1', 'step-1', 'user-1', { ...objective, is_required: false, is_optional: true })],
  ])('%s reports unavailable without success or a local record', async (_name, operation) => {
    const result = await operation();
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
    expect(result.participation ?? result.proof ?? result.stepProgress ?? null).toBeNull();
  });
});

describe('trusted Quest objective rules', () => {
  it('rejects a client objective that changes proof requirements', () => {
    expect(isClientObjectiveCompatible(
      { ...objective, proof_type: 'photo' },
      objective,
    )).toBe(false);
  });

  it('rejects a client objective from another Quest', () => {
    expect(isClientObjectiveCompatible(
      { ...objective, quest_id: 'other-quest' },
      objective,
    )).toBe(false);
  });

  it('accepts matching client and trusted objectives', () => {
    expect(isClientObjectiveCompatible(objective, { ...objective })).toBe(true);
  });
});

describe('participation ownership', () => {
  it('rejects a different user before progress writes', () => {
    expect(isParticipationOwner({ user_id: 'owner-1' }, 'owner-2')).toBe(false);
  });

  it('accepts only the participation owner', () => {
    expect(isParticipationOwner({ user_id: 'owner-1' }, 'owner-1')).toBe(true);
  });
});