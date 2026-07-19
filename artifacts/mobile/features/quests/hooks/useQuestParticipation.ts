/**
 * useQuestParticipation — User's participation for a specific quest.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchUserParticipation } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';

export function useQuestParticipation(questId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestParticipationRowExtended | null>({
    queryKey: questKeys.questParticipation(questId ?? '', userId),
    queryFn: () => fetchUserParticipation(userId, questId!),
    enabled: !!questId && !!userId && isSupabaseConfigured(),
    staleTime: 30 * 1000,
    retry: 1,
  });
}
