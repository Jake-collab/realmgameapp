/**
 * useHomeQuestSummary — Quest availability summary for the Home screen.
 * Returns the selected daily, monthly, and geo quest counts in a single query.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getHomeQuestSummary, type HomeQuestSummary } from '../services/questSelection.service';
import { questKeys } from '../queries/questKeys';

export function useHomeQuestSummary(completedOccurrenceKeys: Set<string>) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<HomeQuestSummary>({
    queryKey: questKeys.home(userId),
    queryFn: () => getHomeQuestSummary(userId, completedOccurrenceKeys),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
