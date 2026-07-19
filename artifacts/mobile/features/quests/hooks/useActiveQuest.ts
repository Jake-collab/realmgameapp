/**
 * useActiveQuest — The user's currently active participation(s).
 * Returns all active participations ordered by urgency.
 * Used by the Home screen to determine the dominant active panel.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchActiveParticipations } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';

export function useActiveQuest() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestParticipationRowExtended[]>({
    queryKey: questKeys.active(userId),
    queryFn: () => fetchActiveParticipations(userId),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // poll every minute to catch review decisions
    retry: 1,
  });
}
