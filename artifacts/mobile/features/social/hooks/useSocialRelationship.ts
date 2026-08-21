import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchSocialRelationship } from '../repositories/social.repository';
import { PUBLIC_PROFILE_STALE_MS } from '../constants/social.constants';

export function useSocialRelationship(targetUsername: string | undefined) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.relationship(targetUsername ?? '', viewerId),
    queryFn:   () => fetchSocialRelationship(targetUsername!),
    enabled:   Boolean(targetUsername && viewerId),
    staleTime: PUBLIC_PROFILE_STALE_MS,
    gcTime:    2 * 60 * 1000,
  });
}
