/**
 * useHuntDetail — Worlds
 *
 * Fetches full Hunt content for the Detail screen.
 * No private geometry. No locked clue content.
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '../queries/huntKeys';
import { fetchHuntDetail } from '../repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { HuntDetail } from '../types/hunt.types';

interface UseHuntDetailOptions {
  huntId: string;
  occurrenceId?: string | null;
  userId: string | null;
  enabled?: boolean;
}

export function useHuntDetail({
  huntId,
  occurrenceId = null,
  userId,
  enabled = true,
}: UseHuntDetailOptions) {
  return useQuery<HuntDetail | null>({
    queryKey: huntKeys.detail(huntId, occurrenceId, userId ?? ''),
    queryFn: () => fetchHuntDetail(huntId, userId ?? undefined),
    enabled: enabled && !!huntId && isSupabaseConfigured(),
    staleTime: 60_000,       // 1 min
    gcTime:    10 * 60_000,  // 10 min
    retry: 1,
  });
}
