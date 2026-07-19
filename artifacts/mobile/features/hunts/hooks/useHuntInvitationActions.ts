/**
 * useHuntInvitationActions — Worlds
 *
 * Mutation hooks for accepting and declining Hunt invitations.
 * Both are idempotent.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcAcceptHuntInvitation, rpcDeclineHuntInvitation } from '../repositories/hunt.repository';
import {
  getAcceptInvitationInvalidationKeys,
  getDeclineInvitationInvalidationKeys,
} from '../queries/huntKeys';
import { onInvitationAccepted, onInvitationDeclined } from '../events/huntEvents';
import type { HuntInvitationActionResult } from '../types/hunt.types';

// ─── Accept invitation ────────────────────────────────────────────────────────

interface AcceptInvitationParams {
  invitationId: string;
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
}

export function useAcceptHuntInvitation() {
  const queryClient = useQueryClient();

  return useMutation<HuntInvitationActionResult, Error, AcceptInvitationParams>({
    mutationFn: async ({ invitationId }) => rpcAcceptHuntInvitation(invitationId),
    onSuccess: (data, { invitationId, huntId, occurrenceId = null, userId }) => {
      if (data.success && data.participationId) {
        onInvitationAccepted(userId, huntId, invitationId, data.participationId);
        const keys = getAcceptInvitationInvalidationKeys(userId, huntId, invitationId, occurrenceId);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}

// ─── Decline invitation ───────────────────────────────────────────────────────

interface DeclineInvitationParams {
  invitationId: string;
  huntId: string;
  userId: string;
}

export function useDeclineHuntInvitation() {
  const queryClient = useQueryClient();

  return useMutation<HuntInvitationActionResult, Error, DeclineInvitationParams>({
    mutationFn: async ({ invitationId }) => rpcDeclineHuntInvitation(invitationId),
    onSuccess: (data, { invitationId, huntId, userId }) => {
      if (data.success) {
        onInvitationDeclined(userId, huntId, invitationId);
        const keys = getDeclineInvitationInvalidationKeys(userId, invitationId);
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}
