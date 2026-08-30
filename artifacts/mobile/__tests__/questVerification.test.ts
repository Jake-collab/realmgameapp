import {
  formatRemainingTimer,
  getQuestVerificationMethods,
  verificationLabel,
} from '@/features/quests/utils/questVerification';

describe('method-driven Quest verification', () => {
  const baseQuest = {
    verification_methods: null,
    proof_type: 'none' as const,
    location_requirement_type: 'none' as const,
  };

  it('honors trusted explicit methods instead of inferring from legacy proof fields', () => {
    expect(getQuestVerificationMethods({
      ...baseQuest,
      verification_methods: ['timer', 'integrity_confirmation'],
      proof_type: 'none',
    })).toEqual(['timer', 'integrity_confirmation']);
  });

  it('keeps legacy camera and GPS quests readable during migration', () => {
    expect(getQuestVerificationMethods({ ...baseQuest, proof_type: 'photo' })).toEqual(['camera']);
    expect(getQuestVerificationMethods({ ...baseQuest, proof_type: 'location' })).toEqual(['gps']);
    expect(getQuestVerificationMethods(baseQuest)).toEqual(['integrity_confirmation']);
  });

  it('does not let a client clock change server-declared timer readiness', () => {
    const earliest = new Date('2026-08-30T16:00:00.000Z').toISOString();
    expect(formatRemainingTimer(earliest, Date.parse('2026-08-30T15:59:00.000Z'))).toBe('1m 00s remaining');
    expect(formatRemainingTimer(earliest, Date.parse('2026-08-30T16:00:00.000Z'))).toBe('Ready to complete');
  });

  it('uses player-facing labels for every supported method', () => {
    expect(verificationLabel('camera')).toBe('Camera proof');
    expect(verificationLabel('gps')).toBe('GPS validation');
    expect(verificationLabel('timer')).toBe('Timed activity');
    expect(verificationLabel('integrity_confirmation')).toBe('Integrity confirmation');
  });
});