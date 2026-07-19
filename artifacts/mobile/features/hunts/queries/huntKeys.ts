/**
 * Hunt Query Keys — Worlds
 *
 * Centralized React Query key factory for all Hunt-related queries.
 *
 * Rules:
 * - All Hunt queries must use these keys — never ad-hoc arrays.
 * - Keys are stable across renders (same input = identical values).
 * - Do NOT include sensitive values: private geometry, proof content, tokens.
 * - Do NOT share key namespaces with Quest keys.
 * - For map/geo queries with coordinates, round to 2dp (~1km grid).
 * - User-scoped private queries always include userId.
 *
 * Usage:
 *   useQuery({ queryKey: huntKeys.detail(huntId, userId), queryFn: ... })
 *   queryClient.invalidateQueries({ queryKey: huntKeys.active(userId) })
 */

export const huntKeys = {
  /** Root key — invalidates all hunt queries */
  all: ['hunts'] as const,

  /** All list queries */
  lists: () => [...huntKeys.all, 'list'] as const,

  /** Public Hunt map viewport (rounded bounds key — no precise GPS) */
  map: (boundsKey: string, filterHash?: string) =>
    [...huntKeys.lists(), 'map', boundsKey, filterHash ?? ''] as const,

  /** Nearby hunts sorted by distance (rounded user location) */
  nearby: (roundedLat: number | undefined, roundedLng: number | undefined, filterHash?: string) =>
    [...huntKeys.lists(), 'nearby', roundedLat, roundedLng, filterHash ?? ''] as const,

  /** Public hunt listing (paginated) */
  publicList: (filters?: string) =>
    [...huntKeys.lists(), 'public', filters ?? ''] as const,

  /** Hunt detail — public + user-specific state */
  detail: (huntId: string, occurrenceId: string | null, userId: string) =>
    [...huntKeys.all, 'detail', huntId, occurrenceId ?? 'none', userId] as const,

  /** Hunt availability result for a specific hunt + user */
  availability: (huntId: string, occurrenceId: string | null, userId: string) =>
    [...huntKeys.all, 'availability', huntId, occurrenceId ?? 'none', userId] as const,

  /** My Hunts summary (active + ready + completed + invitations) */
  mySummary: (userId: string) =>
    [...huntKeys.all, 'my-summary', userId] as const,

  /** Active hunts for a user */
  active: (userId: string) =>
    [...huntKeys.all, 'active', userId] as const,

  /** Ready (joined, not yet started) hunts for a user */
  ready: (userId: string) =>
    [...huntKeys.all, 'ready', userId] as const,

  /** Completed hunts for a user */
  completed: (userId: string, filters?: string) =>
    [...huntKeys.all, 'completed', userId, filters ?? ''] as const,

  /** Pending invitations for a user */
  invitations: (userId: string) =>
    [...huntKeys.all, 'invitations', userId] as const,

  /** A specific invitation */
  invitation: (invitationId: string, userId: string) =>
    [...huntKeys.all, 'invitation', invitationId, userId] as const,

  /** A specific participation record */
  participation: (participationId: string, userId: string) =>
    [...huntKeys.all, 'participation', participationId, userId] as const,

  /** User's participation for a specific hunt */
  huntParticipation: (huntId: string, userId: string) =>
    [...huntKeys.all, 'hunt-participation', huntId, userId] as const,

  /** Active hunt state (authorized stops + current clue content) */
  activeHunt: (participationId: string, userId: string) =>
    [...huntKeys.all, 'active-hunt', participationId, userId] as const,

  /** Stop progress for a participation */
  stopProgress: (participationId: string, userId: string) =>
    [...huntKeys.all, 'stop-progress', participationId, userId] as const,

  /** A specific stop (with progress state) */
  stop: (participationId: string, stopId: string, userId: string) =>
    [...huntKeys.all, 'stop', participationId, stopId, userId] as const,

  /** Proof submissions for a stop */
  submissions: (participationId: string, stopId: string, userId: string) =>
    [...huntKeys.all, 'submissions', participationId, stopId, userId] as const,

  /** Hunt occurrences for a hunt */
  occurrences: (huntId: string) =>
    [...huntKeys.all, 'occurrences', huntId] as const,

  /** Created / owned hunts for a user */
  created: (userId: string) =>
    [...huntKeys.all, 'created', userId] as const,
} as const;

// ─── Cache invalidation helpers ───────────────────────────────────────────────

/** Keys to invalidate after joining a hunt */
export function getJoinHuntInvalidationKeys(
  userId: string,
  huntId: string,
  occurrenceId: string | null,
) {
  return [
    huntKeys.mySummary(userId),
    huntKeys.active(userId),
    huntKeys.ready(userId),
    huntKeys.availability(huntId, occurrenceId, userId),
    huntKeys.huntParticipation(huntId, userId),
    huntKeys.detail(huntId, occurrenceId, userId),
  ];
}

/** Keys to invalidate after starting a hunt */
export function getStartHuntInvalidationKeys(
  userId: string,
  huntId: string,
  participationId: string,
  occurrenceId: string | null,
) {
  return [
    huntKeys.mySummary(userId),
    huntKeys.active(userId),
    huntKeys.ready(userId),
    huntKeys.availability(huntId, occurrenceId, userId),
    huntKeys.huntParticipation(huntId, userId),
    huntKeys.participation(participationId, userId),
    huntKeys.activeHunt(participationId, userId),
    huntKeys.stopProgress(participationId, userId),
  ];
}

/** Keys to invalidate after accepting an invitation */
export function getAcceptInvitationInvalidationKeys(
  userId: string,
  huntId: string,
  invitationId: string,
  occurrenceId: string | null,
) {
  return [
    huntKeys.invitations(userId),
    huntKeys.invitation(invitationId, userId),
    huntKeys.mySummary(userId),
    huntKeys.ready(userId),
    huntKeys.availability(huntId, occurrenceId, userId),
    huntKeys.huntParticipation(huntId, userId),
  ];
}

/** Keys to invalidate after declining an invitation */
export function getDeclineInvitationInvalidationKeys(
  userId: string,
  invitationId: string,
) {
  return [
    huntKeys.invitations(userId),
    huntKeys.invitation(invitationId, userId),
    huntKeys.mySummary(userId),
  ];
}

/** Keys to invalidate after completing a hunt stop */
export function getCompleteStopInvalidationKeys(
  userId: string,
  participationId: string,
  huntId: string,
  occurrenceId: string | null,
) {
  return [
    huntKeys.activeHunt(participationId, userId),
    huntKeys.stopProgress(participationId, userId),
    huntKeys.active(userId),
    huntKeys.mySummary(userId),
    huntKeys.participation(participationId, userId),
  ];
}

/** Keys to invalidate after completing a hunt */
export function getCompleteHuntInvalidationKeys(
  userId: string,
  huntId: string,
  participationId: string,
  occurrenceId: string | null,
) {
  return [
    huntKeys.mySummary(userId),
    huntKeys.active(userId),
    huntKeys.completed(userId),
    huntKeys.availability(huntId, occurrenceId, userId),
    huntKeys.huntParticipation(huntId, userId),
    huntKeys.participation(participationId, userId),
    huntKeys.activeHunt(participationId, userId),
    huntKeys.stopProgress(participationId, userId),
  ];
}

/** Keys to invalidate after withdrawing from a hunt */
export function getWithdrawHuntInvalidationKeys(
  userId: string,
  huntId: string,
  participationId: string,
  occurrenceId: string | null,
) {
  return [
    huntKeys.mySummary(userId),
    huntKeys.active(userId),
    huntKeys.ready(userId),
    huntKeys.availability(huntId, occurrenceId, userId),
    huntKeys.huntParticipation(huntId, userId),
    huntKeys.participation(participationId, userId),
  ];
}
