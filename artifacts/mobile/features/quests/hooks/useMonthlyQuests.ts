/**
 * useMonthlyQuests — React Query hook for monthly quest drop list.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchQuestsByType } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';
import type { QuestRowExtended } from '../repositories/quest.repository';

export function useMonthlyQuests() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestRowExtended[]>({
    queryKey: questKeys.monthly(userId),
    queryFn: () => fetchQuestsByType('monthly'),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 15 * 60 * 1000, // 15 minutes — monthly quests are very stable
    retry: 1,
  });
}
