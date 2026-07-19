/**
 * useTitles — Fetches the current user's unlocked titles.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { progressionKeys } from '../queries/progressionKeys';
import { fetchMyTitles } from '../repositories/progression.repository';

export function useTitles() {
  const { user } = useAuth();
  const userId   = user?.id ?? '';

  return useQuery({
    queryKey:  progressionKeys.titles(userId),
    queryFn:   () => fetchMyTitles(userId),
    enabled:   Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}
