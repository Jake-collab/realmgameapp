/**
 * Quest Home Priority Logic Tests
 *
 * Tests for the priority ordering logic used by the Quest Home screen
 * to select the dominant active participation panel.
 */

import { participationUrgencyRank } from '@/features/quests/utils/questActionResolver';
import type { ParticipationStatus } from '@/lib/supabase/database.types';

// ─── Priority ordering ─────────────────────────────────────────────────────────

describe('Home screen participation priority (via urgencyRank)', () => {
  /**
   * Spec §46 priority order (highest urgency first):
   *   1. needs_resubmission
   *   2. awaiting_proof
   *   3. in_progress
   *   4. started
   *   5. under_review
   */

  function sortByUrgency(statuses: ParticipationStatus[]): ParticipationStatus[] {
    return [...statuses].sort(
      (a, b) => participationUrgencyRank(b) - participationUrgencyRank(a)
    );
  }

  it('places needs_resubmission first', () => {
    const sorted = sortByUrgency(['in_progress', 'needs_resubmission', 'under_review']);
    expect(sorted[0]).toBe('needs_resubmission');
  });

  it('places awaiting_proof above in_progress', () => {
    const sorted = sortByUrgency(['in_progress', 'awaiting_proof']);
    expect(sorted[0]).toBe('awaiting_proof');
  });

  it('places in_progress above under_review', () => {
    const sorted = sortByUrgency(['under_review', 'in_progress']);
    expect(sorted[0]).toBe('in_progress');
  });

  it('produces strict order for all active statuses', () => {
    const statuses: ParticipationStatus[] = [
      'started', 'under_review', 'awaiting_proof', 'in_progress', 'needs_resubmission',
    ];
    const sorted = sortByUrgency(statuses);
    // needs_resubmission must be first
    expect(sorted[0]).toBe('needs_resubmission');
    // awaiting_proof must be second
    expect(sorted[1]).toBe('awaiting_proof');
    // in_progress must be third
    expect(sorted[2]).toBe('in_progress');
    // started must be fourth
    expect(sorted[3]).toBe('started');
    // under_review must be last
    expect(sorted[4]).toBe('under_review');
  });

  it('handles single participation', () => {
    const sorted = sortByUrgency(['in_progress']);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toBe('in_progress');
  });

  it('handles empty list', () => {
    const sorted = sortByUrgency([]);
    expect(sorted).toHaveLength(0);
  });
});

// ─── Availability state derivation ────────────────────────────────────────────

describe('participationToAvailabilityState mapping', () => {
  // Inline the mapping logic (same as in quest/index.tsx) for unit testing
  function participationToAvailabilityState(status: ParticipationStatus) {
    switch (status) {
      case 'started':        return 'active';
      case 'in_progress':    return 'active';
      case 'awaiting_proof': return 'awaiting_proof';
      case 'under_review':   return 'under_review';
      case 'needs_resubmission': return 'needs_resubmission';
      default:               return 'active';
    }
  }

  it('maps started to active', () => {
    expect(participationToAvailabilityState('started')).toBe('active');
  });

  it('maps in_progress to active', () => {
    expect(participationToAvailabilityState('in_progress')).toBe('active');
  });

  it('maps awaiting_proof to awaiting_proof', () => {
    expect(participationToAvailabilityState('awaiting_proof')).toBe('awaiting_proof');
  });

  it('maps under_review to under_review', () => {
    expect(participationToAvailabilityState('under_review')).toBe('under_review');
  });

  it('maps needs_resubmission to needs_resubmission', () => {
    expect(participationToAvailabilityState('needs_resubmission')).toBe('needs_resubmission');
  });
});
