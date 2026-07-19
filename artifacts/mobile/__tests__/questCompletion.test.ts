/**
 * Quest Completion Service Tests
 * Tests for the computeProgressHelpers and buildReversalLedgerEntry functions.
 * (completeQuest requires live DB — tested via integration test with local Supabase)
 */

import {
  computeProgressHelpers,
  buildReversalLedgerEntry,
} from '@/features/quests/services/questCompletion.service';
import type { QuestObjectiveRow, QuestStepProgressRow } from '@/lib/supabase/database.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeObjective(id: string, sortOrder: number, isRequired = true): QuestObjectiveRow {
  return {
    id,
    quest_id: 'quest-1',
    sort_order: sortOrder,
    title: `Step ${sortOrder}`,
    instructions: `Instructions for step ${sortOrder}`,
    is_required: isRequired,
    is_optional: !isRequired,
    proof_type: 'none',
    location_requirement_type: 'none',
    completion_rule: 'manual',
    completion_mode: 'auto',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeProgress(stepId: string, status: string): QuestStepProgressRow {
  const now = new Date().toISOString();
  return {
    id: `progress-${stepId}`,
    participation_id: 'part-1',
    quest_step_id: stepId,
    status: status as any,
    completed_at: status === 'completed' ? now : null,
    progress_value: null,
    notes: null,
    created_at: now,
    updated_at: now,
  };
}

// ─── computeProgressHelpers ───────────────────────────────────────────────────

describe('computeProgressHelpers', () => {
  describe('with no objectives', () => {
    it('returns zero progress', () => {
      const helpers = computeProgressHelpers([], []);
      expect(helpers.requiredStepsCompleted).toBe(0);
      expect(helpers.totalRequiredSteps).toBe(0);
      expect(helpers.currentStep).toBeNull();
      expect(helpers.nextAvailableStep).toBeNull();
      expect(helpers.progressPercent).toBeNull();
    });
  });

  describe('with required objectives', () => {
    const objectives = [
      makeObjective('step-1', 1, true),
      makeObjective('step-2', 2, true),
      makeObjective('step-3', 3, true),
    ];

    it('returns 0% progress with no completions', () => {
      const helpers = computeProgressHelpers(objectives, []);
      expect(helpers.requiredStepsCompleted).toBe(0);
      expect(helpers.totalRequiredSteps).toBe(3);
      expect(helpers.progressPercent).toBe(0);
      expect(helpers.completionReadiness).toBe('steps_incomplete');
    });

    it('returns partial progress correctly', () => {
      const progress = [
        makeProgress('step-1', 'completed'),
        makeProgress('step-2', 'in_progress'),
      ];
      const helpers = computeProgressHelpers(objectives, progress);
      expect(helpers.requiredStepsCompleted).toBe(1);
      expect(helpers.progressPercent).toBe(33);
    });

    it('returns 100% when all required steps complete', () => {
      const progress = [
        makeProgress('step-1', 'completed'),
        makeProgress('step-2', 'completed'),
        makeProgress('step-3', 'completed'),
      ];
      const helpers = computeProgressHelpers(objectives, progress);
      expect(helpers.requiredStepsCompleted).toBe(3);
      expect(helpers.totalRequiredSteps).toBe(3);
      expect(helpers.progressPercent).toBe(100);
      expect(helpers.completionReadiness).toBe('ready');
    });

    it('identifies the current incomplete step', () => {
      const progress = [makeProgress('step-1', 'completed')];
      const helpers = computeProgressHelpers(objectives, progress);
      expect(helpers.currentStep?.id).toBe('step-2');
    });

    it('identifies next available step after current', () => {
      const progress = [makeProgress('step-1', 'completed')];
      const helpers = computeProgressHelpers(objectives, progress);
      expect(helpers.nextAvailableStep?.id).toBe('step-3');
    });

    it('returns null for currentStep when all done', () => {
      const progress = objectives.map(o => makeProgress(o.id, 'completed'));
      const helpers = computeProgressHelpers(objectives, progress);
      expect(helpers.currentStep).toBeNull();
    });
  });

  describe('with optional objectives', () => {
    const objectives = [
      makeObjective('step-1', 1, true),   // required
      makeObjective('step-2', 2, false),  // optional
      makeObjective('step-3', 3, true),   // required
    ];

    it('counts only required steps in progress calculation', () => {
      const progress = [makeProgress('step-1', 'completed')];
      const helpers = computeProgressHelpers(objectives, progress);
      // 1/2 required = 50%
      expect(helpers.requiredStepsCompleted).toBe(1);
      expect(helpers.totalRequiredSteps).toBe(2);
      expect(helpers.progressPercent).toBe(50);
    });

    it('does not include optional step in required count', () => {
      const progress = [
        makeProgress('step-1', 'completed'),
        makeProgress('step-2', 'completed'), // optional, completed
      ];
      const helpers = computeProgressHelpers(objectives, progress);
      // Still 1/2 required
      expect(helpers.requiredStepsCompleted).toBe(1);
      expect(helpers.totalRequiredSteps).toBe(2);
    });
  });
});

// ─── buildReversalLedgerEntry ─────────────────────────────────────────────────

describe('buildReversalLedgerEntry', () => {
  const params = {
    originalTransactionId: 'ledger-uuid-123',
    userId: 'user-456',
    originalAmount: 150,
    reason: 'Admin correction: quest credited in error',
    adminId: 'admin-789',
  };

  it('creates a reversal entry with correct transaction_type', () => {
    const entry = buildReversalLedgerEntry(params);
    expect(entry.transaction_type).toBe('reversal');
  });

  it('preserves the original amount (not negated — type determines direction)', () => {
    const entry = buildReversalLedgerEntry(params);
    expect(entry.amount).toBe(150);
  });

  it('links to the original transaction', () => {
    const entry = buildReversalLedgerEntry(params);
    expect(entry.reversed_transaction_id).toBe('ledger-uuid-123');
  });

  it('includes admin reference', () => {
    const entry = buildReversalLedgerEntry(params);
    expect(entry.created_by).toBe('admin-789');
  });

  it('generates idempotency key referencing original + admin', () => {
    const entry = buildReversalLedgerEntry(params);
    expect(entry.idempotency_key).toBe('reversal:ledger-uuid-123:admin-789');
  });

  it('generates stable idempotency key for same inputs', () => {
    const e1 = buildReversalLedgerEntry(params);
    const e2 = buildReversalLedgerEntry(params);
    expect(e1.idempotency_key).toBe(e2.idempotency_key);
  });
});
