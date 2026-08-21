import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { sendFriendRequest } from '../repositories/social.repository';
import { getSendRequestInvalidationKeys } from '../queries/socialKeys';

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ targetUsername, sourceContext }: { targetUsername: string; sourceContext?: string }) =>
      sendFriendRequest(targetUsername, sourceContext),
    onSuccess: (_, { targetUsername }) => {
      const viewerId = user?.id ?? '';
      getSendRequestInvalidationKeys(targetUsername, viewerId).forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
