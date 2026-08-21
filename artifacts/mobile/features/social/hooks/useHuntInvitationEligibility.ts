import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchHuntInvitationEligibility } from '../repositories/social.repository';

export function useHuntInvitationEligibility(
  targetUsername: string | undefined,
  huntId: string | undefined,
  occurrenceId: string | undefined,
) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.huntInviteEligibility(huntId ?? '', occurrenceId ?? '', targetUsername ?? ''),
    queryFn:   () => fetchHuntInvitationEligibility(targetUsername!, huntId!, occurrenceId!),
    enabled:   Boolean(targetUsername && huntId && occurrenceId && viewerId),
    staleTime: 60 * 1000,
    gcTime:    2 * 60 * 1000,
  });
}
