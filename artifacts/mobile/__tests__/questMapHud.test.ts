import {
  buildQuestMapHudProgress,
  getFocusedActiveParticipation,
} from '../features/quest-map/utils/questMapHud';

const baseQuest = {
  verification_methods: [],
  proof_type: 'none',
  location_requirement_type: 'none',
  required_distance_meters: null,
  quest_objectives: [],
} as any;

const baseParticipation = {
  status: 'in_progress',
  activity_distance_meters: 0,
  verification_earliest_completion_at: null,
} as any;

function progress(overrides: {
  quest?: Record<string, unknown>;
  participation?: Record<string, unknown>;
  stepProgress?: Array<Record<string, unknown>>;
  now?: number;
} = {}) {
  return buildQuestMapHudProgress({
    quest: { ...baseQuest, ...overrides.quest } as any,
    participation: { ...baseParticipation, ...overrides.participation } as any,
    stepProgress: (overrides.stepProgress ?? []) as any,
    now: overrides.now,
  });
}

describe('Quest Map HUD progress', () => {
  test('shows discrete required objective progress without inventing completion', () => {
    const result = progress({
      quest: {
        quest_objectives: [
          { id: 'one', is_required: true, location_requirement_type: 'none' },
          { id: 'two', is_required: true, location_requirement_type: 'none' },
        ],
      },
      stepProgress: [{ quest_step_id: 'one', status: 'completed' }],
    });

    expect(result.objective).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(result.readiness).toBe('Objectives in progress');
  });

  test('does not show a fake percentage for GPS-only Quests without persisted checks', () => {
    const result = progress({
      quest: { verification_methods: ['gps'] },
    });

    expect(result.geo.percent).toBeNull();
    expect(result.canShowProgressBar).toBe(false);
    expect(result.readiness).toBe('Active — validation is server-checked');
  });

  test('keeps geo and photo requirements separate and prevents false 100%', () => {
    const result = progress({
      quest: {
        verification_methods: ['gps', 'camera'],
        quest_objectives: [
          { id: 'photo-at-place', is_required: true, location_requirement_type: 'radius' },
        ],
      },
    });

    expect(result.geo).toEqual({ verified: 0, total: 1, percent: 0 });
    expect(result.objective).toEqual({ completed: 0, total: 1, percent: 0 });
    expect(result.readiness).toBe('Objectives in progress');
  });

  test('shows timer remaining time but never converts it into completion percentage', () => {
    const now = Date.parse('2026-09-07T12:00:00.000Z');
    const result = progress({
      quest: { verification_methods: ['timer'] },
      participation: {
        verification_earliest_completion_at: '2026-09-07T12:02:05.000Z',
      },
      now,
    });

    expect(result.timer).toEqual({ label: '2m 05s remaining', ready: false });
    expect(result.canShowProgressBar).toBe(false);
    expect(result.readiness).toBe('Timer running');
  });

  test('keeps integrity-only Quests in a server-verification state', () => {
    const result = progress({
      quest: { verification_methods: ['integrity_confirmation'] },
    });

    expect(result.canShowProgressBar).toBe(false);
    expect(result.readiness).toBe('Integrity confirmation required');
  });

  test('shows server-derived QAVS distance progress when a target exists', () => {
    const result = progress({
      quest: {
        verification_methods: ['activity_tracking'],
        required_distance_meters: 250,
      },
      participation: { activity_distance_meters: 100 },
    });

    expect(result.activity).toEqual({ distanceMeters: 100, targetMeters: 250, percent: 40 });
    expect(result.readiness).toBe('Activity in progress');
  });

  test('does not combine multiple active Quests into one progress value', () => {
    const active = [
      { quest_id: 'quest-a', id: 'participation-a' },
      { quest_id: 'quest-b', id: 'participation-b' },
    ];

    expect(getFocusedActiveParticipation('quest-b', active)).toEqual(active[1]);
    expect(getFocusedActiveParticipation('quest-missing', active)).toBeNull();
  });

  test('labels review state as pending instead of showing awarded points', () => {
    const result = progress({
      participation: { status: 'under_review' },
    });

    expect(result.readiness).toBe('Under review — points are pending');
  });

  test('failed completion validation cannot produce false 100%', () => {
    const result = progress({
      quest: {
        verification_methods: ['gps'],
        quest_objectives: [
          { id: 'location', is_required: true, location_requirement_type: 'radius' },
        ],
      },
      stepProgress: [{ quest_step_id: 'location', status: 'incomplete' }],
    });

    expect(result.geo.percent).toBe(0);
    expect(result.objective.percent).toBe(0);
    expect(result.readiness).toBe('Objectives in progress');
  });

  test('network interruption or app restart keeps the last authoritative state', () => {
    const input = {
      quest: {
        verification_methods: ['activity_tracking'],
        required_distance_meters: 1_000,
      },
      participation: { activity_distance_meters: 420 },
    };

    expect(progress(input).activity.percent).toBe(42);
    expect(progress(input).activity.percent).toBe(42);
  });

  test('completion confirmed elsewhere changes readiness only after server status updates', () => {
    expect(progress({ participation: { status: 'in_progress' } }).readiness)
      .not.toBe('Completed — points confirmed');
    expect(progress({ participation: { status: 'completed' } }).readiness)
      .toBe('Completed — points confirmed');
  });
});