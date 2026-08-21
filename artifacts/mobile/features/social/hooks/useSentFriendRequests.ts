import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchSentFriendRequests } from '../repositories/social.repository';
import { REQUESTS_STALE_MS } from '../constants/social.constants';

export function useSentFriendRequests() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.requestsSent(userId),
    queryFn:   fetchSentFriendRequests,
    enabled:   Boolean(userId),
    staleTime: REQUESTS_STALE_MS,
    gcTime:    2 * 60 * 1000,
  });
}
