/**
 * useInviteToHunt — Worlds
 *
 * Mutation hook for inviting a user to a Hunt.
 * Only available to creators and co-hosts.
 * Idempotent: sending a duplicate invitation returns the existing pending one.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcInviteToHunt } from '../repositories/hunt.repository';
import { huntKeys } from '../queries/huntKeys';
import { onHuntInvitationCreated } from '../events/huntEvents';
import type { HuntInviteResult } from '../types/hunt.types';

interface InviteToHuntParams {
  huntId: string;
  inviteeId: string;
  occurrenceId?: string | null;
  message?: string | null;
  userId: string;
}

export function useInviteToHunt() {
  const queryClient = useQueryClient();

  return useMutation<HuntInviteResult, Error, InviteToHuntParams>({
    mutationFn: async ({ huntId, inviteeId, occurrenceId, message }) =>
      rpcInviteToHunt(huntId, inviteeId, occurrenceId, message),
    onSuccess: (data, { huntId, userId, occurrenceId }) => {
      if (data.success && data.invitationId) {
        onHuntInvitationCreated(userId, huntId, data.invitationId, occurrenceId ?? undefined);
        // Invalidate capacity state for this hunt
        queryClient.invalidateQueries({ queryKey: huntKeys.detail(huntId, occurrenceId ?? null, userId) });
      }
    },
  });
}
