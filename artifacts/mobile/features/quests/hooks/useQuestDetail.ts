/**
 * useQuestDetail — Full quest detail with objectives and public location.
 * Does NOT include geofence validation data.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchQuestById, type QuestWithRelations } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';

export function useQuestDetail(questId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestWithRelations | null>({
    queryKey: questKeys.detail(questId ?? '', userId),
    queryFn: () => fetchQuestById(questId!),
    enabled: !!questId && !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
