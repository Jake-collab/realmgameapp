/**
 * useBadges — Fetches the current user's unlocked badges.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { progressionKeys } from '../queries/progressionKeys';
import { fetchMyBadges } from '../repositories/progression.repository';

export function useBadges() {
  const { user } = useAuth();
  const userId   = user?.id ?? '';

  return useQuery({
    queryKey:  progressionKeys.badges(userId),
    queryFn:   () => fetchMyBadges(userId),
    enabled:   Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}
