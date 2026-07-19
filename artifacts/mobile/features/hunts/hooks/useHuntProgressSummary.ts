/**
 * useHuntProgressSummary — Compact Hunt progress summary counts.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntProgressSummary } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type { HuntProgressSummary } from '../types/huntProgress.types';

export function useHuntProgressSummary() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<HuntProgressSummary | null>({
    queryKey: huntProgressKeys.summary(userId),
    queryFn:  () => fetchHuntProgressSummary(userId),
    enabled:  !!userId && isSupabaseConfigured(),
    staleTime: 60 * 1000,
    retry: 1,
  });
}
