/**
 * Quest Action Resolver Tests
 *
 * Verifies that resolveQuestAction maps every availability state + participation
 * status combination to the correct UI action.
 */

import {
  resolveQuestAction,
  participationUrgencyRank,
  type QuestActionInput,
} from '@/features/quests/utils/questActionResolver';

// ─── resolveQuestAction ────────────────────────────────────────────────────────

describe('resolveQuestAction', () => {
  // ── available ──────────────────────────────────────────────────────────────

  it('returns start action when available', () => {
    const action = resolveQuestAction({ availabilityState: 'available' });
    expect(action.label).toBe('Start Quest');
    expect(action.actionType).toBe('start');
    expect(action.enabled).toBe(true);
    expect(action.isMutation).toBe(true);
  });

  // ── active sub-states ──────────────────────────────────────────────────────

  it('returns continue when active + in_progress', () => {
    const action = resolveQuestAction({
      availabilityState: 'active',
      participationStatus: 'in_progress',
    });
    expect(action.actionType).toBe('continue');
    expect(action.enabled).toBe(true);
    expect(action.isMutation).toBe(false);
  });

  it('returns submit_proof when active + awaiting_proof', () => {
    const action = resolveQuestAction({
      availabilityState: 'active',
      participationStatus: 'awaiting_proof',
    });
    expect(action.actionType).toBe('submit_proof');
    expect(action.label).toBe('Submit Proof');
    expect(action.enabled).toBe(true);
  });

  it('returns view_submission when active + under_review', () => {
    const action = resolveQuestAction({
      availabilityState: 'active',
      participationStatus: 'under_review',
    });
    expect(action.actionType).toBe('view_submission');
    expect(action.enabled).toBe(true);
  });

  it('returns resubmit when active + needs_resubmission', () => {
    const action = resolveQuestAction({
      availabilityState: 'active',
      participationStatus: 'needs_resubmission',
    });
    expect(action.actionType).toBe('resubmit');
    expect(action.label).toBe('Resubmit Proof');
    expect(action.enabled).toBe(true);
  });

  // ── direct availability states ─────────────────────────────────────────────

  it('returns submit_proof for awaiting_proof state', () => {
    const action = resolveQuestAction({ availabilityState: 'awaiting_proof' });
    expect(action.actionType).toBe('submit_proof');
    expect(action.enabled).toBe(true);
  });

  it('returns view_submission for under_review state', () => {
    const action = resolveQuestAction({ availabilityState: 'under_review' });
    expect(action.actionType).toBe('view_submission');
    expect(action.enabled).toBe(true);
  });

  it('returns resubmit for needs_resubmission state', () => {
    const action = resolveQuestAction({ availabilityState: 'needs_resubmission' });
    expect(action.actionType).toBe('resubmit');
    expect(action.enabled).toBe(true);
  });

  it('returns view_completion for completed state', () => {
    const action = resolveQuestAction({ availabilityState: 'completed' });
    expect(action.actionType).toBe('view_completion');
    expect(action.enabled).toBe(true);
    expect(action.isMutation).toBe(false);
  });

  // ── unavailable states ─────────────────────────────────────────────────────

  it('returns disabled start for upcoming state', () => {
    const action = resolveQuestAction({
      availabilityState: 'upcoming',
      availableFrom: '2026-08-01T00:00:00Z',
    });
    expect(action.actionType).toBe('start');
    expect(action.enabled).toBe(false);
    expect(action.disabledReason).toContain('Available');
  });

  it('returns unavailable for expired state', () => {
    const action = resolveQuestAction({ availabilityState: 'expired' });
    expect(action.actionType).toBe('unavailable');
    expect(action.enabled).toBe(false);
    expect(action.disabledReason).toBeTruthy();
  });

  it('returns unavailable for paused state', () => {
    const action = resolveQuestAction({ availabilityState: 'paused' });
    expect(action.actionType).toBe('unavailable');
    expect(action.enabled).toBe(false);
  });

  it('returns disabled start for ineligible state with ALREADY_COMPLETED', () => {
    const action = resolveQuestAction({
      availabilityState: 'ineligible',
      reasonCode: 'ALREADY_COMPLETED',
    });
    expect(action.actionType).toBe('unavailable');
    expect(action.enabled).toBe(false);
    expect(action.disabledReason).toContain('completed');
  });

  it('uses userMessage over reasonCode when both provided', () => {
    const action = resolveQuestAction({
      availabilityState: 'ineligible',
      reasonCode: 'PREREQUISITE_NOT_MET',
      userMessage: 'You need 500 points first.',
    });
    expect(action.disabledReason).toBe('You need 500 points first.');
  });

  it('provides a fallback reason for unknown ineligible reason', () => {
    const action = resolveQuestAction({
      availabilityState: 'ineligible',
    });
    expect(action.disabledReason).toBeTruthy();
  });

  // ── all actions have accessibilityLabel ────────────────────────────────────

  it('provides accessibilityLabel for every state', () => {
    const states: QuestActionInput['availabilityState'][] = [
      'available', 'active', 'awaiting_proof', 'under_review',
      'needs_resubmission', 'completed', 'upcoming', 'expired',
      'paused', 'ineligible',
    ];
    for (const state of states) {
      const action = resolveQuestAction({ availabilityState: state });
      expect(action.accessibilityLabel).toBeTruthy();
    }
  });
});

// ─── participationUrgencyRank ──────────────────────────────────────────────────

describe('participationUrgencyRank', () => {
  it('ranks needs_resubmission highest', () => {
    const resubmit = participationUrgencyRank('needs_resubmission');
    const awaiting = participationUrgencyRank('awaiting_proof');
    const inProgress = participationUrgencyRank('in_progress');
    expect(resubmit).toBeGreaterThan(awaiting);
    expect(awaiting).toBeGreaterThan(inProgress);
  });

  it('ranks under_review lower than in_progress', () => {
    const review = participationUrgencyRank('under_review');
    const inProgress = participationUrgencyRank('in_progress');
    expect(review).toBeLessThan(inProgress);
  });

  it('returns non-negative for any status', () => {
    const statuses = ['started', 'in_progress', 'awaiting_proof', 'under_review', 'needs_resubmission', 'completed', 'abandoned'];
    for (const s of statuses) {
      expect(participationUrgencyRank(s as any)).toBeGreaterThanOrEqual(0);
    }
  });
});
