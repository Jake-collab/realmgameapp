import {
  buildHuntMapProgress,
  getObjectiveDirection,
  resolveObjectiveMarkerStatus,
  selectCurrentHuntStop,
} from '../features/hunt-map/utils/huntMapGameplay';

const stop = (id: string, progressStatus: any, title = id) => ({
  id,
  title,
  progressStatus,
  progressId: `progress-${id}`,
  revealedAt: null,
  clue: null,
  proofSubmissionId: null,
  attemptCount: 0,
  completionMethod: 'manual_confirmation',
  isRequired: true,
  sortOrder: Number(id),
  stopRole: 'waypoint',
  safetyNote: null,
  accessibilityNote: null,
  publicLat: null,
  publicLng: null,
  publicRadius: null,
});

describe('Hunt map gameplay projection', () => {
  it('only exposes a mathematically valid completion percentage', () => {
    expect(buildHuntMapProgress({ completedStopCount: 2, requiredStopCount: 4 })).toEqual({
      completed: 2,
      required: 4,
      remaining: 2,
      percent: 50,
    });
    expect(buildHuntMapProgress({ completedStopCount: 2, requiredStopCount: 0 }).percent).toBeNull();
  });

  it('clamps stale server counts instead of implying over-completion', () => {
    expect(buildHuntMapProgress({ completedStopCount: 9, requiredStopCount: 3 })).toMatchObject({
      completed: 3,
      remaining: 0,
      percent: 100,
    });
  });

  it('selects the current actionable stop, respecting ordered Hunts', () => {
    const hunt = {
      isOrdered: true,
      currentStops: [
        stop('1', 'completed'),
        stop('2', 'available', 'Next objective'),
        stop('3', 'locked'),
      ],
    };
    expect(selectCurrentHuntStop(hunt as any, null)?.id).toBe('2');
    expect(selectCurrentHuntStop(hunt as any, '3')?.id).toBe('3');
  });

  it('maps server progress to safe marker states', () => {
    expect(resolveObjectiveMarkerStatus({ progressStatus: 'available' }, true)).toBe('ready');
    expect(resolveObjectiveMarkerStatus({ progressStatus: 'available' }, false)).toBe('discovered');
    expect(resolveObjectiveMarkerStatus({ progressStatus: 'completed' }, false)).toBe('completed');
    expect(resolveObjectiveMarkerStatus({ progressStatus: 'locked' }, false)).toBe('locked');
    expect(resolveObjectiveMarkerStatus({ progressStatus: 'under_review' }, true)).toBe('active');
  });

  it('calculates informational distance and bearing without affecting validation', () => {
    const cue = getObjectiveDirection(
      { latitude: 40, longitude: -73 },
      { publicLat: 40.01, publicLng: -73 },
    );
    expect(cue?.distanceMeters).toBeGreaterThan(1_000);
    expect(cue?.direction).toBe('N');
  });
});