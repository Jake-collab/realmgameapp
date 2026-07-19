/**
 * useSubmitQuestProof — Mutation hook for submitting proof.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { submitQuestProof } from '../services/questProof.service';
import { getSubmitProofInvalidationKeys } from '../queries/questKeys';

interface UseSubmitQuestProofOptions {
  questId: string;
  participationId: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useSubmitQuestProof(options: UseSubmitQuestProofOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (proofId: string) =>
      submitQuestProof(proofId, user?.id ?? '', options.participationId),
    onSuccess: async () => {
      const userId = user?.id ?? '';
      const keys = getSubmitProofInvalidationKeys(userId, options.questId, options.participationId);
      await Promise.all(keys.map(key => queryClient.invalidateQueries({ queryKey: key })));
      options.onSuccess?.();
    },
    onError: options.onError,
    retry: false,
  });
}
