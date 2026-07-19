/**
 * useAbandonQuest — Mutation hook for abandoning a quest.
 * UI layer must confirm with the user before calling this.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { abandonQuest } from '../services/questAbandonment.service';
import { getAbandonQuestInvalidationKeys } from '../queries/questKeys';
import type { AbandonQuestResult } from '../services/questAbandonment.service';

interface UseAbandonQuestOptions {
  onSuccess?: (result: AbandonQuestResult) => void;
  onError?: (error: unknown) => void;
}

export function useAbandonQuest(questId: string, options: UseAbandonQuestOptions = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (participationId: string) =>
      abandonQuest({ participationId, userId: user?.id ?? '' }),
    onSuccess: async (result, participationId) => {
      const userId = user?.id ?? '';
      const keys = getAbandonQuestInvalidationKeys(userId, questId, participationId);
      await Promise.all(keys.map(key => queryClient.invalidateQueries({ queryKey: key })));
      options.onSuccess?.(result);
    },
    onError: options.onError,
    retry: false,
  });
}
