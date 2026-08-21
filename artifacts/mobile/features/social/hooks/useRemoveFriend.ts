import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { removeFriend } from '../repositories/social.repository';
import { getRemoveFriendInvalidationKeys } from '../queries/socialKeys';

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ friendUsername }: { friendUsername: string }) =>
      removeFriend(friendUsername),
    onSuccess: (_, { friendUsername }) => {
      const viewerId = user?.id ?? '';
      getRemoveFriendInvalidationKeys(friendUsername, viewerId).forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
