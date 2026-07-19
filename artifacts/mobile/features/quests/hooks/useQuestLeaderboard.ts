/**
 * useQuestLeaderboard — Paginated Quest leaderboard for a selected period.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchQuestLeaderboard } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { QuestLeaderboardEntry, LeaderboardPeriod } from '../types/questProgress.types';
import { LEADERBOARD_PAGE_SIZE } from '../types/questProgress.types';

export function useQuestLeaderboard(period: LeaderboardPeriod) {
  return useInfiniteQuery<
    { entries: QuestLeaderboardEntry[]; hasMore: boolean },
    Error,
    { entries: QuestLeaderboardEntry[]; hasMore: boolean },
    ReturnType<typeof progressKeys.leaderboard>,
    number
  >({
    queryKey: progressKeys.leaderboard(period, 1),
    queryFn: ({ pageParam = 1 }) =>
      fetchQuestLeaderboard(period, pageParam, LEADERBOARD_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled: isSupabaseConfigured(),
    staleTime: 3 * 60 * 1000,   // leaderboard: 3 min stale (not live)
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
