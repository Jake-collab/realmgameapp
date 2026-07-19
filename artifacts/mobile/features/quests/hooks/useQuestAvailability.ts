/**
 * useQuestAvailability — Evaluated availability state for a specific quest.
 *
 * Combines quest data + user participation + eligibility into a single state.
 * This is the authoritative hook for driving UI action state on quest screens.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchQuestById, fetchUserParticipation } from '../repositories/quest.repository';
import { evaluateQuestAvailability } from '../services/questAvailability.service';
import { questKeys } from '../queries/questKeys';
import type { QuestAvailabilityResult } from '../types/quest.types';

export function useQuestAvailability(questId: string | null | undefined) {
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestAvailabilityResult>({
    queryKey: questKeys.availability(questId ?? '', userId),
    queryFn: async () => {
      const [quest, participation] = await Promise.all([
        fetchQuestById(questId!),
        fetchUserParticipation(userId, questId!),
      ]);

      if (!quest) {
        return {
          state: 'ineligible' as const,
          canStart: false,
          userMessage: "This quest doesn't seem to exist anymore.",
        } satisfies import('../types/quest.types').QuestAvailabilityResult;
      }

      return evaluateQuestAvailability({
        quest,
        context: {
          userId,
          profile: profile
            ? {
                account_status: profile.account_status,
                onboarding_status: profile.onboarding_status,
              }
            : null,
          hasLocationPermission: false, // updated by location hook in Map screen
        },
        existingParticipation: participation,
      });
    },
    enabled: !!questId && !!userId && isSupabaseConfigured(),
    staleTime: 30 * 1000, // 30 seconds — availability can change quickly
    retry: 1,
  });
}
