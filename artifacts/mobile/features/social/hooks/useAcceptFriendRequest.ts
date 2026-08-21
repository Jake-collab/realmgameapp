import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { acceptFriendRequest } from '../repositories/social.repository';
import { getAcceptRequestInvalidationKeys } from '../queries/socialKeys';

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ requestId, requesterUsername }: { requestId: string; requesterUsername: string }) =>
      acceptFriendRequest(requestId),
    onSuccess: (_, { requesterUsername }) => {
      const viewerId = user?.id ?? '';
      getAcceptRequestInvalidationKeys(requesterUsername, viewerId).forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
