/**
 * useDailyQuests — React Query hook for daily quest list.
 * Scoped to the authenticated user.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchQuestsByType } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';
import type { QuestRowExtended } from '../repositories/quest.repository';

export function useDailyQuests() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestRowExtended[]>({
    queryKey: questKeys.daily(userId),
    queryFn: () => fetchQuestsByType('daily'),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,  // 5 minutes — daily quests don't change often
    retry: 1,
  });
}
