/**
 * useStartHunt — Worlds
 *
 * Mutation hook for starting (activating) an already-joined Hunt.
 * Idempotent: calling when already active returns current state.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcStartHunt } from '../repositories/hunt.repository';
import { getStartHuntInvalidationKeys } from '../queries/huntKeys';
import { onHuntStarted } from '../events/huntEvents';
import { normalizeHuntError } from '../utils/huntErrors';
import type { HuntStartResult } from '../types/hunt.types';

interface StartHuntParams {
  participationId: string;
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
}

export function useStartHunt() {
  const queryClient = useQueryClient();

  return useMutation<HuntStartResult, Error, StartHuntParams>({
    mutationFn: async ({ participationId }) => {
      return rpcStartHunt(participationId);
    },
    onSuccess: (data, { participationId, huntId, occurrenceId = null, userId }) => {
      if (data.success && data.participationId) {
        onHuntStarted(userId, huntId, participationId, occurrenceId ?? undefined);
        const keys = getStartHuntInvalidationKeys(userId, huntId, participationId, occurrenceId);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}
