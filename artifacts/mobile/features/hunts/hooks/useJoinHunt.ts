/**
 * useJoinHunt — Worlds
 *
 * Mutation hook for joining a Hunt (or accepting an open invitation to join).
 * Idempotent: calling when already joined returns existing participation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcJoinHunt } from '../repositories/hunt.repository';
import { getJoinHuntInvalidationKeys } from '../queries/huntKeys';
import { onJoinAttempted, onHuntJoined } from '../events/huntEvents';
import { normalizeHuntError } from '../utils/huntErrors';
import type { HuntJoinResult } from '../types/hunt.types';

interface JoinHuntParams {
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
}

export function useJoinHunt() {
  const queryClient = useQueryClient();

  return useMutation<HuntJoinResult, Error, JoinHuntParams>({
    mutationFn: async ({ huntId, occurrenceId }) => {
      const result = await rpcJoinHunt(huntId, occurrenceId);
      return result;
    },
    onMutate: async ({ huntId, userId }) => {
      onJoinAttempted(userId, huntId, true);
    },
    onSuccess: (data, { huntId, occurrenceId = null, userId }) => {
      if (data.success && data.participationId) {
        onHuntJoined(userId, huntId, data.participationId);
        const keys = getJoinHuntInvalidationKeys(userId, huntId, occurrenceId);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      } else {
        onJoinAttempted(userId, huntId, false, data.reasonCode ?? undefined);
      }
    },
    onError: (_err, { huntId, userId }) => {
      onJoinAttempted(userId, huntId, false, 'UNKNOWN');
    },
  });
}
