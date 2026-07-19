/**
 * useCompletedQuests — Paginated completion history for the authenticated user.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchUserParticipations } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';

export function useCompletedQuests() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestParticipationRowExtended[]>({
    queryKey: questKeys.completed(userId),
    queryFn: () => fetchUserParticipations(userId, ['completed']),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
