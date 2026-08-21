import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchFriends } from '../repositories/social.repository';
import { FRIENDS_STALE_MS } from '../constants/social.constants';

export function useFriends(search?: string) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.friends(userId, search),
    queryFn:   () => fetchFriends(50, undefined, search),
    enabled:   Boolean(userId),
    staleTime: FRIENDS_STALE_MS,
    gcTime:    5 * 60 * 1000,
  });
}
