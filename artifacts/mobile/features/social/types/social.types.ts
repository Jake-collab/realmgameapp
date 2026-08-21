/**
 * Social Domain Types — Worlds (Prompt 16)
 *
 * Covers: Public Profiles, Friends, Friend Requests, Blocks,
 *         User Discovery, Social Privacy, Hunt Invitation Eligibility.
 *
 * Rules:
 * - Email, phone, exact location NEVER appear in any social type.
 * - Internal UUIDs are NOT used as public identifiers — use publicUserRef (username).
 * - rule_key from progression NEVER exposed here.
 * - Friendship is mutual-only (no followers/following).
 * - Block status hidden from blocked user (shows as 'unavailable').
 * - All writes go through server RPCs — no direct table mutations from client.
 */

// ─── Relationship State ───────────────────────────────────────────────────────

/**
 * The relationship between the current viewer and another user.
 *
 * 'blocked_me' is intentionally NOT surfaced in public-facing UI labels.
 * The client shows 'unavailable' to prevent revealing block status.
 */
export type SocialRelationshipState =
  | 'none'
  | 'outgoing_request'
  | 'incoming_request'
  | 'friends'
  | 'blocked_by_me'
  | 'unavailable'   // blocked_by_target — shown generically
  | 'self';

// ─── Public Identity (shared across all social contexts) ─────────────────────

/**
 * Safe, minimal public-facing identity. Used in:
 * - Search results
 * - Friends list
 * - Friend Requests
 * - Leaderboards (where permitted)
 * - Hunt Invitations
 * - Notification payloads
 *
 * Never exposes: email, phone, exact location, authentication provider,
 * account role, moderation history, or internal UUID.
 */
export interface PublicIdentity {
  /** Opaque public reference — the username (lowercase, unique). */
  publicUserRef: string;
  displayName: string;
  username: string;
  /** Storage path — resolve to URL via signed URL helper. null when no avatar set. */
  avatarPath: string | null;
}

// ─── User Search ──────────────────────────────────────────────────────────────

export interface SearchPublicUsersRequest {
  query: string;
  limit?: number;
  cursor?: string; // last username seen for pagination
}

export interface UserSearchResult extends PublicIdentity {
  relationshipState: Extract<SocialRelationshipState, 'none' | 'outgoing_request' | 'incoming_request' | 'friends'>;
  mutualFriendCount?: number;
}

// ─── Public Profile ───────────────────────────────────────────────────────────

/**
 * Full privacy-filtered public profile returned by get_public_profile RPC.
 * Fields are omitted (not null) when the target's privacy settings hide them.
 */
export interface PublicProfile extends PublicIdentity {
  /** null when show_bio = false in target's privacy settings */
  bio?: string | null;
  createdAt?: string;
  relationshipState: SocialRelationshipState;
  /** Whether the viewer may send a friend request */
  allowFriendRequests: boolean;
  /** Hunt invitation permission setting */
  allowHuntInvitationsFrom: 'friends' | 'nobody';
  /** Whether mutual friend count is permitted and available */
  mutualFriendCount?: number;
  /** Profile is partially hidden (friends_only) for non-friends */
  profileLimited?: boolean;

  // Progression visibility flags (controlled by target's privacy settings)
  showActiveTitle: boolean;
  showBadges: boolean;
  showAchievements: boolean;
  showStatistics: boolean;
}

/** Response variants from the public profile RPC */
export type PublicProfileResult =
  | { isSelf: true; username: string }
  | { unavailable: true; reason: 'not_found' | 'private' | 'unavailable'; relationshipState?: SocialRelationshipState; username?: string }
  | PublicProfile;

export function isPublicProfileUnavailable(r: PublicProfileResult): r is { unavailable: true; reason: string } {
  return 'unavailable' in r && r.unavailable === true;
}
export function isPublicProfileSelf(r: PublicProfileResult): r is { isSelf: true; username: string } {
  return 'isSelf' in r && r.isSelf === true;
}
export function isPublicProfile(r: PublicProfileResult): r is PublicProfile {
  return !isPublicProfileUnavailable(r) && !isPublicProfileSelf(r);
}

// ─── Public Progression Summary ───────────────────────────────────────────────

/**
 * Progression fields shown on another user's public profile.
 * Each field respects the target's visibility settings — absent = hidden.
 */
export interface PublicProgressionSummary {
  /** Active title name, null if hidden or not set */
  activeTitleName?: string | null;
  activeTitleSlug?: string | null;
  /** Pinned badge summaries (max 3) */
  pinnedBadges?: PublicBadgeSummary[];
  /** Achievement count, omitted when show_achievements=false */
  achievementsCount?: number;
  /** Quest completions, omitted when show_statistics=false */
  questsCompleted?: number;
  huntesCompleted?: number;
  totalActivities?: number;
  /** Points, omitted when show_statistics=false */
  questPoints?: number;
  huntPoints?: number;
  combinedPoints?: number;
  /** Whether progression is fully hidden */
  progressionHidden: boolean;
}

export interface PublicBadgeSummary {
  badgeId: string;
  slug: string;
  name: string;
  iconName: string;
  artworkUrl: string | null;
}

export interface PublicAchievementSummary {
  achievementId: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  artworkUrl: string | null;
  category: string;
  awardedAt: string;
}

// ─── Friend Request ───────────────────────────────────────────────────────────

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface FriendRequestEntry {
  requestId: string;
  /** The other party (requester for received; recipient for sent) */
  publicUserRef: string;
  displayName: string;
  username: string;
  avatarPath: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface SendFriendRequestResult {
  ok: boolean;
  code: 'sent' | 'request_exists' | 'already_friends' | 'auto_accepted' | 'requests_disabled' | 'blocked' | 'self_request' | 'target_unavailable' | 'pending_limit_reached' | 'cooldown_active' | string;
  requestId?: string;
  state?: SocialRelationshipState;
}

// ─── Friend-Request Eligibility ───────────────────────────────────────────────

export type FriendRequestEligibilityCode =
  | 'eligible'
  | 'already_friends'
  | 'request_sent'
  | 'incoming_request'
  | 'requests_disabled'
  | 'blocked'
  | 'self'
  | 'target_unavailable'
  | 'pending_limit_reached'
  | 'cooldown_active'
  | 'rate_limited';

export interface FriendRequestEligibility {
  code: FriendRequestEligibilityCode;
  canSend: boolean;
}

// ─── Friendship ───────────────────────────────────────────────────────────────

export interface FriendEntry extends PublicIdentity {
  friendshipSince: string;
}

// ─── Block ────────────────────────────────────────────────────────────────────

export interface BlockedUserEntry {
  publicUserRef: string;
  displayName: string;
  username: string | null;
  blockedAt: string;
}

// ─── Hunt Invitation Eligibility ─────────────────────────────────────────────

export interface HuntInvitationEligibility {
  eligible: boolean;
  code:
    | 'eligible'
    | 'not_friends'
    | 'blocked'
    | 'invitations_disabled'
    | 'already_invited'
    | 'already_participating'
    | 'hunt_full'
    | 'target_unavailable'
    | 'unauthorized_inviter';
  publicUserRef?: string;
  displayName?: string;
}

// ─── Social Privacy Settings ──────────────────────────────────────────────────

export interface SocialPrivacySettings {
  userId: string;
  profileVisibility: 'public' | 'friends_only' | 'private';
  showBio: boolean;
  showActiveTitle: boolean;
  showBadges: boolean;
  showAchievements: boolean;
  showStatistics: boolean;
  discoverableByUsername: boolean;
  discoverableByDisplayName: boolean;
  showMutualFriendCount: boolean;
  allowFriendRequests: boolean;
  allowHuntInvitationsFrom: 'friends' | 'nobody';
  createdAt: string;
  updatedAt: string;
}

export type SocialPrivacySettingsUpdate = Partial<Omit<SocialPrivacySettings, 'userId' | 'createdAt' | 'updatedAt'>>;

// ─── Mutual Friend ────────────────────────────────────────────────────────────

export interface MutualFriendCount {
  permitted: boolean;
  count: number;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'impersonation'
  | 'inappropriate_profile'
  | 'threatening'
  | 'scam'
  | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment:              'Harassment or bullying',
  spam:                    'Spam',
  impersonation:           'Impersonation',
  inappropriate_profile:   'Inappropriate profile content',
  threatening:             'Threatening behavior',
  scam:                    'Scam or fraud',
  other:                   'Other',
};

export const REPORT_REASONS: ReportReason[] = [
  'harassment','spam','impersonation','inappropriate_profile','threatening','scam','other',
];

// ─── Social Action ────────────────────────────────────────────────────────────

/**
 * Resolved primary action for a public profile.
 * Computed from relationship state + eligibility.
 */
export type SocialActionType =
  | 'add_friend'
  | 'request_sent'
  | 'accept_request'
  | 'friends'
  | 'unblock'
  | 'unavailable'
  | 'self';

export interface SocialAction {
  type: SocialActionType;
  label: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  /** requestId to accept/cancel, username for block/unblock, etc. */
  payload?: string;
}

export function resolvePrimaryAction(
  state: SocialRelationshipState,
  pendingRequestId?: string,
  allowFriendRequests: boolean = true,
): SocialAction {
  switch (state) {
    case 'none':
      if (!allowFriendRequests) {
        return { type: 'unavailable', label: 'Requests disabled', enabled: false, requiresConfirmation: false };
      }
      return { type: 'add_friend', label: 'Add Friend', enabled: true, requiresConfirmation: false };
    case 'outgoing_request':
      return { type: 'request_sent', label: 'Request Sent', enabled: true, requiresConfirmation: false, payload: pendingRequestId };
    case 'incoming_request':
      return { type: 'accept_request', label: 'Accept Request', enabled: true, requiresConfirmation: false, payload: pendingRequestId };
    case 'friends':
      return { type: 'friends', label: 'Friends', enabled: true, requiresConfirmation: false };
    case 'blocked_by_me':
      return { type: 'unblock', label: 'Unblock', enabled: true, requiresConfirmation: true };
    case 'unavailable':
      return { type: 'unavailable', label: 'Unavailable', enabled: false, requiresConfirmation: false };
    case 'self':
      return { type: 'self', label: 'Your Profile', enabled: false, requiresConfirmation: false };
  }
}
