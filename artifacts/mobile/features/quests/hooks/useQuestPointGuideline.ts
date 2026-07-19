/**
 * useQuestPointGuideline — Point reward range for a given difficulty.
 * Used by admin panel (Prompt 17) and AI suggestion (Prompt 18).
 */

import { useQuery } from '@tanstack/react-query';
import { getPointRewardGuideline } from '../services/questSelection.service';
import { questKeys } from '../queries/questKeys';
import type { Difficulty } from '@/lib/supabase/database.types';
import type { PointRewardGuideline } from '../types/quest.types';

export function useQuestPointGuideline(difficulty: Difficulty | null | undefined) {
  return useQuery<PointRewardGuideline | null>({
    queryKey: [...questKeys.guidelines(), difficulty],
    queryFn: () => getPointRewardGuideline(difficulty!),
    enabled: !!difficulty,
    staleTime: 60 * 60 * 1000, // 1 hour — guidelines are very stable
    retry: 1,
  });
}
