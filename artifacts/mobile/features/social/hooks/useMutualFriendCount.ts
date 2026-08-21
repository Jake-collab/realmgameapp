import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchMutualFriendCount } from '../repositories/social.repository';

export function useMutualFriendCount(targetUsername: string | undefined) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.mutualFriends(targetUsername ?? '', viewerId),
    queryFn:   () => fetchMutualFriendCount(targetUsername!),
    enabled:   Boolean(targetUsername && viewerId),
    staleTime: 2 * 60 * 1000,
    gcTime:    5 * 60 * 1000,
  });
}
