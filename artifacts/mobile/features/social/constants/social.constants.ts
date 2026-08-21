/**
 * Social Constants — Worlds (Prompt 16)
 *
 * Centralized configuration for the social feature module.
 * All rate limits and policy values live here — never scattered in UI code.
 */

/** Worlds Purple — social/progression accent color */
export const SOCIAL_PURPLE = '#7C3AED';

/** Hunt Green — used for positive social states ("Friends") */
export const SOCIAL_GREEN = '#059669';

/** Neutral muted color for passive states */
export const SOCIAL_MUTED = '#64748B';

// ─── Search ──────────────────────────────────────────────────────────────────

/** Minimum characters required before a search is executed */
export const SEARCH_MIN_CHARS = 2;

/** Debounce delay (ms) for the search input */
export const SEARCH_DEBOUNCE_MS = 350;

/** Maximum results per search page */
export const SEARCH_PAGE_SIZE = 20;

// ─── Friend Requests ─────────────────────────────────────────────────────────

/** Maximum pending outgoing requests before new sends are blocked (server-enforced) */
export const MAX_PENDING_OUTGOING_REQUESTS = 100;

/** Days a pending request remains active before expiring */
export const REQUEST_EXPIRY_DAYS = 30;

/** Days before re-requesting someone who declined */
export const DECLINE_COOLDOWN_DAYS = 7;

/** Days before re-requesting someone after removal */
export const REMOVAL_COOLDOWN_DAYS = 1;

/** Days before re-requesting someone after unblocking */
export const UNBLOCK_COOLDOWN_DAYS = 1;

// ─── Friends List ─────────────────────────────────────────────────────────────

/** Page size for the friends list */
export const FRIENDS_PAGE_SIZE = 50;

// ─── Reports ─────────────────────────────────────────────────────────────────

/** Max reports per user per day (server-enforced) */
export const MAX_REPORTS_PER_DAY = 5;

// ─── Deep Links ──────────────────────────────────────────────────────────────

export const DEEP_LINK_PREFIX = 'worlds://social';

export const DEEP_LINKS = {
  publicProfile:   (username: string) => `${DEEP_LINK_PREFIX}/profile/${username}`,
  friends:         `${DEEP_LINK_PREFIX}/friends`,
  friendRequests:  `${DEEP_LINK_PREFIX}/friend-requests`,
  findPeople:      `${DEEP_LINK_PREFIX}/find-people`,
  socialPrivacy:   `${DEEP_LINK_PREFIX}/privacy`,
  blockedUsers:    `${DEEP_LINK_PREFIX}/blocked`,
} as const;

// ─── Privacy Defaults ─────────────────────────────────────────────────────────

export const SOCIAL_PRIVACY_DEFAULTS = {
  profileVisibility:            'public'   as const,
  showBio:                      true,
  showActiveTitle:              true,
  showBadges:                   true,
  showAchievements:             true,
  showStatistics:               false,   // friends-only default
  discoverableByUsername:       true,
  discoverableByDisplayName:    false,
  showMutualFriendCount:        true,
  allowFriendRequests:          true,
  allowHuntInvitationsFrom:     'friends' as const,
};

// ─── Profile Visibility Labels ────────────────────────────────────────────────

export const PROFILE_VISIBILITY_LABELS: Record<string, string> = {
  public:       'Public',
  friends_only: 'Friends only',
  private:      'Private',
};

export const PROFILE_VISIBILITY_DESCRIPTIONS: Record<string, string> = {
  public:       'Anyone can view your profile.',
  friends_only: 'Only your friends can view your full profile.',
  private:      'Only you can view your profile.',
};

// ─── Stale Times ─────────────────────────────────────────────────────────────

/** Public profile cache duration (ms) — short because relationship state changes */
export const PUBLIC_PROFILE_STALE_MS   = 60 * 1000;          // 1 min
export const FRIENDS_STALE_MS          = 2 * 60 * 1000;       // 2 min
export const REQUESTS_STALE_MS         = 60 * 1000;           // 1 min
export const SEARCH_STALE_MS           = 30 * 1000;           // 30 s
export const PRIVACY_SETTINGS_STALE_MS = 5 * 60 * 1000;      // 5 min
export const BLOCKED_STALE_MS          = 5 * 60 * 1000;       // 5 min
