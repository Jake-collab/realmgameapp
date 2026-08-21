import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { declineFriendRequest } from '../repositories/social.repository';
import { getDeclineOrCancelInvalidationKeys } from '../queries/socialKeys';

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ requestId, requesterUsername }: { requestId: string; requesterUsername: string }) =>
      declineFriendRequest(requestId),
    onSuccess: (_, { requesterUsername }) => {
      const viewerId = user?.id ?? '';
      getDeclineOrCancelInvalidationKeys(requesterUsername, viewerId, 'received').forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
