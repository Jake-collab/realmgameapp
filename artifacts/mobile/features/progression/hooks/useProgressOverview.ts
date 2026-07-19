/**
 * useProgressOverview — Compact summary for the Profile header.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { progressionKeys } from '../queries/progressionKeys';
import { fetchProgressOverview } from '../repositories/progression.repository';

export function useProgressOverview() {
  const { user } = useAuth();
  const userId   = user?.id ?? '';

  return useQuery({
    queryKey:  progressionKeys.overview(userId),
    queryFn:   () => fetchProgressOverview(userId),
    enabled:   Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}
