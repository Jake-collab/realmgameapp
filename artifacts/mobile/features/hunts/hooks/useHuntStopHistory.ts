/**
 * useHuntStopHistory — Stop-by-stop completion history for a participation.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntStopHistory } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntStopHistoryEntry } from '../types/huntProgress.types';

export function useHuntStopHistory(participationId: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<HuntStopHistoryEntry[]>({
    queryKey: huntProgressKeys.stopHistory(participationId ?? ''),
    queryFn:  () =>
      participationId && userId
        ? fetchHuntStopHistory(participationId, userId)
        : Promise.resolve([]),
    enabled:   !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
