import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchReceivedFriendRequests } from '../repositories/social.repository';
import { REQUESTS_STALE_MS } from '../constants/social.constants';

export function useReceivedFriendRequests() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.requestsReceived(userId),
    queryFn:   fetchReceivedFriendRequests,
    enabled:   Boolean(userId),
    staleTime: REQUESTS_STALE_MS,
    gcTime:    2 * 60 * 1000,
  });
}
