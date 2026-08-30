import {
  getMediaAssetAvailability,
  getMediaFallbackMessage,
  resolveMediaUrl,
} from '../services/media/media.service';

jest.mock('../lib/supabase/helpers', () => ({
  getSignedUrl: jest.fn(() => Promise.resolve('https://signed.example/media')),
  normalizeError: jest.fn((error: unknown) => error),
}));

describe('withdrawn media presentation', () => {
  const approvedAsset = {
    bucket: 'quest-media',
    storage_path: 'quest/cover.jpg',
    visibility: 'public' as const,
    moderation_status: 'approved' as const,
    deleted_at: null,
  };

  it('treats a soft-deleted approved asset as withdrawn and does not resolve its URL', async () => {
    const withdrawnAsset = { ...approvedAsset, deleted_at: '2026-08-30T12:00:00.000Z' };

    expect(getMediaAssetAvailability(withdrawnAsset)).toBe('withdrawn');
    await expect(resolveMediaUrl(withdrawnAsset)).resolves.toBeNull();
  });

  it('provides a user-visible fallback for a failed clue URL', () => {
    expect(getMediaFallbackMessage('clue')).toBe(
      'This clue image is no longer available.',
    );
    expect(getMediaFallbackMessage('thumbnail')).toBe('Image unavailable');
  });
});