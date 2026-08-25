import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCreatorDraft, useAutosaveHuntDraft, useDraftEditor } from '../hooks/creatorHooks';
export function useCreatorDraftEditor(draftId: string) {
  const { user } = useAuth();
  const query = useCreatorDraft(draftId, user?.id ?? null);
  const [payload, setPayload] = useDraftEditor(query.data);
  const autosave = useAutosaveHuntDraft(user?.id ?? null, query.data, payload);
  return {
    user, query, draft: query.data, payload, setPayload, saveState: autosave.saveState,
    saveConflict: autosave.conflictMessage, hasUnsavedChanges: autosave.hasUnsavedChanges,
  };
}