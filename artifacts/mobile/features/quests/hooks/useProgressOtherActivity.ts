/**
 * useProgressOtherActivity — Paginated Other Activity (archived) history.
 * Covers abandoned, expired, and final-rejected participations.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchOtherActivityParticipations } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { OtherActivityItem } from '../types/questProgress.types';
import { PROGRESS_PAGE_SIZE } from '../types/questProgress.types';

export function useProgressOtherActivity() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    { items: OtherActivityItem[]; hasMore: boolean },
    Error,
    { items: OtherActivityItem[]; hasMore: boolean },
    ReturnType<typeof progressKeys.otherActivity>,
    number
  >({
    queryKey: progressKeys.otherActivity(userId),
    queryFn: ({ pageParam = 1 }) =>
      fetchOtherActivityParticipations(userId, pageParam, PROGRESS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
