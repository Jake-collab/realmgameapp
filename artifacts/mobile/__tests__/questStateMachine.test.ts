/**
 * Quest State Machine Tests
 * Tests for participation and proof transition validation.
 */

import {
  validateParticipationTransition,
  isParticipationTerminal,
  isParticipationActive,
  canAbandon,
  canSubmitProof,
  getAutoCompletionTransitions,
  getManualReviewTransitions,
} from '@/features/quests/stateMachine/participation.machine';

import {
  validateProofTransition,
  isProofEditable,
  isProofImmutable,
  isProofApproved,
  canResubmit,
  canUserSubmitProof,
  shouldShowResubmitAction,
} from '@/features/quests/stateMachine/proof.machine';

import {
  validateQuestContentTransition,
  isQuestPubliclyVisible,
  isQuestOpenForParticipation,
  isQuestContentTerminal,
} from '@/features/quests/stateMachine/questContent.machine';

// ─── Participation state machine ──────────────────────────────────────────────

describe('validateParticipationTransition', () => {
  // Valid transitions
  it('allows started → in_progress', () => {
    const result = validateParticipationTransition('started', 'in_progress');
    expect(result.allowed).toBe(true);
  });

  it('allows started → abandoned', () => {
    const result = validateParticipationTransition('started', 'abandoned');
    expect(result.allowed).toBe(true);
  });

  it('allows in_progress → awaiting_proof', () => {
    expect(validateParticipationTransition('in_progress', 'awaiting_proof').allowed).toBe(true);
  });

  it('allows awaiting_proof → under_review', () => {
    expect(validateParticipationTransition('awaiting_proof', 'under_review').allowed).toBe(true);
  });

  it('allows needs_resubmission → under_review', () => {
    expect(validateParticipationTransition('needs_resubmission', 'under_review').allowed).toBe(true);
  });

  // Trusted-only transitions
  it('blocks under_review → completed for untrusted caller', () => {
    const result = validateParticipationTransition('under_review', 'completed', false);
    expect(result.allowed).toBe(false);
    expect(result.requiresTrusted).toBe(true);
  });

  it('allows under_review → completed for trusted caller', () => {
    const result = validateParticipationTransition('under_review', 'completed', true);
    expect(result.allowed).toBe(true);
  });

  it('blocks under_review → rejected for untrusted caller', () => {
    const result = validateParticipationTransition('under_review', 'rejected', false);
    expect(result.allowed).toBe(false);
    expect(result.requiresTrusted).toBe(true);
  });

  // Invalid transitions
  it('blocks started → completed directly', () => {
    expect(validateParticipationTransition('started', 'completed', true).allowed).toBe(false);
  });

  it('blocks completed → abandoned (terminal)', () => {
    expect(validateParticipationTransition('completed', 'abandoned').allowed).toBe(false);
  });

  it('blocks abandoned → started (terminal)', () => {
    expect(validateParticipationTransition('abandoned', 'started').allowed).toBe(false);
  });

  it('blocks expired → in_progress (terminal)', () => {
    expect(validateParticipationTransition('expired', 'in_progress').allowed).toBe(false);
  });

  it('blocks under_review → abandoned (under review cannot be abandoned)', () => {
    expect(validateParticipationTransition('under_review', 'abandoned').allowed).toBe(false);
  });
});

describe('isParticipationTerminal', () => {
  it('identifies terminal states', () => {
    expect(isParticipationTerminal('completed')).toBe(true);
    expect(isParticipationTerminal('rejected')).toBe(true);
    expect(isParticipationTerminal('abandoned')).toBe(true);
    expect(isParticipationTerminal('expired')).toBe(true);
  });

  it('identifies non-terminal states', () => {
    expect(isParticipationTerminal('started')).toBe(false);
    expect(isParticipationTerminal('in_progress')).toBe(false);
    expect(isParticipationTerminal('awaiting_proof')).toBe(false);
    expect(isParticipationTerminal('under_review')).toBe(false);
    expect(isParticipationTerminal('needs_resubmission')).toBe(false);
  });
});

describe('isParticipationActive', () => {
  it('identifies active states', () => {
    expect(isParticipationActive('started')).toBe(true);
    expect(isParticipationActive('in_progress')).toBe(true);
    expect(isParticipationActive('awaiting_proof')).toBe(true);
    expect(isParticipationActive('needs_resubmission')).toBe(true);
  });

  it('identifies inactive states', () => {
    expect(isParticipationActive('under_review')).toBe(false);
    expect(isParticipationActive('completed')).toBe(false);
    expect(isParticipationActive('abandoned')).toBe(false);
  });
});

describe('canAbandon', () => {
  it('allows abandonment from abandoable states', () => {
    expect(canAbandon('started')).toBe(true);
    expect(canAbandon('in_progress')).toBe(true);
    expect(canAbandon('awaiting_proof')).toBe(true);
    expect(canAbandon('needs_resubmission')).toBe(true);
  });

  it('blocks abandonment from terminal and review states', () => {
    expect(canAbandon('completed')).toBe(false);
    expect(canAbandon('under_review')).toBe(false);
    expect(canAbandon('abandoned')).toBe(false);
    expect(canAbandon('expired')).toBe(false);
    expect(canAbandon('rejected')).toBe(false);
  });
});

describe('canSubmitProof', () => {
  it('allows proof submission from active states', () => {
    expect(canSubmitProof('started')).toBe(true);
    expect(canSubmitProof('in_progress')).toBe(true);
    expect(canSubmitProof('awaiting_proof')).toBe(true);
    expect(canSubmitProof('needs_resubmission')).toBe(true);
  });

  it('blocks proof submission from terminal/review states', () => {
    expect(canSubmitProof('completed')).toBe(false);
    expect(canSubmitProof('under_review')).toBe(false);
  });
});

describe('completion transitions', () => {
  it('auto completion sequence is correct', () => {
    expect(getAutoCompletionTransitions()).toEqual(['started', 'in_progress', 'completed']);
  });

  it('manual review sequence is correct', () => {
    expect(getManualReviewTransitions()).toEqual([
      'started', 'in_progress', 'awaiting_proof', 'under_review', 'completed',
    ]);
  });
});

// ─── Proof state machine ──────────────────────────────────────────────────────

describe('validateProofTransition', () => {
  it('allows draft → submitted', () => {
    expect(validateProofTransition('draft', 'submitted').allowed).toBe(true);
  });

  it('allows draft → uploading', () => {
    expect(validateProofTransition('draft', 'uploading').allowed).toBe(true);
  });

  it('allows submitted → under_review', () => {
    expect(validateProofTransition('submitted', 'under_review').allowed).toBe(true);
  });

  it('blocks under_review → approved for untrusted caller', () => {
    const result = validateProofTransition('under_review', 'approved', false);
    expect(result.allowed).toBe(false);
    expect(result.requiresTrusted).toBe(true);
  });

  it('allows under_review → approved for trusted reviewer', () => {
    expect(validateProofTransition('under_review', 'approved', true).allowed).toBe(true);
  });

  it('blocks under_review → needs_resubmission for untrusted', () => {
    expect(validateProofTransition('under_review', 'needs_resubmission', false).allowed).toBe(false);
  });

  it('allows needs_resubmission → submitted', () => {
    expect(validateProofTransition('needs_resubmission', 'submitted').allowed).toBe(true);
  });

  it('blocks approved → rejected (terminal)', () => {
    expect(validateProofTransition('approved', 'rejected').allowed).toBe(false);
  });

  it('blocks submitted → draft (submitted is immutable)', () => {
    expect(validateProofTransition('submitted', 'draft').allowed).toBe(false);
  });
});

describe('proof status helpers', () => {
  it('isProofEditable: only draft/uploading are editable', () => {
    expect(isProofEditable('draft')).toBe(true);
    expect(isProofEditable('uploading')).toBe(true);
    expect(isProofEditable('submitted')).toBe(false);
    expect(isProofEditable('approved')).toBe(false);
  });

  it('isProofImmutable: submitted and later are immutable', () => {
    expect(isProofImmutable('submitted')).toBe(true);
    expect(isProofImmutable('under_review')).toBe(true);
    expect(isProofImmutable('approved')).toBe(true);
    expect(isProofImmutable('rejected')).toBe(true);
    expect(isProofImmutable('draft')).toBe(false);
  });

  it('isProofApproved', () => {
    expect(isProofApproved('approved')).toBe(true);
    expect(isProofApproved('rejected')).toBe(false);
  });

  it('canResubmit: only needs_resubmission', () => {
    expect(canResubmit('needs_resubmission')).toBe(true);
    expect(canResubmit('rejected')).toBe(false);
    expect(canResubmit('draft')).toBe(false);
  });

  it('canUserSubmitProof: draft and uploading', () => {
    expect(canUserSubmitProof('draft')).toBe(true);
    expect(canUserSubmitProof('uploading')).toBe(true);
    expect(canUserSubmitProof('submitted')).toBe(false);
  });

  it('shouldShowResubmitAction: only needs_resubmission', () => {
    expect(shouldShowResubmitAction('needs_resubmission')).toBe(true);
    expect(shouldShowResubmitAction('draft')).toBe(false);
    expect(shouldShowResubmitAction('rejected')).toBe(false);
  });
});

// ─── Quest content state machine ──────────────────────────────────────────────

describe('validateQuestContentTransition', () => {
  it('allows draft → pending_review', () => {
    expect(validateQuestContentTransition('draft', 'pending_review').allowed).toBe(true);
  });

  it('allows published → paused', () => {
    expect(validateQuestContentTransition('published', 'paused').allowed).toBe(true);
  });

  it('allows paused → published', () => {
    expect(validateQuestContentTransition('paused', 'published').allowed).toBe(true);
  });

  it('allows expired → archived', () => {
    expect(validateQuestContentTransition('expired', 'archived').allowed).toBe(true);
  });

  it('blocks archived → any (terminal)', () => {
    expect(validateQuestContentTransition('archived', 'published').allowed).toBe(false);
    expect(validateQuestContentTransition('archived', 'draft').allowed).toBe(false);
  });

  it('blocks published → draft', () => {
    expect(validateQuestContentTransition('published', 'draft').allowed).toBe(false);
  });
});

describe('quest content visibility helpers', () => {
  it('isQuestPubliclyVisible: only published', () => {
    expect(isQuestPubliclyVisible('published')).toBe(true);
    expect(isQuestPubliclyVisible('paused')).toBe(false);
    expect(isQuestPubliclyVisible('archived')).toBe(false);
    expect(isQuestPubliclyVisible('draft')).toBe(false);
  });

  it('isQuestOpenForParticipation: only published', () => {
    expect(isQuestOpenForParticipation('published')).toBe(true);
    expect(isQuestOpenForParticipation('paused')).toBe(false);
    expect(isQuestOpenForParticipation('expired')).toBe(false);
  });

  it('isQuestContentTerminal: only archived', () => {
    expect(isQuestContentTerminal('archived')).toBe(true);
    expect(isQuestContentTerminal('expired')).toBe(false);
    expect(isQuestContentTerminal('rejected')).toBe(false);
  });
});
