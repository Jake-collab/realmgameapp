/**
 * useHuntPointHistory — Paginated Hunt-only point ledger history.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntPointHistory } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntPointTransaction } from '../types/huntProgress.types';
import { HUNT_PROGRESS_PAGE_SIZE } from '../types/huntProgress.types';

export function useHuntPointHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    { items: HuntPointTransaction[]; hasMore: boolean },
    Error,
    { items: HuntPointTransaction[]; hasMore: boolean },
    ReturnType<typeof huntProgressKeys.pointHistory>,
    number
  >({
    queryKey: huntProgressKeys.pointHistory(userId),
    queryFn:  ({ pageParam = 1 }) =>
      fetchHuntPointHistory(userId, pageParam, HUNT_PROGRESS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled:   !!userId && isSupabaseConfigured(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
