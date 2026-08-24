import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getMyInterests } from '@/services/profile/profile.service';
import { selectDailyQuest } from '../services/questSelection.service';
import { questKeys } from '../queries/questKeys';
import type { QuestRowExtended } from '../repositories/quest.repository';

export function useAssignedDailyQuest() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<QuestRowExtended | null>({
    queryKey: questKeys.assignedDaily(userId),
    queryFn: async () => {
      const interests = await getMyInterests(userId);
      return selectDailyQuest({
        userId,
        userInterestIds: interests.map((interest) => interest.id),
        completedOccurrenceKeys: new Set<string>(),
      });
    },
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}