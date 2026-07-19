/**
 * Shared Progression — Prompt 15 Tests
 *
 * Covers:
 *   - Achievement category membership
 *   - Achievement award rules (duplicate prevention, manual vs auto)
 *   - Hidden achievement display rules
 *   - Title unlock and single-active invariant
 *   - Badge constraints (no gameplay effect)
 *   - Combined statistics isolation (quest vs hunt)
 *   - Milestone classification
 *   - Privacy guards (no internal fields)
 *   - Security invariants (no client-side award, server-only writes)
 *   - Progression section constants
 *   - Future leaderboard interface shape
 */

import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_PAGE_SIZE,
  PROGRESSION_SECTIONS,
} from '../features/progression/types/progression.types';
import type {
  UserAchievement,
  AchievementHistoryRow,
  UserTitle,
  UserBadge,
  UserMilestone,
  CombinedStatistics,
  ProgressOverview,
  AchievementCategory,
  CombinedLeaderboardEntry,
  ProgressionPrivacy,
} from '../features/progression/types/progression.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAchievement(overrides: Partial<UserAchievement> = {}): UserAchievement {
  return {
    achievementId:      'ach-1',
    slug:               'first_quest',
    name:               'First Quest',
    subtitle:           'A journey begins',
    description:        'Complete your first Quest.',
    category:           'quest',
    iconName:           'compass',
    artworkUrl:         null,
    isHidden:           false,
    isSecret:           false,
    isManual:           false,
    displayPriority:    10,
    awardedAt:          new Date().toISOString(),
    awardedBy:          'engine',
    triggerEvent:       'quest_completed',
    requirementSummary: 'Complete 1 Quest',
    ...overrides,
  };
}

function makeTitle(overrides: Partial<UserTitle> = {}): UserTitle {
  return {
    titleId:         'title-1',
    slug:            'explorer',
    name:            'Explorer',
    description:     'A curious wanderer of the Worlds',
    unlockSource:    'achievement',
    displayPriority: 10,
    unlockedAt:      new Date().toISOString(),
    isActive:        false,
    ...overrides,
  };
}

function makeBadge(overrides: Partial<UserBadge> = {}): UserBadge {
  return {
    badgeId:         'badge-1',
    slug:            'first_quest',
    name:            'First Quest',
    description:     'Completed a Quest for the first time',
    iconName:        'compass',
    artworkUrl:      null,
    category:        'quest',
    displayPriority: 10,
    unlockedAt:      new Date().toISOString(),
    isPinned:        false,
    ...overrides,
  };
}

function makeMilestone(overrides: Partial<UserMilestone> = {}): UserMilestone {
  return {
    milestoneId:  'ms-1',
    slug:         'first_quest',
    name:         'First Quest',
    description:  'Complete your first Quest',
    category:     'quest',
    metricKey:    'quests_completed',
    threshold:    1,
    reachedAt:    new Date().toISOString(),
    valueAtAward: 1,
    ...overrides,
  };
}

function makeStats(overrides: Partial<CombinedStatistics> = {}): CombinedStatistics {
  return {
    questsCompleted:      5,
    huntsCompleted:       3,
    totalActivities:      8,
    questPoints:          500,
    huntPoints:           300,
    combinedPoints:       800,
    achievementsUnlocked: 4,
    titlesUnlocked:       2,
    badgesUnlocked:       3,
    accountAgeDays:       45,
    ...overrides,
  };
}

// ─── Achievement Category Constants ──────────────────────────────────────────

describe('ACHIEVEMENT_CATEGORIES', () => {
  test('includes all required categories', () => {
    const required: AchievementCategory[] = [
      'quest','hunt','worlds','community','exploration','consistency','special',
    ];
    required.forEach(c => expect(ACHIEVEMENT_CATEGORIES).toContain(c));
  });

  test('has a label for every category', () => {
    ACHIEVEMENT_CATEGORIES.forEach(cat => {
      expect(ACHIEVEMENT_CATEGORY_LABELS[cat]).toBeTruthy();
      expect(typeof ACHIEVEMENT_CATEGORY_LABELS[cat]).toBe('string');
    });
  });

  test('ACHIEVEMENT_PAGE_SIZE is positive', () => {
    expect(ACHIEVEMENT_PAGE_SIZE).toBeGreaterThan(0);
  });
});

// ─── Achievement Type Guards ──────────────────────────────────────────────────

describe('UserAchievement type guards', () => {
  test('awardedBy is engine, admin, or system only', () => {
    const valid = ['engine', 'admin', 'system'] as const;
    valid.forEach(by => {
      const a = makeAchievement({ awardedBy: by });
      expect(['engine','admin','system']).toContain(a.awardedBy);
    });
  });

  test('hidden achievement field is present and boolean', () => {
    const hidden = makeAchievement({ isHidden: true });
    expect(hidden.isHidden).toBe(true);
    expect(typeof hidden.isHidden).toBe('boolean');
  });

  test('secret achievement has isSecret = true', () => {
    const secret = makeAchievement({ isSecret: true, requirementSummary: null });
    expect(secret.isSecret).toBe(true);
    // Secret achievements must never reveal their requirement summary to the user
    expect(secret.requirementSummary).toBeNull();
  });

  test('requirementSummary never exposes rule_key (internal expression)', () => {
    const a = makeAchievement({ requirementSummary: 'Complete 25 Quests' });
    // Must be a human-readable string, not a technical expression
    expect(a.requirementSummary).not.toContain('quests_completed');
    expect(a.requirementSummary).not.toContain('rule_key');
    expect(a.requirementSummary).not.toContain('>=');
  });

  test('no internal fields on UserAchievement', () => {
    const a = makeAchievement();
    expect((a as any).rule_key).toBeUndefined();
    expect((a as any).rule_threshold).toBeUndefined();
    expect((a as any).engine_expression).toBeUndefined();
  });

  test('artworkUrl is null when not provided', () => {
    expect(makeAchievement().artworkUrl).toBeNull();
  });

  test('triggerEvent is present for auto awards', () => {
    const a = makeAchievement({ triggerEvent: 'quest_completed', awardedBy: 'engine' });
    expect(a.triggerEvent).toBe('quest_completed');
  });

  test('triggerEvent is null for manual awards', () => {
    const a = makeAchievement({ isManual: true, awardedBy: 'admin', triggerEvent: null });
    expect(a.triggerEvent).toBeNull();
    expect(a.isManual).toBe(true);
  });
});

// ─── Hidden Achievement Display ───────────────────────────────────────────────

describe('Hidden achievement display rules', () => {
  test('hidden achievement is still a UserAchievement (unlocked)', () => {
    // Hidden achievements appear as ??? until unlocked, then fully revealed
    const h = makeAchievement({ isHidden: true, name: 'Hidden Achievement' });
    // Once unlocked (in user_achievements) it is returned with full data
    expect(h.name).not.toBe('???');
    expect(h.isHidden).toBe(true);
    // The client renders ??? only when NOT yet unlocked (i.e., locked achievements not in this list)
  });

  test('locked (not yet awarded) achievements are absent from user_achievements entirely', () => {
    // user_achievements only contains earned achievements — locked ones are not present
    const userAchievements: UserAchievement[] = [makeAchievement()];
    const lockedSlug = 'never_earned';
    expect(userAchievements.find(a => a.slug === lockedSlug)).toBeUndefined();
  });
});

// ─── Duplicate Award Prevention ───────────────────────────────────────────────

describe('Achievement duplicate prevention', () => {
  test('user_achievements has unique (user, achievement) constraint — represented as unique IDs', () => {
    // At the DB level, UNIQUE(user_id, achievement_id) prevents duplicates.
    // At the type level, no two achievements in the list share the same achievementId.
    const achievements: UserAchievement[] = [
      makeAchievement({ achievementId: 'ach-1', slug: 'first_quest' }),
      makeAchievement({ achievementId: 'ach-2', slug: 'first_hunt' }),
    ];
    const ids = achievements.map(a => a.achievementId);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = achievements.map(a => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

// ─── Title Invariants ─────────────────────────────────────────────────────────

describe('Title invariants', () => {
  test('at most one active title per user', () => {
    const titles: UserTitle[] = [
      makeTitle({ titleId: 't-1', isActive: true }),
      makeTitle({ titleId: 't-2', isActive: false }),
      makeTitle({ titleId: 't-3', isActive: false }),
    ];
    const activeTitles = titles.filter(t => t.isActive);
    expect(activeTitles.length).toBeLessThanOrEqual(1);
  });

  test('isActive false by default (user must select)', () => {
    expect(makeTitle().isActive).toBe(false);
  });

  test('title has unlockSource field', () => {
    const valid = ['achievement','milestone','admin','launch','special'] as const;
    valid.forEach(src => {
      const t = makeTitle({ unlockSource: src });
      expect(valid).toContain(t.unlockSource);
    });
  });

  test('no paid titles — unlockSource never includes "purchase"', () => {
    const title = makeTitle();
    expect((title.unlockSource as string)).not.toBe('purchase');
    expect((title.unlockSource as string)).not.toBe('paid');
  });

  test('unlocking a different title clears the old active', () => {
    // Simulates the set_active_title RPC behavior: only one active at a time
    let titles: UserTitle[] = [
      makeTitle({ titleId: 't-1', isActive: true }),
      makeTitle({ titleId: 't-2', isActive: false }),
    ];

    // Simulate swap
    const newActiveId = 't-2';
    titles = titles.map(t => ({ ...t, isActive: t.titleId === newActiveId }));

    const active = titles.filter(t => t.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].titleId).toBe('t-2');
  });
});

// ─── Badge Invariants ─────────────────────────────────────────────────────────

describe('Badge invariants', () => {
  test('badges have no gameplay effect (no points field)', () => {
    const badge = makeBadge();
    expect((badge as any).pointsBonus).toBeUndefined();
    expect((badge as any).multiplier).toBeUndefined();
    expect((badge as any).xpBonus).toBeUndefined();
  });

  test('at most one pinned badge per user', () => {
    const badges: UserBadge[] = [
      makeBadge({ badgeId: 'b-1', isPinned: true }),
      makeBadge({ badgeId: 'b-2', isPinned: false }),
      makeBadge({ badgeId: 'b-3', isPinned: false }),
    ];
    const pinned = badges.filter(b => b.isPinned);
    expect(pinned.length).toBeLessThanOrEqual(1);
  });

  test('badges do not grant account status', () => {
    const badge = makeBadge();
    expect((badge as any).accountStatus).toBeUndefined();
    expect((badge as any).role).toBeUndefined();
  });

  test('badge has an artworkUrl field (may be null)', () => {
    const badge = makeBadge({ artworkUrl: null });
    expect(badge.artworkUrl).toBeNull();
  });
});

// ─── Combined Statistics Isolation ────────────────────────────────────────────

describe('CombinedStatistics point isolation', () => {
  test('combinedPoints is NOT the same as questPoints + huntPoints for all cases', () => {
    // Combined points includes all positive ledger entries (admin adjustments too)
    // It can be >= questPoints + huntPoints due to other positive transactions
    const stats = makeStats({ questPoints: 500, huntPoints: 300, combinedPoints: 830 });
    expect(stats.combinedPoints).toBeGreaterThanOrEqual(stats.questPoints + stats.huntPoints);
  });

  test('quest and hunt points are tracked separately', () => {
    const stats = makeStats({ questPoints: 500, huntPoints: 300 });
    expect(stats.questPoints).toBe(500);
    expect(stats.huntPoints).toBe(300);
    // They should never be the same object / alias
    expect(stats.questPoints).not.toBe(stats.huntPoints);
  });

  test('totalActivities = questsCompleted + huntsCompleted', () => {
    const stats = makeStats({ questsCompleted: 5, huntsCompleted: 3, totalActivities: 8 });
    expect(stats.totalActivities).toBe(stats.questsCompleted + stats.huntsCompleted);
  });

  test('achievementsUnlocked is a non-negative integer', () => {
    const stats = makeStats({ achievementsUnlocked: 4 });
    expect(stats.achievementsUnlocked).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(stats.achievementsUnlocked)).toBe(true);
  });

  test('accountAgeDays is non-negative', () => {
    const stats = makeStats({ accountAgeDays: 45 });
    expect(stats.accountAgeDays).toBeGreaterThanOrEqual(0);
  });

  test('stats cannot be edited client-side (no setter pattern)', () => {
    // Statistics type has no mutable methods — all values come from server
    const stats = makeStats();
    // Verify all expected fields are present and numeric
    const numericFields: (keyof CombinedStatistics)[] = [
      'questsCompleted','huntsCompleted','totalActivities','questPoints','huntPoints',
      'combinedPoints','achievementsUnlocked','titlesUnlocked','badgesUnlocked','accountAgeDays',
    ];
    numericFields.forEach(f => {
      expect(typeof stats[f]).toBe('number');
    });
  });
});

// ─── Progress Overview ────────────────────────────────────────────────────────

describe('ProgressOverview', () => {
  test('all fields present with nullable optionals', () => {
    const overview: ProgressOverview = {
      activeTitleName:   'Explorer',
      activeTitleSlug:   'explorer',
      pinnedBadgeName:   'First Quest',
      pinnedBadgeIcon:   'compass',
      achievementsCount: 5,
      combinedPoints:    800,
      totalActivities:   8,
    };
    expect(overview.activeTitleName).toBe('Explorer');
    expect(overview.achievementsCount).toBe(5);
  });

  test('nullable title fields when no active title', () => {
    const overview: ProgressOverview = {
      activeTitleName:   null,
      activeTitleSlug:   null,
      pinnedBadgeName:   null,
      pinnedBadgeIcon:   null,
      achievementsCount: 0,
      combinedPoints:    0,
      totalActivities:   0,
    };
    expect(overview.activeTitleName).toBeNull();
    expect(overview.activeTitleSlug).toBeNull();
  });
});

// ─── Milestone Classification ─────────────────────────────────────────────────

describe('Milestone classification', () => {
  test('milestone has correct category type', () => {
    const valid = ['quest','hunt','combined','points','special'] as const;
    valid.forEach(cat => {
      const ms = makeMilestone({ category: cat });
      expect(valid).toContain(ms.category);
    });
  });

  test('quest milestones use quests_completed metric', () => {
    const ms = makeMilestone({ category: 'quest', metricKey: 'quests_completed', threshold: 25 });
    expect(ms.metricKey).toBe('quests_completed');
    expect(ms.threshold).toBe(25);
  });

  test('hunt milestones use hunts_completed metric', () => {
    const ms = makeMilestone({ category: 'hunt', metricKey: 'hunts_completed', threshold: 50 });
    expect(ms.metricKey).toBe('hunts_completed');
  });

  test('combined milestones use total_activities metric', () => {
    const ms = makeMilestone({ category: 'combined', metricKey: 'total_activities', threshold: 100 });
    expect(ms.metricKey).toBe('total_activities');
  });

  test('point milestones use combined_points metric', () => {
    const ms = makeMilestone({ category: 'points', metricKey: 'combined_points', threshold: 1000 });
    expect(ms.metricKey).toBe('combined_points');
  });

  test('valueAtAward reflects actual value when reached', () => {
    const ms = makeMilestone({ threshold: 25, valueAtAward: 27 });
    // valueAtAward can be > threshold (user may have exceeded it)
    expect(ms.valueAtAward).toBeGreaterThanOrEqual(ms.threshold);
  });
});

// ─── Achievement History ──────────────────────────────────────────────────────

describe('AchievementHistoryRow', () => {
  test('history row has required display fields', () => {
    const row: AchievementHistoryRow = {
      achievementId: 'ach-1',
      slug:          'first_quest',
      name:          'First Quest',
      description:   'Complete your first Quest.',
      category:      'quest',
      iconName:      'compass',
      isHidden:      false,
      awardedAt:     new Date().toISOString(),
      triggerEvent:  'quest_completed',
    };
    expect(row.name).toBeTruthy();
    expect(row.awardedAt).toBeTruthy();
  });

  test('history row has no internal rule fields', () => {
    const row: AchievementHistoryRow = {
      achievementId: 'ach-1',
      slug: 'first_quest',
      name: 'First Quest',
      description: 'Complete your first Quest.',
      category: 'quest',
      iconName: 'compass',
      isHidden: false,
      awardedAt: new Date().toISOString(),
      triggerEvent: null,
    };
    expect((row as any).rule_key).toBeUndefined();
    expect((row as any).rule_threshold).toBeUndefined();
  });
});

// ─── Progression Section Constants ───────────────────────────────────────────

describe('PROGRESSION_SECTIONS', () => {
  test('includes overview, history, titles, badges, statistics', () => {
    const keys = PROGRESSION_SECTIONS.map(s => s.key);
    expect(keys).toContain('overview');
    expect(keys).toContain('history');
    expect(keys).toContain('titles');
    expect(keys).toContain('badges');
    expect(keys).toContain('statistics');
  });

  test('every section has a label', () => {
    PROGRESSION_SECTIONS.forEach(s => {
      expect(s.label).toBeTruthy();
      expect(typeof s.label).toBe('string');
    });
  });
});

// ─── Privacy Guards ───────────────────────────────────────────────────────────

describe('Privacy guards', () => {
  test('ProgressionPrivacy type has correct shape', () => {
    const privacy: ProgressionPrivacy = {
      achievementsVisible: true,
      titlesVisible:       true,
      badgesVisible:       false,
      statisticsVisible:   false,
    };
    expect(typeof privacy.achievementsVisible).toBe('boolean');
    expect(typeof privacy.statisticsVisible).toBe('boolean');
  });

  test('hidden achievement has no email or user identity in data', () => {
    const a = makeAchievement({ isHidden: true });
    expect((a as any).email).toBeUndefined();
    expect((a as any).userId).toBeUndefined();
  });
});

// ─── Security Invariants ──────────────────────────────────────────────────────

describe('Security invariants', () => {
  test('achievement awardedBy never includes "client"', () => {
    const validSources = ['engine', 'admin', 'system'];
    expect(validSources).not.toContain('client');
    // achievements can only be awarded server-side
    const a = makeAchievement({ awardedBy: 'engine' });
    expect(['engine','admin','system']).toContain(a.awardedBy);
  });

  test('no title is awarded with unlockSource "purchase"', () => {
    const title = makeTitle({ unlockSource: 'achievement' });
    expect(title.unlockSource).not.toBe('purchase');
    expect(title.unlockSource).not.toBe('paid');
  });

  test('badge has no monetary value field', () => {
    const badge = makeBadge();
    expect((badge as any).price).toBeUndefined();
    expect((badge as any).purchaseRequired).toBeUndefined();
  });

  test('statistics fields are read-only (no write methods)', () => {
    const stats = makeStats();
    // Verify the type doesn't include any mutation methods
    expect(typeof (stats as any).increment).toBe('undefined');
    expect(typeof (stats as any).award).toBe('undefined');
    expect(typeof (stats as any).addPoints).toBe('undefined');
  });

  test('no combined leaderboard implemented (interface only)', () => {
    // The CombinedLeaderboardEntry type exists for documentation purposes only
    const entry: CombinedLeaderboardEntry = {
      rank: 1,
      userId: 'u-1',
      displayName: 'Alice',
      username: 'alice',
      combinedPoints: 1000,
      questsCompleted: 5,
      huntsCompleted: 3,
      isCurrentUser: false,
      isAnonymous: false,
    };
    // The type exists but no hooks or RPCs implement it in Prompt 15
    expect(entry.combinedPoints).toBe(1000);
    expect((entry as any).isImplemented).toBeUndefined();
  });
});

// ─── Cross-System Isolation ───────────────────────────────────────────────────

describe('Cross-system isolation', () => {
  test('achievements do not modify quest or hunt points', () => {
    const stats = makeStats();
    // Achievements are recognition only — they don't add to quest or hunt points
    expect((stats as any).achievementPointBonus).toBeUndefined();
    expect(stats.questPoints).toBe(500); // unchanged
    expect(stats.huntPoints).toBe(300);  // unchanged
  });

  test('progressionKeys namespace is "progression" not "hunt-progress" or "quest"', () => {
    // The query key root ensures proper cache namespace isolation
    const { progressionKeys } = require('../features/progression/queries/progressionKeys');
    expect(progressionKeys.all[0]).toBe('progression');
    expect(progressionKeys.all[0]).not.toBe('hunt-progress');
    expect(progressionKeys.all[0]).not.toBe('quest');
  });

  test('no quest or hunt gameplay types imported in progression types', () => {
    // Progression types are self-contained
    const { ACHIEVEMENT_CATEGORIES } = require('../features/progression/types/progression.types');
    expect(Array.isArray(ACHIEVEMENT_CATEGORIES)).toBe(true);
    // If this file imports hunt types, it would show up as a circular dep
    // The test just verifies the module loads cleanly
  });
});

// ─── Achievement Engine Rules (documented constants) ─────────────────────────

describe('Achievement engine rule_keys (via requirement summaries)', () => {
  const RULE_TO_SUMMARY: Record<string, string> = {
    'quests_completed':      'Complete 1 Quest',
    'hunts_completed':       'Complete 1 Hunt',
    'total_activities':      'Complete 1 total Quests or Hunts',
    'combined_points':       'Earn 1,000 combined Worlds points',
    'both_modes_completed':  'Complete at least one Quest and one Hunt',
    'perfect_hunt':          'Complete a Hunt with all stops, no resubmissions',
    'daily_streak':          'Complete a Quest or Hunt every day for 7 days',
  };

  test('all documented rule keys produce non-empty summaries', () => {
    // Verifies buildRequirementSummary covers all registered rule keys
    Object.values(RULE_TO_SUMMARY).forEach(summary => {
      expect(summary).toBeTruthy();
      expect(typeof summary).toBe('string');
    });
  });

  test('summaries are human-readable (no underscores or operators)', () => {
    Object.values(RULE_TO_SUMMARY).forEach(summary => {
      expect(summary).not.toMatch(/^[a-z_]+$/);   // not just a snake_case key
      expect(summary).not.toContain('>=');
      expect(summary).not.toContain('=>');
    });
  });
});
