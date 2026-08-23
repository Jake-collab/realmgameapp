/**
 * Quest Eligibility Service Tests
 * Tests for the synchronous and asynchronous eligibility evaluators.
 */

import {
  evaluateEligibilitySync,
  type EligibilityContext,
} from '@/features/quests/services/questEligibility.service';
import type { QuestRowExtended } from '@/features/quests/repositories/quest.repository';
import type { QuestParticipationRow } from '@/lib/supabase/database.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    userId: 'user-123',
    profile: {
      account_status: 'active',
      onboarding_status: 'completed',
    },
    hasLocationPermission: true,
    ...overrides,
  };
}

function makeQuest(overrides: Partial<QuestRowExtended> = {}): QuestRowExtended {
  const now = new Date();
  const past = new Date(now.getTime() - 3600000).toISOString();
  const future = new Date(now.getTime() + 86400000).toISOString();

  return {
    id: 'quest-1',
    slug: 'test-quest',
    title: 'Test Quest',
    summary: 'Summary',
    description: 'Description',
    quest_type: 'daily',
    status: 'published',
    difficulty: 'easy',
    estimated_duration_minutes: 30,
    points_reward: 100,
    indoor_outdoor: 'both',
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
    home_priority: 0,
    ...overrides,
  };
}

function makeParticipation(overrides: Partial<QuestParticipationRow> = {}): QuestParticipationRow {
  const now = new Date().toISOString();
  return {
    id: 'part-1',
    quest_id: 'quest-1',
    user_id: 'user-123',
    status: 'started',
    started_at: now,
    last_progress_at: null,
    submitted_at: null,
    completed_at: null,
    abandoned_at: null,
    expires_at: null,
    awarded_points: null,
    reward_snapshot_points: null,
    occurrence_key: null,
    completion_version: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ─── Authentication ────────────────────────────────────────────────────────────

describe('evaluateEligibilitySync - authentication', () => {
  it('returns NOT_AUTHENTICATED when userId is null', () => {
    const result = evaluateEligibilitySync(makeQuest(), makeContext({ userId: null }));
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
  });

  it('returns NOT_AUTHENTICATED when profile is null', () => {
    const result = evaluateEligibilitySync(makeQuest(), makeContext({ profile: null }));
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('NOT_AUTHENTICATED');
  });
});

// ─── Account status ────────────────────────────────────────────────────────────

describe('evaluateEligibilitySync - account status', () => {
  it('returns ACCOUNT_SUSPENDED for suspended account', () => {
    const ctx = makeContext({ profile: { account_status: 'suspended', onboarding_status: 'completed' } });
    const result = evaluateEligibilitySync(makeQuest(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_SUSPENDED');
  });

  it('returns ACCOUNT_SUSPENDED for deactivated account', () => {
    const ctx = makeContext({ profile: { account_status: 'deactivated', onboarding_status: 'completed' } });
    const result = evaluateEligibilitySync(makeQuest(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_SUSPENDED');
  });

  it('returns ACCOUNT_RESTRICTED for restricted account', () => {
    const ctx = makeContext({ profile: { account_status: 'restricted', onboarding_status: 'completed' } });
    const result = evaluateEligibilitySync(makeQuest(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_RESTRICTED');
  });
});

// ─── Onboarding ────────────────────────────────────────────────────────────────

describe('evaluateEligibilitySync - onboarding', () => {
  it('returns ONBOARDING_INCOMPLETE for incomplete onboarding', () => {
    const ctx = makeContext({ profile: { account_status: 'active', onboarding_status: 'in_progress' } });
    const result = evaluateEligibilitySync(makeQuest(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ONBOARDING_INCOMPLETE');
  });

  it('returns ONBOARDING_INCOMPLETE for not_started onboarding', () => {
    const ctx = makeContext({ profile: { account_status: 'active', onboarding_status: 'not_started' } });
    const result = evaluateEligibilitySync(makeQuest(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ONBOARDING_INCOMPLETE');
  });
});

// ─── Quest status ──────────────────────────────────────────────────────────────

describe('evaluateEligibilitySync - quest status', () => {
  it('returns QUEST_PAUSED for paused quest', () => {
    const result = evaluateEligibilitySync(makeQuest({ status: 'paused' }), makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('QUEST_PAUSED');
  });

  it('returns QUEST_EXPIRED for expired quest', () => {
    const result = evaluateEligibilitySync(makeQuest({ status: 'expired' }), makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('QUEST_EXPIRED');
  });

  it('returns QUEST_EXPIRED for archived quest', () => {
    const result = evaluateEligibilitySync(makeQuest({ status: 'archived' }), makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('QUEST_EXPIRED');
  });

  it('returns QUEST_NOT_PUBLISHED for draft quest', () => {
    const result = evaluateEligibilitySync(makeQuest({ status: 'draft' }), makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('QUEST_NOT_PUBLISHED');
  });
});

// ─── Availability window ───────────────────────────────────────────────────────

describe('evaluateEligibilitySync - availability window', () => {
  it('returns QUEST_NOT_STARTED_YET for upcoming quest', () => {
    const future1 = new Date(Date.now() + 7200000).toISOString();
    const future2 = new Date(Date.now() + 86400000).toISOString();
    const quest = makeQuest({ available_from: future1, available_until: future2 });
    const result = evaluateEligibilitySync(quest, makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('QUEST_NOT_STARTED_YET');
  });

  it('returns QUEST_EXPIRED when quest window has closed', () => {
    const past1 = new Date(Date.now() - 7200000).toISOString();
    const past2 = new Date(Date.now() - 3600000).toISOString();
    const quest = makeQuest({ available_from: past1, available_until: past2 });
    const result = evaluateEligibilitySync(quest, makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('QUEST_EXPIRED');
  });
});

// ─── Location permission ───────────────────────────────────────────────────────

describe('evaluateEligibilitySync - location', () => {
  it('returns LOCATION_PERMISSION_REQUIRED for geo quest without permission', () => {
    const quest = makeQuest({
      quest_type: 'geo',
      location_requirement_type: 'approximate',
    });
    const ctx = makeContext({ hasLocationPermission: false });
    const result = evaluateEligibilitySync(quest, ctx);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('LOCATION_PERMISSION_REQUIRED');
  });

  it('does not require location for non-geo quest', () => {
    const quest = makeQuest({ quest_type: 'daily', location_requirement_type: 'none' });
    const ctx = makeContext({ hasLocationPermission: false });
    const result = evaluateEligibilitySync(quest, ctx);
    // Should be eligible (location not needed for daily)
    expect(result.eligible).toBe(true);
  });
});

// ─── Existing participation ────────────────────────────────────────────────────

describe('evaluateEligibilitySync - existing participation', () => {
  it('returns ACTIVE_PARTICIPATION_EXISTS for active participation', () => {
    const participation = makeParticipation({ status: 'in_progress' });
    const result = evaluateEligibilitySync(makeQuest(), makeContext(), { existingParticipation: participation });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACTIVE_PARTICIPATION_EXISTS');
    expect(result.activeParticipationId).toBe(participation.id);
  });

  it('returns ACTIVE_PARTICIPATION_EXISTS for awaiting_proof status', () => {
    const participation = makeParticipation({ status: 'awaiting_proof' });
    const result = evaluateEligibilitySync(makeQuest(), makeContext(), { existingParticipation: participation });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACTIVE_PARTICIPATION_EXISTS');
  });

  it('returns ACTIVE_PARTICIPATION_EXISTS for needs_resubmission status', () => {
    const participation = makeParticipation({ status: 'needs_resubmission' });
    const result = evaluateEligibilitySync(makeQuest(), makeContext(), { existingParticipation: participation });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ACTIVE_PARTICIPATION_EXISTS');
  });

  it('does not block when prior participation is completed', () => {
    // Completed, but quest is NOT repeatable — next check handles that
    const participation = makeParticipation({ status: 'completed' });
    const result = evaluateEligibilitySync(makeQuest({ is_repeatable: true }), makeContext(), {
      existingParticipation: participation,
    });
    // Repeatable quest with completed participation is eligible
    expect(result.eligible).toBe(true);
  });

  it('does not block when prior participation is abandoned', () => {
    const participation = makeParticipation({ status: 'abandoned' });
    const result = evaluateEligibilitySync(makeQuest(), makeContext(), { existingParticipation: participation });
    expect(result.eligible).toBe(true);
  });
});

// ─── Non-repeatable completion ─────────────────────────────────────────────────

describe('evaluateEligibilitySync - completion', () => {
  it('returns ALREADY_COMPLETED for non-repeatable completed quest', () => {
    const completed = makeParticipation({ status: 'completed' });
    const result = evaluateEligibilitySync(
      makeQuest({ is_repeatable: false }),
      makeContext(),
      { lastCompletedParticipation: completed }
    );
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('ALREADY_COMPLETED');
  });

  it('allows repeatable quest after completion (no cooldown)', () => {
    const completed = makeParticipation({ status: 'completed' });
    const result = evaluateEligibilitySync(
      makeQuest({ is_repeatable: true, repeat_cooldown_hours: null }),
      makeContext(),
      { lastCompletedParticipation: completed }
    );
    expect(result.eligible).toBe(true);
  });
});

// ─── Happy path ────────────────────────────────────────────────────────────────

describe('evaluateEligibilitySync - happy path', () => {
  it('returns ELIGIBLE for fully qualified user and quest', () => {
    const result = evaluateEligibilitySync(makeQuest(), makeContext());
    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe('ELIGIBLE');
  });
});
