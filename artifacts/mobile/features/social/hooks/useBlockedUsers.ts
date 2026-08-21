import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchBlockedUsers } from '../repositories/social.repository';
import { BLOCKED_STALE_MS } from '../constants/social.constants';

export function useBlockedUsers() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.blockedUsers(userId),
    queryFn:   fetchBlockedUsers,
    enabled:   Boolean(userId),
    staleTime: BLOCKED_STALE_MS,
    gcTime:    10 * 60 * 1000,
  });
}
