/**
 * Quest Availability Service Tests
 * Tests for evaluateQuestAvailability and evaluateQuestAvailabilityBatch.
 */

import {
  evaluateQuestAvailability,
  evaluateQuestAvailabilityBatch,
  selectHomeActiveQuest,
  type AvailabilityInput,
} from '@/features/quests/services/questAvailability.service';
import type { QuestRowExtended, QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import type { EligibilityContext } from '@/features/quests/services/questEligibility.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuest(overrides: Partial<QuestRowExtended> = {}): QuestRowExtended {
  const past = new Date(Date.now() - 3600000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  return {
    id: 'q1',
    slug: 'morning-walk',
    title: 'Morning Walk',
    summary: 'Walk',
    description: 'Walk outside',
    quest_type: 'daily',
    status: 'published',
    difficulty: 'very_easy',
    estimated_duration_minutes: 15,
    points_reward: 50,
    indoor_outdoor: 'outdoor',
    accessibility_notes: null,
    safety_notes: null,
    proof_type: 'none',
    location_requirement_type: 'none',
    available_from: past,
    available_until: future,
    published_at: past,
    created_by: null,
    approved_by: null,
    source_type: 'admin',
    ai_generation_id: null,
    is_repeatable: false,
    repeat_cooldown_hours: null,
    created_at: past,
    updated_at: past,
    archived_at: null,
    completion_mode: 'auto',
    expiration_behavior: 'hard',
    home_priority: 10,
    ...overrides,
  };
}

function makeContext(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    userId: 'user-1',
    profile: { account_status: 'active', onboarding_status: 'completed' },
    hasLocationPermission: true,
    ...overrides,
  };
}

function makeParticipation(
  status: string,
  overrides: Partial<QuestParticipationRowExtended> = {}
): QuestParticipationRowExtended {
  const now = new Date().toISOString();
  return {
    id: 'part-1',
    quest_id: 'q1',
    user_id: 'user-1',
    status: status as any,
    started_at: now,
    last_progress_at: null,
    submitted_at: null,
    completed_at: null,
    abandoned_at: null,
    expires_at: null,
    awarded_points: null,
    completion_version: 1,
    created_at: now,
    updated_at: now,
    reward_snapshot_points: 50,
    occurrence_key: null,
    ...overrides,
  };
}

// ─── State mapping ────────────────────────────────────────────────────────────

describe('evaluateQuestAvailability - participation state mapping', () => {
  const cases: [string, string][] = [
    ['started', 'active'],
    ['in_progress', 'active'],
    ['awaiting_proof', 'awaiting_proof'],
    ['under_review', 'under_review'],
    ['needs_resubmission', 'needs_resubmission'],
    ['completed', 'completed'],
  ];

  test.each(cases)('participation status %s → availability state %s', (status, expected) => {
    const input: AvailabilityInput = {
      quest: makeQuest(),
      context: makeContext(),
      existingParticipation: makeParticipation(status),
    };
    const result = evaluateQuestAvailability(input);
    expect(result.state).toBe(expected);
    expect(result.canStart).toBe(false);
  });

  it('abandoned participation falls through to availability evaluation', () => {
    const input: AvailabilityInput = {
      quest: makeQuest(),
      context: makeContext(),
      existingParticipation: makeParticipation('abandoned'),
    };
    const result = evaluateQuestAvailability(input);
    // Not blocked by abandoned participation — re-evaluated as available
    expect(['available', 'ineligible', 'expired', 'upcoming']).toContain(result.state);
  });
});

// ─── Quest content states ─────────────────────────────────────────────────────

describe('evaluateQuestAvailability - quest content state', () => {
  it('returns paused for paused quest', () => {
    const result = evaluateQuestAvailability({
      quest: makeQuest({ status: 'paused' }),
      context: makeContext(),
    });
    expect(result.state).toBe('paused');
    expect(result.canStart).toBe(false);
  });

  it('returns expired for expired quest', () => {
    const result = evaluateQuestAvailability({
      quest: makeQuest({ status: 'expired' }),
      context: makeContext(),
    });
    expect(result.state).toBe('expired');
  });

  it('returns upcoming for future quest', () => {
    const future1 = new Date(Date.now() + 7200000).toISOString();
    const future2 = new Date(Date.now() + 86400000).toISOString();
    const result = evaluateQuestAvailability({
      quest: makeQuest({ available_from: future1, available_until: future2 }),
      context: makeContext(),
    });
    expect(result.state).toBe('upcoming');
    expect(result.canStart).toBe(false);
    expect(result.availableFrom).toBeTruthy();
  });
});

// ─── Expiration behavior ──────────────────────────────────────────────────────

describe('evaluateQuestAvailability - expiration behavior', () => {
  it('expires active participation on hard expiration when quest expires', () => {
    const pastExpiry = new Date(Date.now() - 3600000).toISOString();
    const quest = makeQuest({
      available_until: pastExpiry,
      expiration_behavior: 'hard',
    });
    const participation = makeParticipation('in_progress');
    const result = evaluateQuestAvailability({ quest, context: makeContext(), existingParticipation: participation });
    expect(result.state).toBe('expired');
  });

  it('does not expire active participation with started_users_may_finish', () => {
    // Quest is expired, but expiration_behavior = started_users_may_finish
    // Active participation should still show as 'active' state
    const pastExpiry = new Date(Date.now() - 3600000).toISOString();
    const quest = makeQuest({
      available_until: pastExpiry,
      expiration_behavior: 'started_users_may_finish',
    });
    const participation = makeParticipation('in_progress');
    const result = evaluateQuestAvailability({ quest, context: makeContext(), existingParticipation: participation });
    expect(result.state).toBe('active'); // Not expired
  });
});

// ─── Eligible / available ─────────────────────────────────────────────────────

describe('evaluateQuestAvailability - eligible path', () => {
  it('returns available with canStart=true for eligible user', () => {
    const result = evaluateQuestAvailability({
      quest: makeQuest(),
      context: makeContext(),
    });
    expect(result.state).toBe('available');
    expect(result.canStart).toBe(true);
    expect(result.occurrenceKey).toMatch(/^daily:morning-walk:/);
  });

  it('returns ineligible with reason for blocked user', () => {
    const result = evaluateQuestAvailability({
      quest: makeQuest(),
      context: makeContext({ profile: { account_status: 'suspended', onboarding_status: 'completed' } }),
    });
    expect(result.state).toBe('ineligible');
    expect(result.canStart).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_SUSPENDED');
  });
});

// ─── Batch evaluator ──────────────────────────────────────────────────────────

describe('evaluateQuestAvailabilityBatch', () => {
  it('evaluates multiple quests and returns a map', () => {
    const quests = [
      makeQuest({ id: 'q1' }),
      makeQuest({ id: 'q2', status: 'paused' }),
    ];
    const ctx = makeContext();
    const participationsMap = new Map<string, QuestParticipationRowExtended>();

    const results = evaluateQuestAvailabilityBatch(quests, ctx, participationsMap);

    expect(results.size).toBe(2);
    expect(results.get('q1')?.state).toBe('available');
    expect(results.get('q2')?.state).toBe('paused');
  });

  it('applies participation state for quests with participations', () => {
    const quests = [makeQuest({ id: 'q1' })];
    const ctx = makeContext();
    const participation = makeParticipation('in_progress');
    const participationsMap = new Map([['q1', participation]]);

    const results = evaluateQuestAvailabilityBatch(quests, ctx, participationsMap);
    expect(results.get('q1')?.state).toBe('active');
  });
});

// ─── Home active quest selector ───────────────────────────────────────────────

describe('selectHomeActiveQuest', () => {
  const quest = makeQuest();

  it('returns null when no active participations', () => {
    const result = selectHomeActiveQuest([], quest);
    expect(result).toBeNull();
  });

  it('prioritizes needs_resubmission over in_progress', () => {
    const resubmit = makeParticipation('needs_resubmission', { id: 'resubmit' });
    const inProgress = makeParticipation('in_progress', { id: 'inprogress' });
    const result = selectHomeActiveQuest([inProgress, resubmit], quest);
    expect(result?.id).toBe('resubmit');
  });

  it('prioritizes started/in_progress over under_review', () => {
    const underReview = makeParticipation('under_review', { id: 'review' });
    const started = makeParticipation('started', { id: 'started' });
    const result = selectHomeActiveQuest([underReview, started], quest);
    expect(result?.id).toBe('started');
  });

  it('returns null when only completed participations', () => {
    const completed = makeParticipation('completed');
    const result = selectHomeActiveQuest([completed], quest);
    expect(result).toBeNull();
  });
});
