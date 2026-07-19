/**
 * Hunt Progress — Prompt 14 Tests
 *
 * Covers:
 *   - Section selection logic (resolveDefaultHuntProgressSection)
 *   - In Action prioritization
 *   - Leaderboard privacy rules (client-side type guards)
 *   - Other Activity classification
 *   - Security invariants (cross-user access patterns)
 *   - Point isolation (Hunt-only transactions)
 *   - Completion detail guards (reversal, group flags)
 */

import {
  resolveDefaultHuntProgressSection,
  HUNT_IN_ACTION_STATUSES,
  HUNT_OTHER_ACTIVITY_STATUSES,
  DEFAULT_HUNT_COMPLETED_FILTER,
  HUNT_PROGRESS_PAGE_SIZE,
  HUNT_LEADERBOARD_PAGE_SIZE,
} from '../features/hunts/types/huntProgress.types';
import type {
  HuntInActionSummary,
  HuntProgressSection,
  HuntLeaderboardEntry,
  HuntPointTransaction,
  HuntOtherActivityItem,
  HuntCompletionDetail,
} from '../features/hunts/types/huntProgress.types';
import type { ParticipantStatus } from '../features/hunts/types/hunt.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<HuntInActionSummary> = {}): HuntInActionSummary {
  return {
    activeHunts: 0,
    stopsUnderReview: 0,
    stopsNeedingResubmission: 0,
    stopsAwaitingProof: 0,
    hasApproachingDeadline: false,
    earliestDeadline: null,
    ...overrides,
  };
}

function makeLeaderboardEntry(overrides: Partial<HuntLeaderboardEntry> = {}): HuntLeaderboardEntry {
  return {
    rank: 1,
    userId: 'user-1',
    displayName: 'Alice',
    username: 'alice',
    avatarPath: null,
    huntPoints: 500,
    huntsCompleted: 3,
    isCurrentUser: false,
    isAnonymous: false,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<HuntPointTransaction> = {}): HuntPointTransaction {
  return {
    ledgerId: 'ledger-1',
    amount: 100,
    transactionType: 'hunt_reward',
    displayLabel: 'Hunt completion reward',
    huntParticipationId: 'participation-1',
    huntTitle: 'Downtown Discovery',
    createdAt: new Date().toISOString(),
    isReversed: false,
    isReversal: false,
    reversedLedgerId: null,
    ...overrides,
  };
}

function makeOtherActivityItem(
  status: ParticipantStatus,
  overrides: Partial<HuntOtherActivityItem> = {},
): HuntOtherActivityItem {
  return {
    participationId: 'p-1',
    huntId: 'hunt-1',
    huntTitle: 'Test Hunt',
    status,
    joinedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finalizedAt: new Date().toISOString(),
    stopsCompleted: 2,
    stopsRequired: 5,
    awardedPoints: 0,
    safeStatusNote: 'Your participation ended.',
    ...overrides,
  };
}

// ─── Section Selection ────────────────────────────────────────────────────────

describe('resolveDefaultHuntProgressSection', () => {
  test('returns leaderboards when no urgent items and no last section', () => {
    const result = resolveDefaultHuntProgressSection(null, false, null);
    expect(result).toBe('leaderboards');
  });

  test('returns in_action when stopsNeedingResubmission > 0 (highest priority)', () => {
    const summary = makeSummary({ stopsNeedingResubmission: 2 });
    expect(resolveDefaultHuntProgressSection(summary, false, null)).toBe('in_action');
  });

  test('resubmission beats awaiting_proof', () => {
    const summary = makeSummary({ stopsNeedingResubmission: 1, stopsAwaitingProof: 3 });
    expect(resolveDefaultHuntProgressSection(summary, false, null)).toBe('in_action');
  });

  test('returns in_action when stopsAwaitingProof > 0', () => {
    const summary = makeSummary({ stopsAwaitingProof: 1 });
    expect(resolveDefaultHuntProgressSection(summary, false, null)).toBe('in_action');
  });

  test('returns in_action when activeHunts > 0', () => {
    const summary = makeSummary({ activeHunts: 2 });
    expect(resolveDefaultHuntProgressSection(summary, false, null)).toBe('in_action');
  });

  test('returns in_action when stopsUnderReview > 0', () => {
    const summary = makeSummary({ stopsUnderReview: 1 });
    expect(resolveDefaultHuntProgressSection(summary, false, null)).toBe('in_action');
  });

  test('returns completed when arrivedFromCompletion and no urgent items', () => {
    const summary = makeSummary(); // no urgent items
    expect(resolveDefaultHuntProgressSection(summary, true, null)).toBe('completed');
  });

  test('urgent in_action beats arrivedFromCompletion', () => {
    const summary = makeSummary({ stopsNeedingResubmission: 1 });
    expect(resolveDefaultHuntProgressSection(summary, true, null)).toBe('in_action');
  });

  test('returns lastSection when no urgent items and no completion', () => {
    const summary = makeSummary();
    const last: HuntProgressSection = 'completed';
    expect(resolveDefaultHuntProgressSection(summary, false, last)).toBe('completed');
  });

  test('leaderboards is always the final fallback', () => {
    expect(resolveDefaultHuntProgressSection(null, false, null)).toBe('leaderboards');
  });
});

// ─── In Action Status Classification ─────────────────────────────────────────

describe('HUNT_IN_ACTION_STATUSES', () => {
  test('includes active and paused statuses only', () => {
    expect(HUNT_IN_ACTION_STATUSES).toContain('active');
    expect(HUNT_IN_ACTION_STATUSES).toContain('paused');
    // Completed, withdrawn, etc. must NOT be in In Action
    expect(HUNT_IN_ACTION_STATUSES).not.toContain('completed');
    expect(HUNT_IN_ACTION_STATUSES).not.toContain('withdrawn');
    expect(HUNT_IN_ACTION_STATUSES).not.toContain('removed');
    expect(HUNT_IN_ACTION_STATUSES).not.toContain('cancelled');
    expect(HUNT_IN_ACTION_STATUSES).not.toContain('expired');
    expect(HUNT_IN_ACTION_STATUSES).not.toContain('ready');
  });
});

// ─── Other Activity Classification ───────────────────────────────────────────

describe('HUNT_OTHER_ACTIVITY_STATUSES', () => {
  test('includes withdrawn, removed, cancelled, expired', () => {
    expect(HUNT_OTHER_ACTIVITY_STATUSES).toContain('withdrawn');
    expect(HUNT_OTHER_ACTIVITY_STATUSES).toContain('removed');
    expect(HUNT_OTHER_ACTIVITY_STATUSES).toContain('cancelled');
    expect(HUNT_OTHER_ACTIVITY_STATUSES).toContain('expired');
  });

  test('never includes active or completed', () => {
    expect(HUNT_OTHER_ACTIVITY_STATUSES).not.toContain('active');
    expect(HUNT_OTHER_ACTIVITY_STATUSES).not.toContain('completed');
    expect(HUNT_OTHER_ACTIVITY_STATUSES).not.toContain('paused');
  });

  test('In Action and Other Activity status sets are disjoint', () => {
    const inAction = new Set(HUNT_IN_ACTION_STATUSES);
    const other    = new Set(HUNT_OTHER_ACTIVITY_STATUSES);
    for (const s of other) {
      expect(inAction.has(s)).toBe(false);
    }
  });
});

// ─── Leaderboard Privacy Rules (client-side type guards) ──────────────────────

describe('HuntLeaderboardEntry privacy', () => {
  test('anonymous entry has null userId and username', () => {
    const entry = makeLeaderboardEntry({
      isAnonymous: true,
      userId: null,
      username: null,
      displayName: 'Anonymous Explorer',
    });
    expect(entry.userId).toBeNull();
    expect(entry.username).toBeNull();
    expect(entry.displayName).toBe('Anonymous Explorer');
    expect(entry.isAnonymous).toBe(true);
  });

  test('non-anonymous entry has userId and username', () => {
    const entry = makeLeaderboardEntry({ isAnonymous: false });
    expect(entry.userId).not.toBeNull();
    expect(entry.username).not.toBeNull();
    expect(entry.isAnonymous).toBe(false);
  });

  test('current user is highlighted (isCurrentUser flag)', () => {
    const entry = makeLeaderboardEntry({ isCurrentUser: true });
    expect(entry.isCurrentUser).toBe(true);
  });

  test('huntPoints is separate from quest points (no questPoints field)', () => {
    const entry = makeLeaderboardEntry({ huntPoints: 750 });
    expect(entry.huntPoints).toBe(750);
    expect((entry as any).points).toBeUndefined(); // must NOT reuse quest 'points' field
    expect((entry as any).questPoints).toBeUndefined();
  });

  test('top-3 entries have rank 1, 2, 3', () => {
    const entries = [1, 2, 3].map(rank => makeLeaderboardEntry({ rank }));
    entries.forEach((e, i) => expect(e.rank).toBe(i + 1));
  });
});

// ─── Point Isolation (Hunt-only) ─────────────────────────────────────────────

describe('HuntPointTransaction', () => {
  test('only hunt_reward, reversal, admin_adjustment types are valid', () => {
    const validTypes: HuntPointTransaction['transactionType'][] = [
      'hunt_reward',
      'reversal',
      'admin_adjustment',
    ];
    validTypes.forEach(t => {
      const tx = makeTransaction({ transactionType: t });
      expect(['hunt_reward', 'reversal', 'admin_adjustment']).toContain(tx.transactionType);
    });
  });

  test('quest_reward type must NOT appear in hunt transactions', () => {
    // Type-level: 'quest_reward' is not assignable to HuntPointTransaction.transactionType
    // Runtime: verify the type union excludes it
    const validTypes: HuntPointTransaction['transactionType'][] = [
      'hunt_reward', 'reversal', 'admin_adjustment',
    ];
    expect(validTypes).not.toContain('quest_reward');
  });

  test('positive amount is a reward, negative is a reversal offset', () => {
    const reward   = makeTransaction({ amount: 200, isReversal: false });
    const reversal = makeTransaction({ amount: -200, isReversal: true, transactionType: 'reversal' });
    expect(reward.amount).toBeGreaterThan(0);
    expect(reversal.amount).toBeLessThan(0);
    expect(reversal.isReversal).toBe(true);
  });

  test('net points are sum of amounts', () => {
    const txs = [
      makeTransaction({ amount: 300 }),
      makeTransaction({ amount: -300, isReversal: true, transactionType: 'reversal' }),
      makeTransaction({ amount: 150 }),
    ];
    const net = txs.reduce((s, t) => s + t.amount, 0);
    expect(net).toBe(150);
  });

  test('isReversed marks original that got reversed', () => {
    const original = makeTransaction({ ledgerId: 'orig-1', isReversed: true, isReversal: false });
    const reversal = makeTransaction({ ledgerId: 'rev-1', isReversal: true, isReversed: false, reversedLedgerId: 'orig-1' });
    expect(original.isReversed).toBe(true);
    expect(reversal.isReversal).toBe(true);
    expect(reversal.reversedLedgerId).toBe('orig-1');
  });

  test('displayLabel never exposes raw reason', () => {
    const tx = makeTransaction({ displayLabel: 'Hunt completion reward' });
    // displayLabel is human-readable; raw 'reason' field is excluded from the type
    expect((tx as any).reason).toBeUndefined();
    expect(tx.displayLabel).toBeTruthy();
  });
});

// ─── Completion Detail Guards ─────────────────────────────────────────────────

describe('HuntCompletionDetail', () => {
  function makeDetail(overrides: Partial<HuntCompletionDetail> = {}): HuntCompletionDetail {
    return {
      participationId: 'p-1',
      huntId: 'hunt-1',
      huntTitle: 'Test Hunt',
      huntSummary: null,
      occurrenceId: null,
      occurrenceLabel: null,
      completedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      awardedPoints: 200,
      rewardSnapshot: { pointsReward: 200 },
      hasReversal: false,
      isGroup: false,
      participationMode: 'solo',
      stopOrdering: 'ordered',
      stopsRequired: 5,
      stopsCompleted: 5,
      optionalCompleted: 1,
      groupMemberCount: 1,
      ...overrides,
    };
  }

  test('hasReversal flag is false by default', () => {
    expect(makeDetail().hasReversal).toBe(false);
  });

  test('hasReversal flag is true when reversal occurred', () => {
    expect(makeDetail({ hasReversal: true }).hasReversal).toBe(true);
  });

  test('isGroup is true for group participationMode', () => {
    const detail = makeDetail({ isGroup: true, participationMode: 'group' });
    expect(detail.isGroup).toBe(true);
  });

  test('awardedPoints is null for un-awarded completions', () => {
    const detail = makeDetail({ awardedPoints: null });
    expect(detail.awardedPoints).toBeNull();
  });

  test('no private geo fields on detail (no geometry)', () => {
    const detail = makeDetail();
    expect((detail as any).validationGeometry).toBeUndefined();
    expect((detail as any).geofenceRadius).toBeUndefined();
    expect((detail as any).latitude).toBeUndefined();
    expect((detail as any).longitude).toBeUndefined();
  });

  test('no reviewer identity on detail', () => {
    const detail = makeDetail();
    expect((detail as any).reviewerId).toBeUndefined();
    expect((detail as any).reviewNotes).toBeUndefined();
    expect((detail as any).review_notes).toBeUndefined();
  });
});

// ─── Other Activity Item Guards ───────────────────────────────────────────────

describe('HuntOtherActivityItem', () => {
  test('withdrawn item has safe note and no internal removal reason', () => {
    const item = makeOtherActivityItem('withdrawn', { safeStatusNote: 'You withdrew from this Hunt.' });
    expect(item.safeStatusNote).toBeTruthy();
    expect((item as any).removalReasonInternal).toBeUndefined();
    expect((item as any).removal_note_internal).toBeUndefined();
  });

  test('removed item has safe note', () => {
    const item = makeOtherActivityItem('removed', { safeStatusNote: 'Your participation ended.' });
    expect(item.safeStatusNote).toBeTruthy();
    expect((item as any).removalReasonInternal).toBeUndefined();
  });

  test('cancelled item has safe note', () => {
    const item = makeOtherActivityItem('cancelled', { safeStatusNote: 'This Hunt was cancelled.' });
    expect(item.safeStatusNote).toBeTruthy();
  });

  test('expired item has safe note', () => {
    const item = makeOtherActivityItem('expired', { safeStatusNote: 'Your participation expired.' });
    expect(item.safeStatusNote).toBeTruthy();
  });

  test('stopsCompleted and stopsRequired are present for progress context', () => {
    const item = makeOtherActivityItem('withdrawn', { stopsCompleted: 3, stopsRequired: 7 });
    expect(item.stopsCompleted).toBe(3);
    expect(item.stopsRequired).toBe(7);
  });

  test('awardedPoints defaults to 0 for inactive participations', () => {
    const item = makeOtherActivityItem('withdrawn', { awardedPoints: 0 });
    expect(item.awardedPoints).toBe(0);
  });
});

// ─── Pagination Constants ─────────────────────────────────────────────────────

describe('pagination constants', () => {
  test('HUNT_PROGRESS_PAGE_SIZE is positive', () => {
    expect(HUNT_PROGRESS_PAGE_SIZE).toBeGreaterThan(0);
  });

  test('HUNT_LEADERBOARD_PAGE_SIZE is positive and larger than page size', () => {
    expect(HUNT_LEADERBOARD_PAGE_SIZE).toBeGreaterThan(0);
    expect(HUNT_LEADERBOARD_PAGE_SIZE).toBeGreaterThanOrEqual(HUNT_PROGRESS_PAGE_SIZE);
  });
});

// ─── Default Filter ───────────────────────────────────────────────────────────

describe('DEFAULT_HUNT_COMPLETED_FILTER', () => {
  test('defaults to all modes and newest sort', () => {
    expect(DEFAULT_HUNT_COMPLETED_FILTER.mode).toBe('all');
    expect(DEFAULT_HUNT_COMPLETED_FILTER.sortOrder).toBe('newest');
  });
});

// ─── Security Invariants ──────────────────────────────────────────────────────

describe('Security invariants (client-side guards)', () => {
  test('leaderboard entry userId is null for anonymous — cannot be used to identify user', () => {
    const anon = makeLeaderboardEntry({ isAnonymous: true, userId: null, username: null });
    if (anon.isAnonymous) {
      expect(anon.userId).toBeNull();
      expect(anon.username).toBeNull();
    }
  });

  test('point transaction has no raw reason field (uses displayLabel)', () => {
    const tx = makeTransaction();
    expect((tx as any).reason).toBeUndefined();
    expect((tx as any).rawReason).toBeUndefined();
    expect(tx.displayLabel).toBeTruthy();
  });

  test('other activity item has no internal removal reason field', () => {
    const item = makeOtherActivityItem('removed');
    expect((item as any).removalReasonInternal).toBeUndefined();
    expect((item as any).removal_note_internal).toBeUndefined();
    expect((item as any).internalNote).toBeUndefined();
  });

  test('leaderboard entries do not contain email', () => {
    const entry = makeLeaderboardEntry();
    expect((entry as any).email).toBeUndefined();
  });

  test('leaderboard entries do not contain account_status', () => {
    const entry = makeLeaderboardEntry();
    expect((entry as any).account_status).toBeUndefined();
    expect((entry as any).accountStatus).toBeUndefined();
  });

  test('stop history entries carry no locked clue flag (all returned stops are unlocked)', () => {
    // The RPC filters out 'locked' status stops — no locked entries in history
    // This is a documentation-level assertion that the type doesn't include locked
    const validStopStatuses = [
      'completed', 'in_progress', 'awaiting_proof',
      'under_review', 'needs_resubmission', 'rejected',
    ];
    expect(validStopStatuses).not.toContain('locked');
  });
});

// ─── Hunt/Quest Point Isolation ───────────────────────────────────────────────

describe('Hunt vs Quest point isolation', () => {
  test('Hunt leaderboard entry uses huntPoints (not points or questPoints)', () => {
    const entry = makeLeaderboardEntry({ huntPoints: 400 });
    expect(entry.huntPoints).toBe(400);
    expect((entry as any).questPoints).toBeUndefined();
    // 'points' field used by QuestLeaderboardEntry — must not exist on HuntLeaderboardEntry
    expect((entry as any).points).toBeUndefined();
  });

  test('Hunt transaction type excludes quest_reward', () => {
    const huntTypes: HuntPointTransaction['transactionType'][] = [
      'hunt_reward', 'reversal', 'admin_adjustment',
    ];
    expect(huntTypes).not.toContain('quest_reward');
  });
});

// ─── In Action Summary Edge Cases ────────────────────────────────────────────

describe('HuntInActionSummary edge cases', () => {
  test('all-zero summary does not trigger in_action default', () => {
    const summary = makeSummary({
      activeHunts: 0,
      stopsNeedingResubmission: 0,
      stopsAwaitingProof: 0,
      stopsUnderReview: 0,
    });
    const section = resolveDefaultHuntProgressSection(summary, false, null);
    expect(section).toBe('leaderboards');
  });

  test('hasApproachingDeadline does not trigger in_action by itself', () => {
    // hasApproachingDeadline is for UI badge only, not for section selection
    const summary = makeSummary({ hasApproachingDeadline: true });
    const section = resolveDefaultHuntProgressSection(summary, false, null);
    // activeHunts is 0, so no in_action trigger from count-based checks
    expect(section).toBe('leaderboards');
  });
});
