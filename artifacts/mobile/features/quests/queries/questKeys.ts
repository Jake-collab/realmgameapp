/**
 * Quest Query Keys — Worlds
 *
 * Centralized React Query key factory for all quest-related queries.
 *
 * Rules:
 * - All quest queries must use these keys — never ad-hoc arrays.
 * - Keys are stable across renders (same input = same array reference is not required,
 *   but the values must be identical for cache deduplication to work).
 * - Do NOT include sensitive values (precise GPS coordinates, proof content, tokens).
 * - For geo queries with user coordinates, round to 3 decimal places (~100m grid).
 *
 * Usage:
 *   useQuery({ queryKey: questKeys.daily(userId), queryFn: ... })
 *   queryClient.invalidateQueries({ queryKey: questKeys.participation(participationId) })
 */

export const questKeys = {
  /** Root key — use to invalidate all quest queries */
  all: ['quests'] as const,

  /** All list queries */
  lists: () => [...questKeys.all, 'list'] as const,

  /** Daily quests for a user */
  daily: (userId: string) => [...questKeys.lists(), 'daily', userId] as const,

  /** Monthly quest drops for a user */
  monthly: (userId: string) => [...questKeys.lists(), 'monthly', userId] as const,

  /** Geo-quests (optionally filtered by approximate region — rounded coordinates) */
  geo: (userId: string, approximateLat?: number, approximateLng?: number) => {
    // Round coordinates to 2dp (~1km grid) to avoid cache misses on minor GPS drift
    const lat = approximateLat !== undefined ? Math.round(approximateLat * 100) / 100 : undefined;
    const lng = approximateLng !== undefined ? Math.round(approximateLng * 100) / 100 : undefined;
    return [...questKeys.lists(), 'geo', userId, lat, lng] as const;
  },

  /** Quest detail (with objectives and public location) */
  detail: (questId: string, userId: string) =>
    [...questKeys.all, 'detail', questId, userId] as const,

  /** Quest availability result for a specific quest+user */
  availability: (questId: string, userId: string) =>
    [...questKeys.all, 'availability', questId, userId] as const,

  /** Home screen quest summary (active panel + type previews) */
  home: (userId: string) => [...questKeys.all, 'home', userId] as const,

  /** Active quests across all types */
  active: (userId: string) => [...questKeys.all, 'active', userId] as const,

  /** Completed quest history */
  completed: (userId: string) => [...questKeys.all, 'completed', userId] as const,

  /** Awaiting-proof participations */
  awaitingProof: (userId: string) => [...questKeys.all, 'awaiting-proof', userId] as const,

  /** Under-review participations */
  underReview: (userId: string) => [...questKeys.all, 'under-review', userId] as const,

  /** Step progress for a specific participation */
  progress: (participationId: string) =>
    [...questKeys.all, 'progress', participationId] as const,

  /** A specific participation record */
  participation: (participationId: string) =>
    [...questKeys.all, 'participation', participationId] as const,

  /** A user's participation for a specific quest */
  questParticipation: (questId: string, userId: string) =>
    [...questKeys.all, 'quest-participation', questId, userId] as const,

  /** Current proof submission for a participation */
  proof: (participationId: string) =>
    [...questKeys.all, 'proof', participationId] as const,

  /** Proof history for a participation */
  proofHistory: (participationId: string) =>
    [...questKeys.all, 'proof-history', participationId] as const,

  /** Point reward guidelines */
  guidelines: () => [...questKeys.all, 'guidelines'] as const,

  /** Categories list (public) */
  categories: () => [...questKeys.all, 'categories'] as const,

  /** Current occurrence for a quest */
  occurrence: (questId: string) => [...questKeys.all, 'occurrence', questId] as const,
} as const;

/** Keys to invalidate after starting a quest */
export function getStartQuestInvalidationKeys(userId: string, questId: string, participationId: string) {
  return [
    questKeys.daily(userId),
    questKeys.monthly(userId),
    questKeys.geo(userId),
    questKeys.home(userId),
    questKeys.active(userId),
    questKeys.availability(questId, userId),
    questKeys.questParticipation(questId, userId),
    questKeys.participation(participationId),
  ];
}

/** Keys to invalidate after abandoning a quest */
export function getAbandonQuestInvalidationKeys(userId: string, questId: string, participationId: string) {
  return [
    questKeys.active(userId),
    questKeys.home(userId),
    questKeys.availability(questId, userId),
    questKeys.questParticipation(questId, userId),
    questKeys.participation(participationId),
  ];
}

/** Keys to invalidate after completing a quest */
export function getCompleteQuestInvalidationKeys(userId: string, questId: string, participationId: string) {
  return [
    questKeys.active(userId),
    questKeys.completed(userId),
    questKeys.home(userId),
    questKeys.availability(questId, userId),
    questKeys.questParticipation(questId, userId),
    questKeys.participation(participationId),
    questKeys.progress(participationId),
  ];
}

/** Keys to invalidate after submitting proof */
export function getSubmitProofInvalidationKeys(userId: string, questId: string, participationId: string) {
  return [
    questKeys.proof(participationId),
    questKeys.proofHistory(participationId),
    questKeys.participation(participationId),
    questKeys.questParticipation(questId, userId),
    questKeys.active(userId),
    questKeys.underReview(userId),
  ];
}

/** Keys to invalidate after step progress update */
export function getStepProgressInvalidationKeys(participationId: string, userId: string) {
  return [
    questKeys.progress(participationId),
    questKeys.participation(participationId),
    questKeys.active(userId),
  ];
}
