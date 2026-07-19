/**
 * useCompleteQuest — Mutation hook for completing a quest.
 *
 * Rules:
 * - This is the ONLY path to awarding points.
 * - Never retry automatically — double completion must be guarded at service level.
 * - Points appear in the result only after confirmed server response.
 * - Idempotent: if the quest was already completed, returns the existing result.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { completeQuest } from '../services/questCompletion.service';
import { getCompleteQuestInvalidationKeys } from '../queries/questKeys';
import type { QuestCompletionResult } from '../types/quest.types';

interface UseCompleteQuestOptions {
  questId: string;
  onSuccess?: (result: QuestCompletionResult) => void;
  onError?: (error: unknown) => void;
}

export function useCompleteQuest(options: UseCompleteQuestOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (participationId: string) =>
      completeQuest({ participationId, userId: user?.id ?? '' }),
    onSuccess: async (result, participationId) => {
      if (result.success) {
        const userId = user?.id ?? '';
        const keys = getCompleteQuestInvalidationKeys(userId, options.questId, participationId);
        await Promise.all(
          keys.map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
      }
      options.onSuccess?.(result);
    },
    onError: options.onError,
    retry: false, // Never auto-retry completions — idempotency key handles race
  });
}
