/**
 * useAchievementHistory — Paginated achievement timeline for the current user.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { progressionKeys } from '../queries/progressionKeys';
import { fetchAchievementHistory } from '../repositories/progression.repository';
import { ACHIEVEMENT_PAGE_SIZE } from '../types/progression.types';

export function useAchievementHistory() {
  const { user } = useAuth();
  const userId   = user?.id ?? '';

  return useInfiniteQuery({
    queryKey:          progressionKeys.achievementHistory(userId),
    queryFn:           ({ pageParam = 1 }) =>
                         fetchAchievementHistory(userId, pageParam as number, ACHIEVEMENT_PAGE_SIZE),
    getNextPageParam:  (lastPage, allPages) =>
                         lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam:  1,
    enabled:           Boolean(userId),
    staleTime:         5 * 60 * 1000,
    gcTime:            10 * 60 * 1000,
  });
}
