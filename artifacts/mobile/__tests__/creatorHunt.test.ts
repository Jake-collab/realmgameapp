import {
  CREATOR_DEFAULT_PAYLOAD,
  makeCreatorStop,
  normalizeCreatorPayload,
  validateCreatorDraft,
} from '@/features/hunts/types/creator.types';
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => any;

describe('Custom Hunt creator validation', () => {
  it('starts with private, safe defaults', () => {
    expect(CREATOR_DEFAULT_PAYLOAD.privacy).toBe('private');
    expect(CREATOR_DEFAULT_PAYLOAD.startAnywhere).toBe(true);
    expect(CREATOR_DEFAULT_PAYLOAD.safetyAcknowledged).toBe(false);
    expect(CREATOR_DEFAULT_PAYLOAD.stops).toHaveLength(0);
  });

  it('normalizes partial restored drafts without losing arrays', () => {
    const payload = normalizeCreatorPayload({ title: 'Saved idea' });
    expect(payload.title).toBe('Saved idea');
    expect(payload.stops).toEqual([]);
    expect(payload.intendedInviteeIds).toEqual([]);
    expect(payload.maxParticipants).toBe(10);
  });

  it('groups missing creator requirements by step', () => {
    const result = validateCreatorDraft(CREATOR_DEFAULT_PAYLOAD);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.step === 'details')).toBe(true);
    expect(result.issues.some(issue => issue.step === 'stops')).toBe(true);
    expect(result.issues.some(issue => issue.step === 'review')).toBe(true);
  });

  it('rejects placeholder zero coordinates and unconfirmed map points', () => {
    const stop = makeCreatorStop(1);
    stop.title = 'A stop';
    stop.clueText = 'Look around';
    stop.location = {
      label: 'Somewhere',
      latitude: 0,
      longitude: 0,
      radiusMeters: 100,
      confirmed: true,
    };
    const result = validateCreatorDraft({
      ...CREATOR_DEFAULT_PAYLOAD,
      title: 'A good Hunt',
      summary: 'A useful summary',
      description: 'A description long enough for validation.',
      safetyAcknowledged: true,
      publicAccessConfirmed: true,
      stops: [stop],
    });
    expect(result.issues.some(issue => issue.code === 'location_0')).toBe(true);
  });

  it('accepts a complete safe draft', () => {
    const stop = makeCreatorStop(1);
    stop.title = 'Library entrance';
    stop.clueText = 'Find the red sign';
    const result = validateCreatorDraft({
      ...CREATOR_DEFAULT_PAYLOAD,
      title: 'A good Hunt',
      summary: 'A useful summary',
      description: 'A description long enough for validation.',
      safetyAcknowledged: true,
      stops: [stop],
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});