/**
 * useHuntAvailability — Worlds
 *
 * Fetches the server-authoritative availability state for a Hunt + user pair.
 * Used by Map, Detail, My Hunts, and Invitation screens.
 * Never duplicate this state derivation in components.
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '../queries/huntKeys';
import { fetchHuntAvailability } from '../repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { HuntAvailabilityResult } from '../types/hunt.types';

interface UseHuntAvailabilityOptions {
  huntId: string;
  occurrenceId?: string | null;
  userId: string | null;
  enabled?: boolean;
}

export function useHuntAvailability({
  huntId,
  occurrenceId = null,
  userId,
  enabled = true,
}: UseHuntAvailabilityOptions) {
  return useQuery<HuntAvailabilityResult | null>({
    queryKey: huntKeys.availability(huntId, occurrenceId, userId ?? ''),
    queryFn: () => fetchHuntAvailability(huntId, occurrenceId),
    enabled: enabled && !!huntId && !!userId && isSupabaseConfigured(),
    staleTime: 30_000,     // 30s — availability changes infrequently
    gcTime:    5 * 60_000, // 5 min
    retry: 1,
  });
}
