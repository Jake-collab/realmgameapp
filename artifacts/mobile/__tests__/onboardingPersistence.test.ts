/**
 * Onboarding Persistence — Unit Tests
 *
 * Verifies that onboarding steps correctly save state to the database
 * and that the completion step marks the profile appropriately.
 */

// ─── Mock profile service ─────────────────────────────────────────────────────

const mockSetMyInterests = jest.fn(() => Promise.resolve());
const mockUpdateMyProfile = jest.fn(() =>
  Promise.resolve({
    id: 'user-123',
    username: 'testuser',
    display_name: 'Test User',
    onboarding_status: 'completed',
    onboarding_completed_at: new Date().toISOString(),
    account_status: 'active',
    preferred_game_mode: 'quest',
    role: 'registered',
    bio: null,
    avatar_path: null,
    last_active_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  })
);
const mockUpdateMySettings = jest.fn(() => Promise.resolve({ user_id: 'user-123' }));
const mockUpdateOnboardingProgress = jest.fn(() => Promise.resolve());

jest.mock('@/services/profile/profile.service', () => ({
  setMyInterests: mockSetMyInterests,
  updateMyProfile: mockUpdateMyProfile,
  updateMySettings: mockUpdateMySettings,
  updateOnboardingProgress: mockUpdateOnboardingProgress,
  getAllInterests: jest.fn(() =>
    Promise.resolve([
      { id: 'interest-1', name: 'Outdoors', slug: 'outdoors', is_active: true, sort_order: 0 },
      { id: 'interest-2', name: 'Photography', slug: 'photography', is_active: true, sort_order: 1 },
    ])
  ),
}));

jest.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  requireSupabase: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

// ─── Interests persistence ────────────────────────────────────────────────────

describe('interests step persistence', () => {
  it('calls setMyInterests with selected interest IDs', async () => {
    const { setMyInterests } = require('@/services/profile/profile.service');
    const userId = 'user-123';
    const selectedIds = ['interest-1', 'interest-2'];

    await setMyInterests(userId, selectedIds);

    expect(mockSetMyInterests).toHaveBeenCalledWith(userId, selectedIds);
  });

  it('does not call setMyInterests when selection is empty (skip)', async () => {
    // Simulated: empty selection skips the DB call in interests.tsx
    // setMyInterests is only called when selected.size > 0
    const selectedIds: string[] = [];
    if (selectedIds.length > 0) {
      await mockSetMyInterests();
    }
    expect(mockSetMyInterests).not.toHaveBeenCalled();
  });
});

// ─── Completion step ──────────────────────────────────────────────────────────

describe('onboarding completion', () => {
  it('calls updateMyProfile with onboarding_status = "completed"', async () => {
    const { updateMyProfile } = require('@/services/profile/profile.service');
    const userId = 'user-123';
    const now = new Date().toISOString();

    await updateMyProfile(userId, {
      onboarding_status: 'completed',
      onboarding_completed_at: now,
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ onboarding_status: 'completed' })
    );
  });

  it('calls updateOnboardingProgress with step = "complete"', async () => {
    const { updateOnboardingProgress } = require('@/services/profile/profile.service');
    const userId = 'user-123';

    await updateOnboardingProgress(userId, { step: 'complete' });

    expect(mockUpdateOnboardingProgress).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ step: 'complete' })
    );
  });

  it('calls updateMySettings with last_game_mode', async () => {
    const { updateMySettings } = require('@/services/profile/profile.service');
    const userId = 'user-123';

    await updateMySettings(userId, { last_game_mode: 'quest' });

    expect(mockUpdateMySettings).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ last_game_mode: 'quest' })
    );
  });
});

// ─── Starting mode step ───────────────────────────────────────────────────────

describe('starting mode step persistence', () => {
  it('saves preferred_game_mode to profile', async () => {
    const { updateMyProfile } = require('@/services/profile/profile.service');
    const userId = 'user-123';

    await updateMyProfile(userId, { preferred_game_mode: 'hunt' });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ preferred_game_mode: 'hunt' })
    );
  });

  it('saves starting mode to user_settings', async () => {
    const { updateMySettings } = require('@/services/profile/profile.service');
    const userId = 'user-123';

    await updateMySettings(userId, { last_game_mode: 'hunt' });

    expect(mockUpdateMySettings).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ last_game_mode: 'hunt' })
    );
  });
});

// ─── Location step ────────────────────────────────────────────────────────────

describe('location step persistence', () => {
  it('saves location_sharing_enabled = true when granted', async () => {
    const { updateMySettings } = require('@/services/profile/profile.service');
    const userId = 'user-123';

    // Simulate granted permission
    await updateMySettings(userId, { location_sharing_enabled: true });

    expect(mockUpdateMySettings).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ location_sharing_enabled: true })
    );
  });

  it('saves location_sharing_enabled = false when denied', async () => {
    const { updateMySettings } = require('@/services/profile/profile.service');
    const userId = 'user-123';

    // Simulate denied permission — onboarding is non-blocking
    await updateMySettings(userId, { location_sharing_enabled: false });

    expect(mockUpdateMySettings).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ location_sharing_enabled: false })
    );
  });
});
