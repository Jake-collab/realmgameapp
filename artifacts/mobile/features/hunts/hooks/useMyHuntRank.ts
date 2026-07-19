/**
 * useMyHuntRank — Current user's Hunt rank for a given period.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchMyHuntRank } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntCurrentRank, LeaderboardPeriod } from '../types/huntProgress.types';

export function useMyHuntRank(period: LeaderboardPeriod) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<HuntCurrentRank | null>({
    queryKey: huntProgressKeys.currentRank(userId, period),
    queryFn:  () => fetchMyHuntRank(period),
    enabled:  !!userId && isSupabaseConfigured(),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
