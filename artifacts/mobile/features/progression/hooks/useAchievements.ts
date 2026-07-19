/**
 * useAchievements — Fetches the current user's unlocked achievements.
 * Optionally filtered by category.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { progressionKeys } from '../queries/progressionKeys';
import { fetchMyAchievements } from '../repositories/progression.repository';
import type { AchievementCategory } from '../types/progression.types';

export function useAchievements(category?: AchievementCategory) {
  const { user } = useAuth();
  const userId   = user?.id ?? '';

  return useQuery({
    queryKey: progressionKeys.achievements(userId, category),
    queryFn:  () => fetchMyAchievements(userId, category),
    enabled:  Boolean(userId),
    staleTime: 5 * 60 * 1000,  // 5 min
    gcTime:    10 * 60 * 1000,
  });
}
