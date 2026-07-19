/**
 * useHuntInvitations — Worlds
 *
 * Fetches the user's pending Hunt invitations.
 * Visible only to the invitee.
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '../queries/huntKeys';
import { fetchMyPendingInvitations } from '../repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { HuntInvitation } from '../types/hunt.types';

interface UseHuntInvitationsOptions {
  userId: string | null;
  enabled?: boolean;
}

export function useHuntInvitations({ userId, enabled = true }: UseHuntInvitationsOptions) {
  return useQuery<HuntInvitation[]>({
    queryKey: huntKeys.invitations(userId ?? ''),
    queryFn: fetchMyPendingInvitations,
    enabled: enabled && !!userId && isSupabaseConfigured(),
    staleTime: 30_000,
    gcTime:    5 * 60_000,
    retry: 1,
    initialData: [],
  });
}
