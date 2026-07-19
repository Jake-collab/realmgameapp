/**
 * useMyHunts — Worlds
 *
 * Fetches the user's Hunt summary (active, ready, completed, invitations).
 * Displayed on the My Hunts tab.
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '../queries/huntKeys';
import { fetchMyHuntsSummary } from '../repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { MyHuntsSummary } from '../types/hunt.types';

interface UseMyHuntsOptions {
  userId: string | null;
  enabled?: boolean;
}

export function useMyHunts({ userId, enabled = true }: UseMyHuntsOptions) {
  return useQuery<MyHuntsSummary>({
    queryKey: huntKeys.mySummary(userId ?? ''),
    queryFn: fetchMyHuntsSummary,
    enabled: enabled && !!userId && isSupabaseConfigured(),
    staleTime: 30_000,
    gcTime:    5 * 60_000,
    retry: 1,
    select: (data) => ({
      ...data,
      totalActiveCount: data.active.length,
    }),
  });
}
