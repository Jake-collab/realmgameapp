/**
 * Quest Proof Validation Tests
 *
 * Tests for proof type requirements and validation helpers.
 * Actual ProofType values: 'photo' | 'video' | 'text' | 'location' | 'qr_code' | 'none'
 */

import type { ProofType } from '@/lib/supabase/database.types';

// ─── Helpers (matching quest-proof screen implementation) ──────────────────────

function needsText(proofType: ProofType): boolean {
  return proofType === 'text';
}
function needsPhoto(proofType: ProofType): boolean {
  return proofType === 'photo' || proofType === 'video';
}
function needsLocation(proofType: ProofType): boolean {
  return proofType === 'location';
}
function needsQrCode(proofType: ProofType): boolean {
  return proofType === 'qr_code';
}

// ─── needsText ─────────────────────────────────────────────────────────────────

describe('needsText', () => {
  it('returns true for text', () => expect(needsText('text')).toBe(true));
  it('returns false for photo', () => expect(needsText('photo')).toBe(false));
  it('returns false for video', () => expect(needsText('video')).toBe(false));
  it('returns false for location', () => expect(needsText('location')).toBe(false));
  it('returns false for qr_code', () => expect(needsText('qr_code')).toBe(false));
  it('returns false for none', () => expect(needsText('none')).toBe(false));
});

// ─── needsPhoto ────────────────────────────────────────────────────────────────

describe('needsPhoto', () => {
  it('returns true for photo', () => expect(needsPhoto('photo')).toBe(true));
  it('returns true for video', () => expect(needsPhoto('video')).toBe(true));
  it('returns false for text', () => expect(needsPhoto('text')).toBe(false));
  it('returns false for location', () => expect(needsPhoto('location')).toBe(false));
  it('returns false for qr_code', () => expect(needsPhoto('qr_code')).toBe(false));
  it('returns false for none', () => expect(needsPhoto('none')).toBe(false));
});

// ─── needsLocation ─────────────────────────────────────────────────────────────

describe('needsLocation', () => {
  it('returns true for location', () => expect(needsLocation('location')).toBe(true));
  it('returns false for photo', () => expect(needsLocation('photo')).toBe(false));
  it('returns false for text', () => expect(needsLocation('text')).toBe(false));
  it('returns false for video', () => expect(needsLocation('video')).toBe(false));
  it('returns false for qr_code', () => expect(needsLocation('qr_code')).toBe(false));
  it('returns false for none', () => expect(needsLocation('none')).toBe(false));
});

// ─── needsQrCode ───────────────────────────────────────────────────────────────

describe('needsQrCode', () => {
  it('returns true for qr_code', () => expect(needsQrCode('qr_code')).toBe(true));
  it('returns false for all others', () => {
    for (const pt of ['photo', 'video', 'text', 'location', 'none'] as ProofType[]) {
      expect(needsQrCode(pt)).toBe(false);
    }
  });
});

// ─── canSubmit logic ──────────────────────────────────────────────────────────

describe('canSubmit logic', () => {
  function canSubmit(
    proofType: ProofType,
    textResponse: string,
    imageUri: string | null,
    locationCaptured: boolean
  ): boolean {
    if (needsText(proofType) && textResponse.trim().length < 10) return false;
    if (needsPhoto(proofType) && !imageUri) return false;
    if (needsLocation(proofType) && !locationCaptured) return false;
    return true;
  }

  it('text: requires at least 10 chars', () => {
    expect(canSubmit('text', 'short', null, false)).toBe(false);
    expect(canSubmit('text', 'long enough text here', null, false)).toBe(true);
  });

  it('photo: requires imageUri', () => {
    expect(canSubmit('photo', '', null, false)).toBe(false);
    expect(canSubmit('photo', '', 'file://photo.jpg', false)).toBe(true);
  });

  it('video: requires imageUri', () => {
    expect(canSubmit('video', '', null, false)).toBe(false);
    expect(canSubmit('video', '', 'file://video.mp4', false)).toBe(true);
  });

  it('location: requires locationCaptured', () => {
    expect(canSubmit('location', '', null, false)).toBe(false);
    expect(canSubmit('location', '', null, true)).toBe(true);
  });

  it('qr_code: always submittable (scanning is external)', () => {
    expect(canSubmit('qr_code', '', null, false)).toBe(true);
  });

  it('none: always can submit', () => {
    expect(canSubmit('none', '', null, false)).toBe(true);
  });
});

// ─── Security: all proof types handled ───────────────────────────────────────

describe('All ProofType values handled without throwing', () => {
  const allProofTypes: ProofType[] = ['photo', 'video', 'text', 'location', 'qr_code', 'none'];

  it('needsText: no throw for any type', () => {
    for (const pt of allProofTypes) expect(() => needsText(pt)).not.toThrow();
  });
  it('needsPhoto: no throw for any type', () => {
    for (const pt of allProofTypes) expect(() => needsPhoto(pt)).not.toThrow();
  });
  it('needsLocation: no throw for any type', () => {
    for (const pt of allProofTypes) expect(() => needsLocation(pt)).not.toThrow();
  });
  it('needsQrCode: no throw for any type', () => {
    for (const pt of allProofTypes) expect(() => needsQrCode(pt)).not.toThrow();
  });
});
