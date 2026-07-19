/**
 * useHuntOtherActivity — Paginated archived Hunt participations.
 * (withdrawn, removed, cancelled, expired)
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntOtherActivity } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntOtherActivityItem } from '../types/huntProgress.types';
import { HUNT_PROGRESS_PAGE_SIZE } from '../types/huntProgress.types';

export function useHuntOtherActivity() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    { items: HuntOtherActivityItem[]; hasMore: boolean },
    Error,
    { items: HuntOtherActivityItem[]; hasMore: boolean },
    ReturnType<typeof huntProgressKeys.otherActivity>,
    number
  >({
    queryKey: huntProgressKeys.otherActivity(userId),
    queryFn:  ({ pageParam = 1 }) =>
      fetchHuntOtherActivity(userId, pageParam, HUNT_PROGRESS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled:   !!userId && isSupabaseConfigured(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
