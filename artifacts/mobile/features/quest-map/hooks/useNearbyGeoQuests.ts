/**
 * useNearbyGeoQuests — Worlds
 *
 * Fetches Geo-Quests sorted by approximate distance from the user's location.
 * Used for the bottom sheet nearby list.
 *
 * Rules:
 * - approximateLat/Lng must be rounded to 2dp before this hook is called.
 * - Does not expose exact user coordinates in cache keys or logs.
 * - Falls back to viewport quests when user location is unavailable.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { questMapKeys } from '../queries/questMapKeys';
import { fetchNearbyGeoQuests } from '../repositories/questMap.repository';
import type { GeoQuestMapFilter, PublicGeoQuestMapItem, NearbySortOrder } from '../types/questMap.types';
import { NEARBY_STALE_MS } from '../../maps/config/mapConfig';
import { distanceMiles } from '../../maps/utils/geoUtils';

interface UseNearbyGeoQuestsOptions {
  /** Rounded to 2dp before use — never raw GPS */
  approximateLat: number | null;
  approximateLng: number | null;
  radiusMeters?: number;
  filter: GeoQuestMapFilter;
  sortOrder: NearbySortOrder;
  enabled?: boolean;
}

export interface UseNearbyGeoQuestsResult {
  quests: PublicGeoQuestMapItem[];
  sortedQuests: PublicGeoQuestMapItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNearbyGeoQuests({
  approximateLat,
  approximateLng,
  radiusMeters = 25_000,
  filter,
  sortOrder,
  enabled = true,
}: UseNearbyGeoQuestsOptions): UseNearbyGeoQuestsResult {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const hasLocation = approximateLat !== null && approximateLng !== null;

  const query = useQuery<PublicGeoQuestMapItem[]>({
    queryKey: hasLocation
      ? questMapKeys.nearby(approximateLat!, approximateLng!, filter, userId)
      : ['quest-map', 'nearby', 'no-location'],

    queryFn: async () => {
      if (!hasLocation || !userId) return [];
      return fetchNearbyGeoQuests(
        userId,
        approximateLat!,
        approximateLng!,
        radiusMeters,
        filter,
      );
    },

    enabled: enabled && hasLocation && !!userId && isSupabaseConfigured(),
    staleTime: NEARBY_STALE_MS,
    retry: 1,
  });

  const sortedQuests = sortQuests(
    query.data ?? [],
    sortOrder,
    approximateLat,
    approximateLng,
  );

  return {
    quests: query.data ?? [],
    sortedQuests,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortQuests(
  quests: PublicGeoQuestMapItem[],
  sortOrder: NearbySortOrder,
  userLat: number | null,
  userLng: number | null,
): PublicGeoQuestMapItem[] {
  const copy = [...quests];

  switch (sortOrder) {
    case 'nearest':
      if (userLat !== null && userLng !== null) {
        return copy.sort((a, b) =>
          (a.approximateDistanceMeters ?? Infinity) -
          (b.approximateDistanceMeters ?? Infinity)
        );
      }
      return copy;

    case 'featured':
      return copy.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return (a.approximateDistanceMeters ?? Infinity) -
               (b.approximateDistanceMeters ?? Infinity);
      });

    case 'ending_soon':
      return copy.sort((a, b) => {
        const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aExpiry - bExpiry;
      });

    case 'highest_points':
      return copy.sort((a, b) => b.pointsReward - a.pointsReward);

    case 'easiest':
      return copy.sort((a, b) => {
        const order = { beginner: 0, intermediate: 1, advanced: 2 };
        return (order[a.difficulty ?? 'intermediate'] ?? 1) -
               (order[b.difficulty ?? 'intermediate'] ?? 1);
      });

    case 'shortest':
      return copy.sort((a, b) =>
        (a.estimatedDurationMinutes ?? Infinity) -
        (b.estimatedDurationMinutes ?? Infinity)
      );

    default:
      return copy;
  }
}
