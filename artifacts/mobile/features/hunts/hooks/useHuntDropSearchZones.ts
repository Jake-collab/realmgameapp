import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntDropSearchZones } from '../repositories/huntDrop.repository';
import { huntKeys } from '../queries/huntKeys';

export function useHuntDropSearchZones(input: { participationId: string | null; userId: string | null }) {
  return useQuery({
    queryKey: huntKeys.dropSearchZones(input.participationId ?? 'none', input.userId ?? 'none'),
    queryFn: () => fetchHuntDropSearchZones(input.participationId!),
    enabled: Boolean(input.participationId && input.userId && isSupabaseConfigured()),
    staleTime: 15_000,
    retry: 1,
  });
}