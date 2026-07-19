/**
 * useWithdrawFromHunt — Worlds
 *
 * Mutation hook for withdrawing from a Hunt the user has joined.
 * Idempotent: calling when already withdrawn returns success.
 * Not available for completed hunts.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcWithdrawFromHunt } from '../repositories/hunt.repository';
import { getWithdrawHuntInvalidationKeys } from '../queries/huntKeys';
import { onParticipantWithdrew } from '../events/huntEvents';
import type { HuntWithdrawalResult } from '../types/hunt.types';

interface WithdrawFromHuntParams {
  participationId: string;
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
  reason?: string;
}

export function useWithdrawFromHunt() {
  const queryClient = useQueryClient();

  return useMutation<HuntWithdrawalResult, Error, WithdrawFromHuntParams>({
    mutationFn: async ({ participationId, reason }) =>
      rpcWithdrawFromHunt(participationId, reason),
    onSuccess: (data, { participationId, huntId, occurrenceId = null, userId }) => {
      if (data.success) {
        onParticipantWithdrew(userId, huntId, participationId);
        const keys = getWithdrawHuntInvalidationKeys(userId, huntId, participationId, occurrenceId);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}
