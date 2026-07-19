/**
 * useHuntSubmissionHistory — Proof submission history for a Hunt participation.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntSubmissionHistory } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntSubmissionHistoryItem } from '../types/huntProgress.types';

export function useHuntSubmissionHistory(participationId: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<HuntSubmissionHistoryItem[]>({
    queryKey: huntProgressKeys.submissionHistory(participationId ?? ''),
    queryFn:  () =>
      participationId && userId
        ? fetchHuntSubmissionHistory(participationId, userId)
        : Promise.resolve([]),
    enabled:   !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 60 * 1000,
    retry: 1,
  });
}
