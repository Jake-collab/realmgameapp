/**
 * useGeoQuestViewport — Worlds
 *
 * React Query hook for fetching public Geo-Quests within the current map viewport.
 *
 * Rules:
 * - Uses rounded/generalized bounds in the cache key — no raw GPS.
 * - Debounced via external state — this hook does NOT self-debounce.
 * - Stale requests are cancelled by React Query's built-in AbortSignal.
 * - On map movement, existing markers remain visible until new data arrives.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { questMapKeys } from '../queries/questMapKeys';
import { fetchGeoQuestViewport } from '../repositories/questMap.repository';
import type { GeoQuestMapFilter, PublicGeoQuestMapItem } from '../types/questMap.types';
import type { BoundingBox } from '../../maps/utils/geoUtils';
import { cacheRoundBBox } from '../../maps/utils/geoUtils';
import { VIEWPORT_STALE_MS, VIEWPORT_RESULT_LIMIT } from '../../maps/config/mapConfig';

interface UseGeoQuestViewportOptions {
  bounds: BoundingBox | null;
  zoomLevel: number;
  filter: GeoQuestMapFilter;
  approximateUserLat?: number;
  approximateUserLng?: number;
  /** Pass false to pause querying (e.g. while map is animating) */
  enabled?: boolean;
}

export interface UseGeoQuestViewportResult {
  quests: PublicGeoQuestMapItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGeoQuestViewport({
  bounds,
  zoomLevel,
  filter,
  approximateUserLat,
  approximateUserLng,
  enabled = true,
}: UseGeoQuestViewportOptions): UseGeoQuestViewportResult {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  // Use rounded bounds for cache key stability
  const roundedBounds = bounds ? cacheRoundBBox(bounds) : null;

  const query = useQuery<PublicGeoQuestMapItem[]>({
    queryKey: roundedBounds
      ? questMapKeys.viewport(
          roundedBounds.west, roundedBounds.south,
          roundedBounds.east, roundedBounds.north,
          filter, userId,
        )
      : ['quest-map', 'viewport', 'no-bounds'],

    queryFn: async () => {
      if (!bounds || !userId) return [];
      return fetchGeoQuestViewport(
        userId, bounds, filter,
        VIEWPORT_RESULT_LIMIT,
        approximateUserLat,
        approximateUserLng,
      );
    },

    enabled: enabled && !!bounds && !!userId && isSupabaseConfigured(),
    staleTime: VIEWPORT_STALE_MS,
    // Keep previous data visible while new query loads
    placeholderData: (previousData) => previousData,
    retry: 1,
    // Do not retry on network errors during validation — different retry policy
    retryDelay: 3000,
  });

  return {
    quests: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
