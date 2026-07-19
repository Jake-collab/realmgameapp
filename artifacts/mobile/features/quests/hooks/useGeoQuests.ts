/**
 * useGeoQuests — React Query hook for geo-quest list.
 * Optionally filtered by approximate user location.
 * Precise coordinates are NEVER sent to the server — only rounded values are
 * used in the query key to avoid cache fragmentation.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAvailableGeoQuests } from '../services/questSelection.service';
import { questKeys } from '../queries/questKeys';
import type { QuestRowExtended } from '../repositories/quest.repository';

interface UseGeoQuestsOptions {
  /** Approximate user latitude (rounded to 2dp in cache key) */
  userLat?: number;
  /** Approximate user longitude (rounded to 2dp in cache key) */
  userLng?: number;
}

export function useGeoQuests(options: UseGeoQuestsOptions = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestRowExtended[]>({
    queryKey: questKeys.geo(userId, options.userLat, options.userLng),
    queryFn: () => getAvailableGeoQuests(),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
