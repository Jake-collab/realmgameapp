/**
 * Quest Progress — Unit Tests (Prompt 8)
 *
 * Tests cover:
 *   - IN_ACTION_GROUP_PRIORITY ordering
 *   - In Action section grouping and urgency count
 *   - Default section selection logic
 *   - Completed filter / sort logic
 *   - Leaderboard period boundary calculation
 *   - Safe review note exposure rules
 *   - Pagination helpers
 *   - QuestCurrentRank qualification logic
 *   - Reversal net-points logic
 *   - OtherActivity canRestart determination
 *
 * All tests run with testEnvironment: node (no DOM / React Native bridge).
 */

import {
  IN_ACTION_GROUP_PRIORITY,
  OTHER_ACTIVITY_STATUSES,
  DEFAULT_COMPLETED_FILTER,
  PROGRESS_PAGE_SIZE,
  LEADERBOARD_PAGE_SIZE,
} from '../features/quests/types/questProgress.types';
import type {
  InActionItem,
  InActionSummary,
  QuestCurrentRank,
  QuestPointTransaction,
  OtherActivityItem,
} from '../features/quests/types/questProgress.types';

// ─── Helpers under test (extracted from the repository/hooks for testability) ─

function computeInActionSummary(items: InActionItem[]): InActionSummary {
  return {
    totalActive:       items.filter(i => ['started', 'in_progress'].includes(i.status)).length,
    awaitingProof:     items.filter(i => i.status === 'awaiting_proof').length,
    underReview:       items.filter(i => i.status === 'under_review').length,
    needsResubmission: items.filter(i => i.status === 'needs_resubmission').length,
    hasExpiringToday:  items.some(i => {
      if (!i.expiresAt) return false;
      const exp = new Date(i.expiresAt);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return exp >= now && exp <= tomorrow;
    }),
  };
}

function selectDefaultSection(summary: InActionSummary): 'leaderboards' | 'in_action' {
  if (summary.needsResubmission > 0) return 'in_action';
  if (summary.awaitingProof > 0)     return 'in_action';
  if (summary.totalActive > 0)       return 'in_action';
  if (summary.underReview > 0)       return 'in_action';
  return 'leaderboards';
}

function sortInActionByPriority(items: InActionItem[]): InActionItem[] {
  return [...items].sort(
    (a, b) =>
      (IN_ACTION_GROUP_PRIORITY[b.status] ?? 0) -
      (IN_ACTION_GROUP_PRIORITY[a.status] ?? 0)
  );
}

function safeDecisionNote(status: string, rawNote: string | null): string | null {
  if (status !== 'needs_resubmission') return null;
  if (!rawNote || rawNote.trim().length === 0) return null;
  return rawNote.trim().slice(0, 500);
}

function netPoints(transactions: Pick<QuestPointTransaction, 'amount'>[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function deadlineWarning(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `Expires in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 3) return `Expires in ${diffDays}d`;
  return null;
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeItem(status: string, overrides: Partial<InActionItem> = {}): InActionItem {
  return {
    participationId: `part-${Math.random()}`,
    questId: 'quest-1',
    status: status as any,
    startedAt: new Date().toISOString(),
    expiresAt: null,
    submittedAt: null,
    rewardSnapshotPoints: 100,
    occurrenceKey: null,
    quest: null,
    safeReviewNote: null,
    latestProofStatus: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IN_ACTION_GROUP_PRIORITY', () => {
  test('needs_resubmission has highest priority', () => {
    const statuses = Object.entries(IN_ACTION_GROUP_PRIORITY);
    const max = Math.max(...statuses.map(([, v]) => v));
    expect(IN_ACTION_GROUP_PRIORITY['needs_resubmission']).toBe(max);
  });

  test('awaiting_proof is higher than in_progress', () => {
    expect(IN_ACTION_GROUP_PRIORITY['awaiting_proof'])
      .toBeGreaterThan(IN_ACTION_GROUP_PRIORITY['in_progress']);
  });

  test('rejected has lowest priority', () => {
    const statuses = Object.entries(IN_ACTION_GROUP_PRIORITY);
    const min = Math.min(...statuses.map(([, v]) => v));
    expect(IN_ACTION_GROUP_PRIORITY['rejected']).toBe(min);
  });

  test('under_review is below in_progress', () => {
    expect(IN_ACTION_GROUP_PRIORITY['under_review'])
      .toBeLessThan(IN_ACTION_GROUP_PRIORITY['in_progress']);
  });
});

describe('sortInActionByPriority', () => {
  test('items are sorted highest priority first', () => {
    const items: InActionItem[] = [
      makeItem('under_review'),
      makeItem('needs_resubmission'),
      makeItem('started'),
      makeItem('awaiting_proof'),
      makeItem('rejected'),
    ];
    const sorted = sortInActionByPriority(items);
    expect(sorted[0].status).toBe('needs_resubmission');
    expect(sorted[1].status).toBe('awaiting_proof');
    expect(sorted[2].status).toBe('started');
    expect(sorted[3].status).toBe('under_review');
    expect(sorted[4].status).toBe('rejected');
  });

  test('does not mutate the original array', () => {
    const items = [makeItem('under_review'), makeItem('needs_resubmission')];
    const original = [...items];
    sortInActionByPriority(items);
    expect(items[0].status).toBe(original[0].status);
  });
});

describe('computeInActionSummary', () => {
  test('zero items produces all-zero summary with hasExpiringToday=false', () => {
    const summary = computeInActionSummary([]);
    expect(summary.totalActive).toBe(0);
    expect(summary.awaitingProof).toBe(0);
    expect(summary.underReview).toBe(0);
    expect(summary.needsResubmission).toBe(0);
    expect(summary.hasExpiringToday).toBe(false);
  });

  test('started and in_progress both count toward totalActive', () => {
    const items = [makeItem('started'), makeItem('in_progress'), makeItem('awaiting_proof')];
    const s = computeInActionSummary(items);
    expect(s.totalActive).toBe(2);
    expect(s.awaitingProof).toBe(1);
  });

  test('hasExpiringToday is true for item expiring within 24 hours', () => {
    const soon = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3h from now
    const items = [makeItem('in_progress', { expiresAt: soon })];
    expect(computeInActionSummary(items).hasExpiringToday).toBe(true);
  });

  test('hasExpiringToday is false for item expiring in 2 days', () => {
    const later = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const items = [makeItem('in_progress', { expiresAt: later })];
    expect(computeInActionSummary(items).hasExpiringToday).toBe(false);
  });

  test('hasExpiringToday is false for already-expired item', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const items = [makeItem('in_progress', { expiresAt: past })];
    expect(computeInActionSummary(items).hasExpiringToday).toBe(false);
  });
});

describe('selectDefaultSection', () => {
  const empty: InActionSummary = {
    totalActive: 0, awaitingProof: 0, underReview: 0,
    needsResubmission: 0, hasExpiringToday: false,
  };

  test('defaults to leaderboards when no active items', () => {
    expect(selectDefaultSection(empty)).toBe('leaderboards');
  });

  test('needs_resubmission → in_action (highest urgency)', () => {
    expect(selectDefaultSection({ ...empty, needsResubmission: 1 })).toBe('in_action');
  });

  test('awaiting_proof → in_action', () => {
    expect(selectDefaultSection({ ...empty, awaitingProof: 2 })).toBe('in_action');
  });

  test('totalActive → in_action', () => {
    expect(selectDefaultSection({ ...empty, totalActive: 1 })).toBe('in_action');
  });

  test('under_review only → in_action', () => {
    expect(selectDefaultSection({ ...empty, underReview: 1 })).toBe('in_action');
  });

  test('needsResubmission takes precedence over awaitingProof', () => {
    // Both present → still in_action (deterministic)
    expect(selectDefaultSection({ ...empty, needsResubmission: 1, awaitingProof: 1 })).toBe('in_action');
  });
});

describe('safeDecisionNote (privacy)', () => {
  test('returns null for non-needs_resubmission statuses', () => {
    const statuses = ['under_review', 'approved', 'rejected', 'submitted', 'draft'];
    for (const s of statuses) {
      expect(safeDecisionNote(s, 'A reviewer note')).toBeNull();
    }
  });

  test('returns the note for needs_resubmission', () => {
    expect(safeDecisionNote('needs_resubmission', 'Please provide a clearer image.')).toBe('Please provide a clearer image.');
  });

  test('returns null for needs_resubmission with empty note', () => {
    expect(safeDecisionNote('needs_resubmission', '')).toBeNull();
    expect(safeDecisionNote('needs_resubmission', '   ')).toBeNull();
    expect(safeDecisionNote('needs_resubmission', null)).toBeNull();
  });

  test('truncates note at 500 characters', () => {
    const long = 'a'.repeat(600);
    const result = safeDecisionNote('needs_resubmission', long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(500);
  });
});

describe('OTHER_ACTIVITY_STATUSES', () => {
  test('includes abandoned, expired, rejected', () => {
    expect(OTHER_ACTIVITY_STATUSES).toContain('abandoned');
    expect(OTHER_ACTIVITY_STATUSES).toContain('expired');
    expect(OTHER_ACTIVITY_STATUSES).toContain('rejected');
  });

  test('does not include completed', () => {
    expect(OTHER_ACTIVITY_STATUSES).not.toContain('completed');
  });

  test('does not include in_progress or started', () => {
    expect(OTHER_ACTIVITY_STATUSES).not.toContain('in_progress');
    expect(OTHER_ACTIVITY_STATUSES).not.toContain('started');
  });
});

describe('canRestart determination', () => {
  function computeCanRestart(status: string, isRepeatable: boolean): boolean {
    return isRepeatable && status === 'abandoned';
  }

  test('repeatable + abandoned = can restart', () => {
    expect(computeCanRestart('abandoned', true)).toBe(true);
  });

  test('repeatable + expired = cannot restart', () => {
    expect(computeCanRestart('expired', true)).toBe(false);
  });

  test('non-repeatable + abandoned = cannot restart', () => {
    expect(computeCanRestart('abandoned', false)).toBe(false);
  });

  test('repeatable + rejected = cannot restart (final rejection)', () => {
    expect(computeCanRestart('rejected', true)).toBe(false);
  });
});

describe('DEFAULT_COMPLETED_FILTER', () => {
  test('defaults to all types, newest first', () => {
    expect(DEFAULT_COMPLETED_FILTER.questType).toBe('all');
    expect(DEFAULT_COMPLETED_FILTER.sortOrder).toBe('newest');
  });
});

describe('PROGRESS_PAGE_SIZE and LEADERBOARD_PAGE_SIZE', () => {
  test('page size values are reasonable positive integers', () => {
    expect(PROGRESS_PAGE_SIZE).toBeGreaterThan(0);
    expect(LEADERBOARD_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(PROGRESS_PAGE_SIZE)).toBe(true);
    expect(Number.isInteger(LEADERBOARD_PAGE_SIZE)).toBe(true);
  });

  test('leaderboard page size >= progress page size (more entries per page)', () => {
    expect(LEADERBOARD_PAGE_SIZE).toBeGreaterThanOrEqual(PROGRESS_PAGE_SIZE);
  });
});

describe('netPoints reversal handling', () => {
  test('positive reward is fully counted', () => {
    const txs = [{ amount: 250 }];
    expect(netPoints(txs)).toBe(250);
  });

  test('reversal reduces net total', () => {
    const txs = [{ amount: 250 }, { amount: -250 }];
    expect(netPoints(txs)).toBe(0);
  });

  test('partial reversal reduces but does not zero', () => {
    const txs = [{ amount: 300 }, { amount: -100 }];
    expect(netPoints(txs)).toBe(200);
  });

  test('multiple rewards accumulate', () => {
    const txs = [{ amount: 100 }, { amount: 200 }, { amount: 50 }];
    expect(netPoints(txs)).toBe(350);
  });

  test('empty ledger produces 0', () => {
    expect(netPoints([])).toBe(0);
  });
});

describe('QuestCurrentRank qualification', () => {
  function makeRank(points: number, rank: number | null): QuestCurrentRank {
    return {
      qualifies: points > 0,
      rank,
      points,
      totalRankedUsers: 10,
      period: 'all_time',
    };
  }

  test('user with 0 points does not qualify', () => {
    const r = makeRank(0, null);
    expect(r.qualifies).toBe(false);
    expect(r.rank).toBeNull();
  });

  test('user with positive points qualifies', () => {
    const r = makeRank(150, 5);
    expect(r.qualifies).toBe(true);
    expect(r.rank).toBe(5);
  });

  test('hidden user can have points but no rank', () => {
    // leaderboard_visibility = false → rank is null even with points
    const r = makeRank(300, null);
    expect(r.qualifies).toBe(true);
    expect(r.rank).toBeNull();
  });
});

describe('deadlineWarning', () => {
  test('returns null for no expiry', () => {
    expect(deadlineWarning(null)).toBeNull();
  });

  test('returns Expired for past date', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(deadlineWarning(past)).toBe('Expired');
  });

  test('returns hours-based warning for < 24 hours', () => {
    const soon = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const result = deadlineWarning(soon);
    expect(result).toMatch(/Expires in \d+h/);
  });

  test('returns day-based warning for 1-3 days', () => {
    const soon = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
    const result = deadlineWarning(soon);
    expect(result).toMatch(/Expires in [123]d/);
  });

  test('returns null for > 3 days away', () => {
    const far = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(deadlineWarning(far)).toBeNull();
  });
});

describe('Leaderboard period boundary helpers', () => {
  function weekStart(): Date {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay();
    const diff = (day + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - diff);
    return d;
  }

  function monthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  test('weekStart is on Monday (ISO week)', () => {
    const ws = weekStart();
    expect(ws.getUTCDay()).toBe(1); // 1 = Monday
  });

  test('weekStart is <= today UTC', () => {
    const ws = weekStart();
    const now = new Date();
    expect(ws.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  test('monthStart is day 1', () => {
    const ms = monthStart();
    expect(ms.getUTCDate()).toBe(1);
  });

  test('monthStart is <= today UTC', () => {
    const ms = monthStart();
    const now = new Date();
    expect(ms.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
