/**
 * useStartQuest — Mutation hook for starting a quest.
 *
 * Rules:
 * - Invalidates relevant queries on success.
 * - Does NOT automatically retry on failure (avoid duplicate starts).
 * - Returns loading/error/success states for UI.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { startQuest } from '../services/questStart.service';
import { getStartQuestInvalidationKeys } from '../queries/questKeys';
import type { QuestStartResult } from '../types/quest.types';

interface UseStartQuestOptions {
  onSuccess?: (result: QuestStartResult) => void;
  onError?: (error: unknown) => void;
}

export function useStartQuest(options: UseStartQuestOptions = {}) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: (questId: string) =>
      startQuest({
        questId,
        context: {
          userId: user?.id ?? null,
          profile: profile
            ? {
                account_status: profile.account_status,
                onboarding_status: profile.onboarding_status,
              }
            : null,
          hasLocationPermission: false, // updated by caller from location service
        },
      }),
    onSuccess: async (result, questId) => {
      if (result.success && result.participation) {
        const userId = user?.id ?? '';
        const keys = getStartQuestInvalidationKeys(userId, questId, result.participation.id);
        await Promise.all(
          keys.map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
      }
      options.onSuccess?.(result);
    },
    onError: options.onError,
    retry: false, // Never auto-retry quest starts
  });
}
