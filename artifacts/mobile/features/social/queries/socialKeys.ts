/**
 * Social Query Keys — Worlds (Prompt 16)
 *
 * Centralized React Query key factory for all Social queries.
 * Namespace: 'social' — separate from quest, hunt, and progression namespaces.
 *
 * Rules:
 * - Never include private profile values (email, exact location) in keys.
 * - Use publicUserRef (username) as the user identifier in keys, not internal UUID.
 * - viewerId is included where results vary by viewer (relationship state).
 */

export const socialKeys = {
  /** Root — invalidates all Social queries */
  all: ['social'] as const,

  // ── Public Profile ───────────────────────────────────────────────────────

  /** Full public profile, viewer-scoped (relationship state varies by viewer) */
  publicProfile: (publicUserRef: string, viewerId: string) =>
    [...socialKeys.all, 'public-profile', publicUserRef, viewerId] as const,

  /** Lightweight relationship state check */
  relationship: (publicUserRef: string, viewerId: string) =>
    [...socialKeys.all, 'relationship', publicUserRef, viewerId] as const,

  // ── Friends ──────────────────────────────────────────────────────────────

  friends: (userId: string, search?: string) =>
    [...socialKeys.all, 'friends', userId, search ?? ''] as const,

  // ── Friend Requests ──────────────────────────────────────────────────────

  requestsReceived: (userId: string) =>
    [...socialKeys.all, 'requests-received', userId] as const,

  requestsSent: (userId: string) =>
    [...socialKeys.all, 'requests-sent', userId] as const,

  // ── User Search ──────────────────────────────────────────────────────────

  search: (query: string, cursor: string | undefined, viewerId: string) =>
    [...socialKeys.all, 'search', query, cursor ?? '', viewerId] as const,

  /** Stable root for invalidating all search results */
  searchAll: () => [...socialKeys.all, 'search'] as const,

  // ── Blocked Users ────────────────────────────────────────────────────────

  blockedUsers: (userId: string) =>
    [...socialKeys.all, 'blocked-users', userId] as const,

  // ── Privacy Settings ─────────────────────────────────────────────────────

  privacySettings: (userId: string) =>
    [...socialKeys.all, 'privacy-settings', userId] as const,

  // ── Mutual Friends ───────────────────────────────────────────────────────

  mutualFriends: (publicUserRef: string, viewerId: string) =>
    [...socialKeys.all, 'mutual-friends', publicUserRef, viewerId] as const,

  // ── Hunt Invitation Eligibility ──────────────────────────────────────────

  huntInviteEligibility: (huntId: string, occurrenceId: string, publicUserRef: string) =>
    [...socialKeys.all, 'hunt-invite-eligibility', huntId, occurrenceId, publicUserRef] as const,

} as const;

// ─── Targeted Invalidation Helpers ───────────────────────────────────────────

export function getSendRequestInvalidationKeys(
  targetUserRef: string,
  viewerId: string,
) {
  return [
    socialKeys.publicProfile(targetUserRef, viewerId),
    socialKeys.relationship(targetUserRef, viewerId),
    socialKeys.requestsSent(viewerId),
    socialKeys.searchAll(),
  ];
}

export function getAcceptRequestInvalidationKeys(
  requesterUserRef: string,
  viewerId: string,
) {
  return [
    socialKeys.requestsReceived(viewerId),
    socialKeys.friends(viewerId),
    socialKeys.publicProfile(requesterUserRef, viewerId),
    socialKeys.relationship(requesterUserRef, viewerId),
    socialKeys.mutualFriends(requesterUserRef, viewerId),
    socialKeys.searchAll(),
  ];
}

export function getDeclineOrCancelInvalidationKeys(
  otherUserRef: string,
  viewerId: string,
  direction: 'received' | 'sent',
) {
  return [
    direction === 'received' ? socialKeys.requestsReceived(viewerId) : socialKeys.requestsSent(viewerId),
    socialKeys.publicProfile(otherUserRef, viewerId),
    socialKeys.relationship(otherUserRef, viewerId),
    socialKeys.searchAll(),
  ];
}

export function getRemoveFriendInvalidationKeys(
  friendUserRef: string,
  viewerId: string,
) {
  return [
    socialKeys.friends(viewerId),
    socialKeys.publicProfile(friendUserRef, viewerId),
    socialKeys.relationship(friendUserRef, viewerId),
    socialKeys.mutualFriends(friendUserRef, viewerId),
  ];
}

export function getBlockUnblockInvalidationKeys(
  targetUserRef: string,
  viewerId: string,
) {
  return [
    socialKeys.all,
    socialKeys.searchAll(),
    socialKeys.blockedUsers(viewerId),
    socialKeys.publicProfile(targetUserRef, viewerId),
    socialKeys.relationship(targetUserRef, viewerId),
    socialKeys.friends(viewerId),
    socialKeys.requestsReceived(viewerId),
    socialKeys.requestsSent(viewerId),
    socialKeys.mutualFriends(targetUserRef, viewerId),
  ];
}

export function getPrivacyUpdateInvalidationKeys(viewerId: string) {
  return [
    socialKeys.privacySettings(viewerId),
    socialKeys.searchAll(),
  ];
}
