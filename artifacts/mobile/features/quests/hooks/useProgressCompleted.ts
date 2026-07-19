/**
 * useProgressCompleted — Paginated completed quest history.
 * Supports filter + sort for the Completed section.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchCompletedParticipations } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type {
  CompletedQuestItem,
  CompletedFilter,
} from '../types/questProgress.types';
import { PROGRESS_PAGE_SIZE } from '../types/questProgress.types';

export function useProgressCompleted(filter: CompletedFilter) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    { items: CompletedQuestItem[]; hasMore: boolean },
    Error,
    { items: CompletedQuestItem[]; hasMore: boolean },
    ReturnType<typeof progressKeys.completed>,
    number
  >({
    queryKey: progressKeys.completed(userId, filter),
    queryFn: ({ pageParam = 1 }) =>
      fetchCompletedParticipations(userId, filter, pageParam, PROGRESS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
