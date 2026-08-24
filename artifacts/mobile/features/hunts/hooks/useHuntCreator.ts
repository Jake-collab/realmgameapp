import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  archiveHunt,
  beginHuntRevision,
  createHuntDraft,
  deleteHunt,
  fetchCreatorHuntDraft,
  fetchCreatedHunts,
  inviteFriendToHunt,
  publishHunt,
  uploadHuntCover,
  updateHuntDraft,
} from '../repositories/huntCreator.repository';
import type { HuntCreatorDraft } from '../types/huntCreator.types';

export const creatorKeys = {
  all: ['hunt-creator'] as const,
  list: (userId: string) => ['hunt-creator', 'list', userId] as const,
};

export function useCreatedHunts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: creatorKeys.list(user?.id ?? ''),
    queryFn: fetchCreatedHunts,
    enabled: Boolean(user?.id) && isSupabaseConfigured(),
    staleTime: 30_000,
  });
}

export function useCreatorHuntDraft(huntId: string | undefined) {
  return useQuery({
    queryKey: ['hunt-creator', 'draft', huntId ?? ''],
    queryFn: () => fetchCreatorHuntDraft(huntId!),
    enabled: Boolean(huntId) && isSupabaseConfigured(),
  });
}

export function useHuntCreator() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    if (user?.id) queryClient.invalidateQueries({ queryKey: creatorKeys.list(user.id) });
    queryClient.invalidateQueries({ queryKey: ['hunts'] });
  };

  const saveDraft = useMutation({
    mutationFn: ({ huntId, draft }: { huntId?: string; draft: HuntCreatorDraft }) =>
      huntId ? updateHuntDraft(huntId, draft) : createHuntDraft(draft),
    onSuccess: invalidate,
  });
  const publish = useMutation({ mutationFn: publishHunt, onSuccess: invalidate });
  const archive = useMutation({ mutationFn: archiveHunt, onSuccess: invalidate });
  const beginRevision = useMutation({ mutationFn: beginHuntRevision, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteHunt, onSuccess: invalidate });
  const uploadCover = useMutation({
    mutationFn: ({ huntId, uri }: { huntId: string; uri: string }) => uploadHuntCover(huntId, uri),
  });

  return { saveDraft, publish, archive, beginRevision, remove, uploadCover };
}

export function useHuntCreatorFriendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ huntId, occurrenceId, username }: { huntId: string; occurrenceId: string; username: string }) =>
      inviteFriendToHunt(huntId, occurrenceId, username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hunts'] }),
  });
}