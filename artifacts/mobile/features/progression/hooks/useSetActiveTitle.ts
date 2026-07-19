/**
 * useSetActiveTitle — Mutation to atomically change the user's active title.
 *
 * Invalidates: titles, activeTitle, overview.
 * Never updates client-side state speculatively — awaits server confirmation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { setActiveTitle } from '../repositories/progression.repository';
import { getTitleChangeInvalidationKeys } from '../queries/progressionKeys';

export function useSetActiveTitle() {
  const { user }       = useAuth();
  const userId         = user?.id ?? '';
  const queryClient    = useQueryClient();

  return useMutation({
    mutationFn: (titleId: string) => setActiveTitle(userId, titleId),
    onSuccess: () => {
      const keys = getTitleChangeInvalidationKeys(userId);
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
    },
  });
}
