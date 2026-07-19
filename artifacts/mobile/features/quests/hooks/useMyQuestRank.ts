/**
 * useMyQuestRank — Current user's rank and qualifying points for a period.
 * Works regardless of leaderboard_visibility setting (private data).
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchMyQuestRank } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { QuestCurrentRank, LeaderboardPeriod } from '../types/questProgress.types';

export function useMyQuestRank(period: LeaderboardPeriod) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestCurrentRank | null>({
    queryKey: progressKeys.currentRank(userId, period),
    queryFn: () => fetchMyQuestRank(period),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
