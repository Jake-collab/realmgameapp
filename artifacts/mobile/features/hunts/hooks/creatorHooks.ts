import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { creatorHuntKeys } from '../queries/creatorHuntKeys';
import {
  archiveCreatorDraft, createHuntDraft, duplicateCreatorDraft,
  fetchCreatorDraft, fetchCreatorHunts, submitCreatorDraft,
  updateCreatorDraft, validateCreatorDraftRemote,
} from '../repositories/creator.repository';
import { CREATOR_DEFAULT_PAYLOAD, normalizeCreatorPayload, type HuntCreatorDraft, type HuntCreatorPayload } from '../types/creator.types';

export function useCreatorHunts(userId: string | null) {
  return useQuery({
    queryKey: creatorHuntKeys.list(userId ?? ''),
    queryFn: fetchCreatorHunts,
    enabled: Boolean(userId) && isSupabaseConfigured(),
    staleTime: 15_000,
  });
}

export function useCreatorDraft(draftId: string, userId: string | null) {
  return useQuery({
    queryKey: creatorHuntKeys.draft(draftId, userId ?? ''),
    queryFn: () => fetchCreatorDraft(draftId),
    enabled: Boolean(draftId && userId) && isSupabaseConfigured(),
    staleTime: 10_000,
  });
}

export function useCreateHuntDraft(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createHuntDraft(`${userId ?? 'anonymous'}-${Date.now()}`),
    onSuccess: () => { if (userId) void queryClient.invalidateQueries({ queryKey: creatorHuntKeys.list(userId) }); },
  });
}

export function useUpdateHuntDraft(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, payload, revision }: { draftId: string; payload: HuntCreatorPayload; revision: number }) =>
      updateCreatorDraft(draftId, payload, revision),
    onSuccess: (draft) => {
      if (userId) {
        queryClient.setQueryData(creatorHuntKeys.draft(draft.id, userId), draft);
        void queryClient.invalidateQueries({ queryKey: creatorHuntKeys.list(userId) });
      }
    },
  });
}

export function useAutosaveHuntDraft(
  userId: string | null, draft: HuntCreatorDraft | null | undefined, payload: HuntCreatorPayload,
) {
  const mutation = useUpdateHuntDraft(userId);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'unsynced' | 'error'>('idle');
  const payloadJson = useMemo(() => JSON.stringify(payload), [payload]);
  useEffect(() => {
    if (!draft || !isSupabaseConfigured() || draft.status === 'pending_review') return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      mutation.mutate({ draftId: draft.id, payload: JSON.parse(payloadJson) as HuntCreatorPayload, revision: draft.revision }, {
        onSuccess: () => setSaveState('saved'),
        onError: () => setSaveState('unsynced'),
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft?.id, draft?.revision, payloadJson]);
  return { ...mutation, saveState };
}

export function useValidateHuntDraft() {
  return useMutation({ mutationFn: validateCreatorDraftRemote });
}
export function useSubmitHuntForReview(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitCreatorDraft,
    onSuccess: (_result, draftId) => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: creatorHuntKeys.draft(draftId, userId) });
        void queryClient.invalidateQueries({ queryKey: creatorHuntKeys.list(userId) });
      }
    },
  });
}
export function useArchiveHunt(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveCreatorDraft,
    onSuccess: () => { if (userId) void queryClient.invalidateQueries({ queryKey: creatorHuntKeys.list(userId) }); },
  });
}
export function useDuplicateHunt(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => duplicateCreatorDraft(sourceId, `${userId ?? 'anonymous'}-copy-${Date.now()}`),
    onSuccess: () => { if (userId) void queryClient.invalidateQueries({ queryKey: creatorHuntKeys.list(userId) }); },
  });
}

export function useDraftEditor(draft: HuntCreatorDraft | null | undefined) {
  const [payload, setPayload] = useState<HuntCreatorPayload>(CREATOR_DEFAULT_PAYLOAD);
  useEffect(() => {
    if (draft) setPayload(normalizeCreatorPayload(draft.payload));
  }, [draft?.id]);
  return [payload, setPayload] as const;
}