/**
 * useHuntLeaderboard — Paginated Hunt leaderboard for a selected period.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntLeaderboard } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntLeaderboardEntry, LeaderboardPeriod } from '../types/huntProgress.types';
import { HUNT_LEADERBOARD_PAGE_SIZE } from '../types/huntProgress.types';

export function useHuntLeaderboard(period: LeaderboardPeriod) {
  return useInfiniteQuery<
    { entries: HuntLeaderboardEntry[]; hasMore: boolean },
    Error,
    { entries: HuntLeaderboardEntry[]; hasMore: boolean },
    ReturnType<typeof huntProgressKeys.leaderboard>,
    number
  >({
    queryKey: huntProgressKeys.leaderboard(period, 1),
    queryFn:  ({ pageParam = 1 }) =>
      fetchHuntLeaderboard(period, pageParam, HUNT_LEADERBOARD_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled:   isSupabaseConfigured(),
    staleTime: 3 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    retry: 1,
  });
}
