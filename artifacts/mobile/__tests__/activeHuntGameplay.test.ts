/**
 * Active Hunt Gameplay Tests — Worlds (Prompt 13)
 *
 * Tests for the Active Hunt gameplay feature module:
 *   - Stop action resolver (all completion methods × all statuses)
 *   - Proof draft state management and readiness evaluation
 *   - Hunt-level action resolver
 *   - Active hunt view mode resolution
 *   - Location validation outcome mapping
 *
 * Test environment: node (no React Native UI render)
 * No network calls — all logic is pure function / state machine tests.
 */

import { describe, it, expect } from '@jest/globals';

import { resolveStopAction, resolveHuntLevelAction } from '../features/active-hunt/services/stopActionResolver';
import {
  createEmptyProofDraft,
  evaluateProofDraftReadiness,
  resolveActiveHuntViewMode,
} from '../features/active-hunt/types/activeHunt.types';

import type { StopProgressStatus, StopCompletionMethod } from '../features/hunts/types/hunt.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStopActionInput(
  progressStatus: StopProgressStatus,
  completionMethod: StopCompletionMethod = 'manual_confirmation',
  locationValidated = false,
  proofDraftReady = false,
  isCurrent = true,
) {
  return { progressStatus, completionMethod, locationValidated, proofDraftReady, isCurrent };
}

// ─── resolveStopAction ────────────────────────────────────────────────────────

describe('resolveStopAction', () => {

  // Terminal states
  describe('terminal states', () => {
    it('completed stop → actionType=completed, disabled', () => {
      const result = resolveStopAction(makeStopActionInput('completed'));
      expect(result.actionType).toBe('completed');
      expect(result.isEnabled).toBe(false);
      expect(result.opensProofFlow).toBe(false);
      expect(result.callsCompleteStop).toBe(false);
    });

    it('locked stop → actionType=locked, disabled', () => {
      const result = resolveStopAction(makeStopActionInput('locked'));
      expect(result.actionType).toBe('locked');
      expect(result.isEnabled).toBe(false);
    });

    it('expired stop → actionType=expired, disabled', () => {
      const result = resolveStopAction(makeStopActionInput('expired'));
      expect(result.actionType).toBe('expired');
      expect(result.isEnabled).toBe(false);
    });
  });

  // Review states
  describe('review states', () => {
    it('rejected stop → resubmit_proof action', () => {
      const result = resolveStopAction(makeStopActionInput('rejected', 'text'));
      expect(result.actionType).toBe('resubmit_proof');
      expect(result.opensProofFlow).toBe(true);
      expect(result.isEnabled).toBe(true);
    });

    it('needs_resubmission stop → resubmit_proof action', () => {
      const result = resolveStopAction(makeStopActionInput('needs_resubmission', 'image'));
      expect(result.actionType).toBe('resubmit_proof');
      expect(result.opensProofFlow).toBe(true);
    });

    it('under_review stop → waiting_for_review, disabled', () => {
      const result = resolveStopAction(makeStopActionInput('under_review', 'text'));
      expect(result.actionType).toBe('waiting_for_review');
      expect(result.isEnabled).toBe(false);
    });

    it('awaiting_proof stop → waiting_for_review, disabled', () => {
      const result = resolveStopAction(makeStopActionInput('awaiting_proof', 'location'));
      expect(result.actionType).toBe('waiting_for_review');
      expect(result.isEnabled).toBe(false);
    });
  });

  // Non-current stop (ordered hunt)
  describe('non-current stop', () => {
    it('available but not current → locked action', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'manual_confirmation', false, false, false));
      expect(result.actionType).toBe('locked');
      expect(result.isEnabled).toBe(false);
      expect(result.disabledReason).toBeTruthy();
    });

    it('in_progress but not current → locked action', () => {
      const result = resolveStopAction(makeStopActionInput('in_progress', 'text', false, false, false));
      expect(result.actionType).toBe('locked');
    });
  });

  // Manual confirmation
  describe('manual_confirmation completion method', () => {
    it('available → mark_complete with confirmation', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'manual_confirmation'));
      expect(result.actionType).toBe('mark_complete');
      expect(result.requiresConfirmation).toBe(true);
      expect(result.callsCompleteStop).toBe(true);
      expect(result.opensProofFlow).toBe(false);
    });

    it('in_progress → mark_complete', () => {
      const result = resolveStopAction(makeStopActionInput('in_progress', 'manual_confirmation'));
      expect(result.actionType).toBe('mark_complete');
    });

    it('none method → mark_complete', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'none'));
      expect(result.actionType).toBe('mark_complete');
    });
  });

  // Location completion
  describe('location completion method', () => {
    it('location not validated → check_location action', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'location', false));
      expect(result.actionType).toBe('check_location');
      expect(result.opensLocationFlow).toBe(true);
      expect(result.callsCompleteStop).toBe(false);
    });

    it('location validated → complete_stop action', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'location', true));
      expect(result.actionType).toBe('complete_stop');
      expect(result.callsCompleteStop).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  // Text/image proof
  describe('text proof completion method', () => {
    it('text, draft not ready → add_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'text', false, false));
      expect(result.actionType).toBe('add_proof');
      expect(result.opensProofFlow).toBe(true);
    });

    it('text, draft ready → submit_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'text', false, true));
      expect(result.actionType).toBe('submit_proof');
      expect(result.opensProofFlow).toBe(true);
    });
  });

  describe('image proof completion method', () => {
    it('image, draft not ready → add_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'image', false, false));
      expect(result.actionType).toBe('add_proof');
    });

    it('image, draft ready → submit_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'image', false, true));
      expect(result.actionType).toBe('submit_proof');
    });
  });

  describe('text_and_image proof completion method', () => {
    it('draft not ready → add_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'text_and_image', false, false));
      expect(result.actionType).toBe('add_proof');
    });

    it('draft ready → submit_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'text_and_image', false, true));
      expect(result.actionType).toBe('submit_proof');
    });
  });

  describe('image_and_location completion method', () => {
    it('location not validated → check_location first', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'image_and_location', false, false));
      expect(result.actionType).toBe('check_location');
      expect(result.opensLocationFlow).toBe(true);
    });

    it('location validated, draft not ready → add_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'image_and_location', true, false));
      expect(result.actionType).toBe('add_proof');
      expect(result.opensProofFlow).toBe(true);
    });

    it('location validated, draft ready → submit_proof', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'image_and_location', true, true));
      expect(result.actionType).toBe('submit_proof');
    });
  });

  describe('trusted_code completion method', () => {
    it('available → add_proof (enter code)', () => {
      const result = resolveStopAction(makeStopActionInput('available', 'trusted_code'));
      expect(result.actionType).toBe('add_proof');
      expect(result.label).toBe('Enter Code');
      expect(result.opensProofFlow).toBe(true);
    });
  });

  // Security: verify no locked clues can be "actioned"
  describe('security invariants', () => {
    it('locked stop → no proof flow opened', () => {
      const result = resolveStopAction(makeStopActionInput('locked', 'text'));
      expect(result.opensProofFlow).toBe(false);
      expect(result.opensLocationFlow).toBe(false);
      expect(result.callsCompleteStop).toBe(false);
    });

    it('expired stop → no actions possible', () => {
      const result = resolveStopAction(makeStopActionInput('expired', 'image'));
      expect(result.opensProofFlow).toBe(false);
      expect(result.callsCompleteStop).toBe(false);
      expect(result.isEnabled).toBe(false);
    });

    it('under_review → no resubmit (waiting only)', () => {
      const result = resolveStopAction(makeStopActionInput('under_review', 'text'));
      expect(result.actionType).toBe('waiting_for_review');
      expect(result.opensProofFlow).toBe(false);
    });
  });
});

// ─── resolveHuntLevelAction ───────────────────────────────────────────────────

describe('resolveHuntLevelAction', () => {
  it('ready state → complete_hunt action enabled', () => {
    const result = resolveHuntLevelAction('active', 'ready', 5, 5);
    expect(result.actionType).toBe('complete_hunt');
    expect(result.isEnabled).toBe(true);
  });

  it('missing_required_stop → continue action disabled', () => {
    const result = resolveHuntLevelAction('active', 'missing_required_stop', 2, 5);
    expect(result.actionType).toBe('continue');
    expect(result.isEnabled).toBe(false);
    expect(result.reasonText).toContain('3');
  });

  it('proof_pending → continue action disabled', () => {
    const result = resolveHuntLevelAction('active', 'proof_pending', 4, 5);
    expect(result.actionType).toBe('continue');
    expect(result.isEnabled).toBe(false);
  });

  it('non-active participation → disabled', () => {
    const result = resolveHuntLevelAction('completed', 'ready', 5, 5);
    expect(result.isEnabled).toBe(false);
    expect(result.actionType).toBe('disabled');
  });

  it('withdrawn participation → disabled', () => {
    const result = resolveHuntLevelAction('withdrawn', null, 0, 5);
    expect(result.isEnabled).toBe(false);
    expect(result.actionType).toBe('disabled');
  });

  it('paused participation with ready state → complete_hunt', () => {
    const result = resolveHuntLevelAction('paused', 'ready', 5, 5);
    expect(result.actionType).toBe('complete_hunt');
    expect(result.isEnabled).toBe(true);
  });

  it('remaining count shows correctly for singular', () => {
    const result = resolveHuntLevelAction('active', 'missing_required_stop', 4, 5);
    expect(result.label).toContain('1 Stop');
  });

  it('remaining count shows plural correctly', () => {
    const result = resolveHuntLevelAction('active', 'missing_required_stop', 3, 5);
    expect(result.label).toContain('2 Stops');
  });
});

// ─── Proof draft management ───────────────────────────────────────────────────

describe('createEmptyProofDraft', () => {
  it('creates draft with correct fields for text method', () => {
    const draft = createEmptyProofDraft('pid-1', 'stop-1', 'text');
    expect(draft.participationId).toBe('pid-1');
    expect(draft.stopId).toBe('stop-1');
    expect(draft.completionMethod).toBe('text');
    expect(draft.textResponse).toBe('');
    expect(draft.images).toEqual([]);
    expect(draft.maxImages).toBe(0);
    expect(draft.locationValidated).toBe(false);
    expect(draft.isSubmitting).toBe(false);
  });

  it('sets maxImages=5 for image method', () => {
    const draft = createEmptyProofDraft('pid', 'stop', 'image');
    expect(draft.maxImages).toBe(5);
  });

  it('sets maxImages=3 for text_and_image method', () => {
    const draft = createEmptyProofDraft('pid', 'stop', 'text_and_image');
    expect(draft.maxImages).toBe(3);
  });

  it('sets maxImages=3 for image_and_location method', () => {
    const draft = createEmptyProofDraft('pid', 'stop', 'image_and_location');
    expect(draft.maxImages).toBe(3);
  });

  it('sets maxImages=0 for manual_confirmation method', () => {
    const draft = createEmptyProofDraft('pid', 'stop', 'manual_confirmation');
    expect(draft.maxImages).toBe(0);
  });

  it('carries previous submission ID when provided', () => {
    const draft = createEmptyProofDraft('pid', 'stop', 'text', 'prev-sub-id');
    expect(draft.previousSubmissionId).toBe('prev-sub-id');
  });

  it('null previousSubmissionId when not provided', () => {
    const draft = createEmptyProofDraft('pid', 'stop', 'text');
    expect(draft.previousSubmissionId).toBeNull();
  });
});

// ─── evaluateProofDraftReadiness ─────────────────────────────────────────────

describe('evaluateProofDraftReadiness', () => {

  describe('text method', () => {
    it('empty text → not ready', () => {
      const draft = createEmptyProofDraft('pid', 'stop', 'text');
      const { isReady, missingItems } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
      expect(missingItems.length).toBeGreaterThan(0);
    });

    it('short text (below minLength) → not ready', () => {
      const draft = { ...createEmptyProofDraft('pid', 'stop', 'text'), textResponse: 'short' };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('text meeting minLength → ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'text'),
        textResponse: 'This is a valid answer that is long enough to pass.',
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(true);
    });

    it('text exceeding maxLength → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'text'),
        textResponse: 'x'.repeat(1001),
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });
  });

  describe('image method', () => {
    it('no images → not ready', () => {
      const draft = createEmptyProofDraft('pid', 'stop', 'image');
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('image with mediaId → ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'image'),
        images: [{ localUri: 'file://img.jpg', mediaId: 'media-1', uploadState: 'uploaded' as const, errorMessage: null, fileSizeBytes: 50000 }],
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(true);
    });

    it('image with error upload state → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'image'),
        images: [{ localUri: 'file://img.jpg', mediaId: null, uploadState: 'error' as const, errorMessage: 'Upload failed', fileSizeBytes: null }],
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('image without mediaId (not yet uploaded) → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'image'),
        images: [{ localUri: 'file://img.jpg', mediaId: null, uploadState: 'idle' as const, errorMessage: null, fileSizeBytes: null }],
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });
  });

  describe('text_and_image method', () => {
    it('text only (no image) → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'text_and_image'),
        textResponse: 'This is a valid long text answer for the proof.',
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('image only (no text) → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'text_and_image'),
        images: [{ localUri: 'file://img.jpg', mediaId: 'media-1', uploadState: 'uploaded' as const, errorMessage: null, fileSizeBytes: null }],
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('both text and image → ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'text_and_image'),
        textResponse: 'This is a valid long text answer that meets requirements.',
        images: [{ localUri: 'file://img.jpg', mediaId: 'media-1', uploadState: 'uploaded' as const, errorMessage: null, fileSizeBytes: null }],
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(true);
    });
  });

  describe('image_and_location method', () => {
    it('image + location not validated → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'image_and_location'),
        images: [{ localUri: 'file://img.jpg', mediaId: 'media-1', uploadState: 'uploaded' as const, errorMessage: null, fileSizeBytes: null }],
        locationValidated: false,
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('image + location validated → ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'image_and_location'),
        images: [{ localUri: 'file://img.jpg', mediaId: 'media-1', uploadState: 'uploaded' as const, errorMessage: null, fileSizeBytes: null }],
        locationValidated: true,
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(true);
    });

    it('location validated but no image → not ready', () => {
      const draft = {
        ...createEmptyProofDraft('pid', 'stop', 'image_and_location'),
        locationValidated: true,
      };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });
  });

  describe('location method (location only)', () => {
    it('location not validated → not ready', () => {
      const draft = createEmptyProofDraft('pid', 'stop', 'location');
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(false);
    });

    it('location validated → ready', () => {
      const draft = { ...createEmptyProofDraft('pid', 'stop', 'location'), locationValidated: true };
      const { isReady } = evaluateProofDraftReadiness(draft);
      expect(isReady).toBe(true);
    });
  });

  describe('manual_confirmation method', () => {
    it('empty draft → ready (no proof required)', () => {
      const draft = createEmptyProofDraft('pid', 'stop', 'manual_confirmation');
      const { isReady } = evaluateProofDraftReadiness(draft);
      // manual_confirmation doesn't need text/image/location
      expect(isReady).toBe(true);
    });
  });
});

// ─── resolveActiveHuntViewMode ────────────────────────────────────────────────

describe('resolveActiveHuntViewMode', () => {
  const cases: Array<[string | null, string]> = [
    ['active',    'active'],
    ['paused',    'paused'],
    ['completed', 'completed'],
    ['withdrawn', 'withdrawn'],
    ['removed',   'removed'],
    [null,        'not_found'],
    ['unknown',   'not_found'],
  ];

  cases.forEach(([status, expected]) => {
    it(`participationStatus='${status}' → viewMode='${expected}'`, () => {
      const mode = resolveActiveHuntViewMode(status);
      expect(mode).toBe(expected);
    });
  });

  it('cancelled hunt (unknown status + huntCancelled flag) → cancelled', () => {
    const mode = resolveActiveHuntViewMode('unknown', true);
    expect(mode).toBe('cancelled');
  });
});

// ─── Security invariants ──────────────────────────────────────────────────────

describe('security invariants', () => {
  it('no stop action calls complete on a locked stop', () => {
    const allStatuses: StopProgressStatus[] = ['locked', 'expired'];
    const methods: StopCompletionMethod[] = ['manual_confirmation', 'text', 'image', 'location', 'image_and_location'];

    allStatuses.forEach(status => {
      methods.forEach(method => {
        const result = resolveStopAction(makeStopActionInput(status, method, true, true));
        expect(result.callsCompleteStop).toBe(false);
        expect(result.opensProofFlow).toBe(false);
        expect(result.isEnabled).toBe(false);
      });
    });
  });

  it('under_review stop cannot open proof flow', () => {
    const methods: StopCompletionMethod[] = ['text', 'image', 'image_and_location', 'text_and_image'];
    methods.forEach(method => {
      const result = resolveStopAction(makeStopActionInput('under_review', method, true, true));
      expect(result.opensProofFlow).toBe(false);
    });
  });

  it('awaiting_proof stop cannot open proof flow', () => {
    const result = resolveStopAction(makeStopActionInput('awaiting_proof', 'location', false, false));
    expect(result.opensProofFlow).toBe(false);
    expect(result.opensLocationFlow).toBe(false);
  });
});
