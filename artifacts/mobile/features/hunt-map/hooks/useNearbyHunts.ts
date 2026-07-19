/**
 * useNearbyHunts — Worlds
 *
 * Fetches a sorted list of public Hunts near the user's approximate location.
 * Used for the nearby bottom sheet list.
 *
 * Privacy: approximate coordinates only — never stored, not used as cache key identity.
 */

import { useQuery } from '@tanstack/react-query';
import { huntMapKeys } from '../queries/huntMapKeys';
import { fetchNearbyHunts } from '../repositories/huntMap.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { HuntMapFilter, HuntNearbySortOrder, PublicHuntMapItem } from '../types/huntMap.types';

interface UseNearbyHuntsOptions {
  approximateLat: number | null;
  approximateLng: number | null;
  filter: HuntMapFilter;
  sortOrder: HuntNearbySortOrder;
  enabled?: boolean;
}

export function useNearbyHunts({
  approximateLat,
  approximateLng,
  filter,
  sortOrder,
  enabled = true,
}: UseNearbyHuntsOptions) {
  const { user } = useAuth();

  const query = useQuery<PublicHuntMapItem[]>({
    queryKey: huntMapKeys.nearby(approximateLat, approximateLng, sortOrder, filter),
    queryFn: () =>
      fetchNearbyHunts(approximateLat, approximateLng, filter, sortOrder, user?.id ?? null),
    enabled: enabled && isSupabaseConfigured(),
    staleTime: 60_000,
    gcTime:    5 * 60_000,
    retry: 1,
    initialData: [],
  });

  return {
    sortedHunts: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
