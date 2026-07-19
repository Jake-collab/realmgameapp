/**
 * useHuntCompletionDetail — Full completion detail for one Hunt participation.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntCompletionDetail } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntCompletionDetail } from '../types/huntProgress.types';

export function useHuntCompletionDetail(participationId: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<HuntCompletionDetail | null>({
    queryKey: huntProgressKeys.completionDetail(participationId ?? ''),
    queryFn:  () =>
      participationId && userId
        ? fetchHuntCompletionDetail(participationId, userId)
        : Promise.resolve(null),
    enabled:   !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
