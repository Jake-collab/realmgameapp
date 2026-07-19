/**
 * useQuestProgress — Step progress for an active participation.
 */

import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchStepProgress } from '../repositories/quest.repository';
import { questKeys } from '../queries/questKeys';
import type { QuestStepProgressRow } from '@/lib/supabase/database.types';

export function useQuestProgress(participationId: string | null | undefined) {
  return useQuery<QuestStepProgressRow[]>({
    queryKey: questKeys.progress(participationId ?? ''),
    queryFn: () => fetchStepProgress(participationId!),
    enabled: !!participationId && isSupabaseConfigured(),
    staleTime: 15 * 1000,
    retry: 1,
  });
}
