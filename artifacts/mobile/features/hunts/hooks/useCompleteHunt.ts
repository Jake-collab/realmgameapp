/**
 * useCompleteHunt — Worlds
 *
 * Mutation hook for completing a Hunt and claiming points.
 * Idempotent: calling twice returns the existing completion result.
 * Points are issued exactly once via idempotency key.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcCompleteHunt } from '../repositories/hunt.repository';
import { getCompleteHuntInvalidationKeys } from '../queries/huntKeys';
import { onHuntCompleted } from '../events/huntEvents';
import type { HuntCompletionResult } from '../types/hunt.types';

interface CompleteHuntParams {
  participationId: string;
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
}

export function useCompleteHunt() {
  const queryClient = useQueryClient();

  return useMutation<HuntCompletionResult, Error, CompleteHuntParams>({
    mutationFn: async ({ participationId }) => rpcCompleteHunt(participationId),
    onSuccess: (data, { participationId, huntId, occurrenceId = null, userId }) => {
      if (data.success) {
        onHuntCompleted(
          userId,
          huntId,
          participationId,
          data.awardedPoints ?? 0,
          occurrenceId ?? undefined,
        );
        const keys = getCompleteHuntInvalidationKeys(userId, huntId, participationId, occurrenceId);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}
