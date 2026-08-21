import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { unblockUser } from '../repositories/social.repository';
import { getBlockUnblockInvalidationKeys } from '../queries/socialKeys';

export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ targetUsername }: { targetUsername: string }) =>
      unblockUser(targetUsername),
    onSuccess: (_, { targetUsername }) => {
      const viewerId = user?.id ?? '';
      getBlockUnblockInvalidationKeys(targetUsername, viewerId).forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
