/**
 * useCompleteHuntStop — Worlds
 *
 * Mutation hook for marking a Hunt stop as complete.
 * Server validates proof/location. Client sends the signal; server decides.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcCompleteHuntStop } from '../repositories/hunt.repository';
import { getCompleteStopInvalidationKeys } from '../queries/huntKeys';
import { onStopCompleted } from '../events/huntEvents';
import type { HuntStopCompletionResult, StopCompletionMethod } from '../types/hunt.types';

interface CompleteHuntStopParams {
  participationId: string;
  stopId: string;
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
  validationMethod?: StopCompletionMethod;
}

export function useCompleteHuntStop() {
  const queryClient = useQueryClient();

  return useMutation<HuntStopCompletionResult, Error, CompleteHuntStopParams>({
    mutationFn: async ({ participationId, stopId, validationMethod = 'manual_confirmation' }) =>
      rpcCompleteHuntStop(participationId, stopId, validationMethod),
    onSuccess: (data, { participationId, stopId, huntId, occurrenceId = null, userId, validationMethod }) => {
      if (data.success) {
        onStopCompleted(userId, huntId, participationId, stopId, validationMethod ?? 'manual_confirmation');
        const keys = getCompleteStopInvalidationKeys(userId, participationId, huntId, occurrenceId ?? null);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}
