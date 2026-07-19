/**
 * useHuntCompleted — Paginated completed Hunt history for the Progress screen.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntCompleted } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { CompletedHuntItem, HuntCompletedFilter } from '../types/huntProgress.types';
import { HUNT_PROGRESS_PAGE_SIZE } from '../types/huntProgress.types';

export function useHuntCompleted(filter: HuntCompletedFilter) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    { items: CompletedHuntItem[]; hasMore: boolean },
    Error,
    { items: CompletedHuntItem[]; hasMore: boolean },
    ReturnType<typeof huntProgressKeys.completed>,
    number
  >({
    queryKey: huntProgressKeys.completed(userId, filter),
    queryFn:  ({ pageParam = 1 }) =>
      fetchHuntCompleted(userId, filter, pageParam, HUNT_PROGRESS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled:   !!userId && isSupabaseConfigured(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
