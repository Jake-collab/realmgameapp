/**
 * useActiveHunt — Worlds
 *
 * Fetches the authorized active Hunt state for a participant.
 * Includes revealed stop details and clue content (server-gated).
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '../queries/huntKeys';
import { fetchActiveHunt } from '../repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { ActiveHunt } from '../types/hunt.types';

interface UseActiveHuntOptions {
  participationId: string | null;
  userId: string | null;
  enabled?: boolean;
  /** Polling interval in ms. Use 0 to disable. Default: 0 (no polling) */
  pollingIntervalMs?: number;
}

export function useActiveHunt({
  participationId,
  userId,
  enabled = true,
  pollingIntervalMs = 0,
}: UseActiveHuntOptions) {
  return useQuery<ActiveHunt | null>({
    queryKey: huntKeys.activeHunt(participationId ?? '', userId ?? ''),
    queryFn: () => fetchActiveHunt(participationId!),
    enabled: enabled && !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 15_000,      // 15s — stop progress may update frequently
    gcTime:    5 * 60_000,
    refetchInterval: pollingIntervalMs > 0 ? pollingIntervalMs : false,
    retry: 1,
  });
}
