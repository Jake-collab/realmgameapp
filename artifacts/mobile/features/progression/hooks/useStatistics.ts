/**
 * useStatistics — Combined cross-mode statistics for the current user.
 * Always server-computed. Never derived client-side.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { progressionKeys } from '../queries/progressionKeys';
import { fetchCombinedStatistics } from '../repositories/progression.repository';

export function useStatistics() {
  const { user } = useAuth();
  const userId   = user?.id ?? '';

  return useQuery({
    queryKey:  progressionKeys.statistics(userId),
    queryFn:   () => fetchCombinedStatistics(userId),
    enabled:   Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}
