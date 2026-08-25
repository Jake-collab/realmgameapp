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
import { enqueueOfflineMutation } from '@/features/offline/queue/mutationQueue';

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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'saved_local' | 'unsynced' | 'error'>('idle');
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const payloadJson = useMemo(() => JSON.stringify(payload), [payload]);
  useEffect(() => {
    if (!draft || !userId || draft.status === 'pending_review') return;
    // Never send two writes against the same expected revision. The next
    // query revision causes this effect to persist the newest editor payload.
    if (mutation.isPending) return;
    setSaveState('saving');
    setConflictMessage(null);
    const timer = setTimeout(() => {
      if (!isSupabaseConfigured()) {
        void enqueueOfflineMutation({
          userId, mutationType: 'creator_draft_save', entityType: 'hunt_draft', entityId: draft.id,
          payload: { draftId: draft.id, payload: JSON.parse(payloadJson), revision: draft.revision },
          conflictStrategy: 'draft_merge', localVersion: draft.revision,
        }).then(() => setSaveState('saved_local')).catch(() => setSaveState('error'));
      } else {
        mutation.mutate({ draftId: draft.id, payload: JSON.parse(payloadJson) as HuntCreatorPayload, revision: draft.revision }, {
          onSuccess: () => setSaveState('saved'),
          onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            // Do not queue an optimistic overwrite after the server says a
            // newer revision exists. Surface it and keep the local editor
            // intact so the creator can reload/reconcile deliberately.
            if (/(revision|version|conflict)/i.test(message)) {
              setConflictMessage('This draft changed elsewhere. Reload it before submitting so no stop or proof setting is lost.');
              setSaveState('error');
              return;
            }
            void enqueueOfflineMutation({
              userId, mutationType: 'creator_draft_save', entityType: 'hunt_draft', entityId: draft.id,
              payload: { draftId: draft.id, payload: JSON.parse(payloadJson), revision: draft.revision },
              conflictStrategy: 'draft_merge', localVersion: draft.revision,
            }).then(() => setSaveState('saved_local')).catch(() => setSaveState('unsynced'));
          },
        });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [draft?.id, draft?.revision, payloadJson, mutation.isPending, userId]);
  return {
    ...mutation,
    saveState,
    conflictMessage,
    hasUnsavedChanges: mutation.isPending || saveState === 'saving' || saveState === 'saved_local' || saveState === 'unsynced' || saveState === 'error',
  };
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