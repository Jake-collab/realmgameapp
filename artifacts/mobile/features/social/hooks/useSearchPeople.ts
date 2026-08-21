import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { searchPublicUsers } from '../repositories/social.repository';
import { SEARCH_MIN_CHARS, SEARCH_STALE_MS } from '../constants/social.constants';

export function useSearchPeople(query: string, cursor?: string) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const trimmed = query.trim();
  return useQuery({
    queryKey:  socialKeys.search(trimmed, cursor, viewerId),
    queryFn:   () => searchPublicUsers(trimmed, 20, cursor),
    enabled:   Boolean(viewerId) && trimmed.length >= SEARCH_MIN_CHARS,
    staleTime: SEARCH_STALE_MS,
    gcTime:    60 * 1000,
    retry:     0,
  });
}
