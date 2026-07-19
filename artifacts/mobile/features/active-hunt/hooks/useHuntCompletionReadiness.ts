/**
 * useHuntCompletionReadiness — Worlds (Prompt 13)
 *
 * Server-side completion readiness evaluation.
 * More authoritative than client-side check.
 * Used to show the Complete Hunt button and associated state.
 *
 * Does NOT award points — that happens via useCompleteHunt.
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '@/features/hunts/queries/huntKeys';
import { fetchHuntCompletionReadiness } from '@/features/hunts/repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { ServerCompletionReadiness } from '../types/activeHunt.types';

interface UseHuntCompletionReadinessOptions {
  participationId: string | null;
  userId: string | null;
  enabled?: boolean;
}

export function useHuntCompletionReadiness({
  participationId,
  userId,
  enabled = true,
}: UseHuntCompletionReadinessOptions) {
  return useQuery<ServerCompletionReadiness | null>({
    queryKey: [...huntKeys.activeHunt(participationId ?? '', userId ?? ''), 'readiness'],
    queryFn: async () => {
      const raw = await fetchHuntCompletionReadiness(participationId!);
      if (!raw) return null;
      return {
        isReady:       raw.isReady ?? false,
        state:         raw.state ?? 'invalid_state',
        totalRequired: raw.totalRequired ?? 0,
        completed:     raw.completed ?? 0,
        userMessage:   raw.userMessage ?? '',
      };
    },
    enabled: enabled && !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 10_000,
    retry: 1,
  });
}
