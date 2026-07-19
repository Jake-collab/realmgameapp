/**
 * useHuntMapViewport — Worlds
 *
 * Fetches public Hunt map items within the current visible bounding box.
 * Mirrors the quest-map pattern with Hunt-specific keys.
 *
 * Privacy: only published public hunts. No private geometry returned.
 */

import { useQuery } from '@tanstack/react-query';
import { huntMapKeys } from '../queries/huntMapKeys';
import { fetchHuntsInViewport } from '../repositories/huntMap.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { BoundingBox } from '../../maps/utils/geoUtils';
import type { HuntMapFilter, PublicHuntMapItem, HuntViewportResponse } from '../types/huntMap.types';

interface UseHuntMapViewportOptions {
  bounds: BoundingBox | null;
  zoomLevel: number;
  filter: HuntMapFilter;
  approximateUserLat?: number;
  approximateUserLng?: number;
  enabled?: boolean;
}

export function useHuntMapViewport({
  bounds,
  zoomLevel,
  filter,
  approximateUserLat,
  approximateUserLng,
  enabled = true,
}: UseHuntMapViewportOptions) {
  const { user } = useAuth();

  const query = useQuery<HuntViewportResponse>({
    queryKey: huntMapKeys.viewport(
      bounds,
      zoomLevel,
      filter,
      approximateUserLat,
      approximateUserLng,
    ),
    queryFn: () =>
      fetchHuntsInViewport(bounds!, filter, user?.id ?? null),
    enabled: enabled && !!bounds && isSupabaseConfigured(),
    staleTime: 60_000,       // 1 min — map content changes infrequently
    gcTime:    5 * 60_000,
    retry: 1,
    placeholderData: (prev) => prev, // keep prior viewport visible during refetch
  });

  return {
    hunts: query.data?.hunts ?? [] as PublicHuntMapItem[],
    totalCount: query.data?.totalCount ?? 0,
    isLimitReached: query.data?.isLimitReached ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
