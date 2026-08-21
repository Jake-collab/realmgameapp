import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cancelFriendRequest } from '../repositories/social.repository';
import { getDeclineOrCancelInvalidationKeys } from '../queries/socialKeys';

export function useCancelFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ requestId, recipientUsername }: { requestId: string; recipientUsername: string }) =>
      cancelFriendRequest(requestId),
    onSuccess: (_, { recipientUsername }) => {
      const viewerId = user?.id ?? '';
      getDeclineOrCancelInvalidationKeys(recipientUsername, viewerId, 'sent').forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
