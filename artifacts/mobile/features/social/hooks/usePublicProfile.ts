import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchPublicProfile } from '../repositories/social.repository';
import { PUBLIC_PROFILE_STALE_MS } from '../constants/social.constants';

export function usePublicProfile(username: string | undefined) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.publicProfile(username ?? '', viewerId),
    queryFn:   () => fetchPublicProfile(username!),
    enabled:   Boolean(username && viewerId),
    staleTime: PUBLIC_PROFILE_STALE_MS,
    gcTime:    2 * 60 * 1000,
    retry:     1,
  });
}
