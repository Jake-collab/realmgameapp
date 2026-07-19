/**
 * useSubmitHuntProof — Worlds (Prompt 13)
 *
 * Mutation hook for submitting proof for a hunt stop.
 * Server creates the proof_submission record and updates stop progress.
 * No optimistic proof approval — result is always server-authoritative.
 *
 * After success: invalidates active hunt + stop progress + completion readiness.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpcSubmitHuntProof } from '@/features/hunts/repositories/hunt.repository';
import { huntKeys, getCompleteStopInvalidationKeys } from '@/features/hunts/queries/huntKeys';

interface SubmitHuntProofParams {
  participationId: string;
  stopId: string;
  huntId: string;
  occurrenceId?: string | null;
  userId: string;
  submissionType: string;
  textResponse?: string | null;
  mediaIds?: string[] | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationAccuracy?: number | null;
  previousSubmissionId?: string | null;
}

export function useSubmitHuntProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitHuntProofParams) =>
      rpcSubmitHuntProof(
        params.participationId,
        params.stopId,
        params.submissionType,
        params.textResponse,
        params.mediaIds,
        params.locationLat,
        params.locationLng,
        params.locationAccuracy,
        params.previousSubmissionId,
      ),
    retry: 0, // Do not retry — server handles idempotency
    onSuccess: (_data, { participationId, huntId, occurrenceId = null, userId, stopId }) => {
      // Invalidate active hunt state (stop progress has changed)
      queryClient.invalidateQueries({
        queryKey: huntKeys.activeHunt(participationId, userId),
      });
      // Invalidate stop progress
      queryClient.invalidateQueries({
        queryKey: huntKeys.stopProgress(participationId, userId),
      });
      // Invalidate submission detail
      queryClient.invalidateQueries({
        queryKey: huntKeys.submissions(participationId, stopId, userId),
      });
      // Invalidate completion readiness
      queryClient.invalidateQueries({
        queryKey: huntKeys.active(userId),
      });
      queryClient.invalidateQueries({
        queryKey: huntKeys.mySummary(userId),
      });
    },
  });
}
