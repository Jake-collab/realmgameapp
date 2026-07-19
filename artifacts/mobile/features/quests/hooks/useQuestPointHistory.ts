/**
 * useQuestPointHistory — Paginated quest point ledger history for the current user.
 * Includes quest_reward and reversal transactions linked to quest participations.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchQuestPointHistory } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { QuestPointTransaction } from '../types/questProgress.types';
import { PROGRESS_PAGE_SIZE } from '../types/questProgress.types';

export function useQuestPointHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    { items: QuestPointTransaction[]; hasMore: boolean },
    Error,
    { items: QuestPointTransaction[]; hasMore: boolean },
    ReturnType<typeof progressKeys.pointHistory>,
    number
  >({
    queryKey: progressKeys.pointHistory(userId),
    queryFn: ({ pageParam = 1 }) =>
      fetchQuestPointHistory(userId, pageParam, PROGRESS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
