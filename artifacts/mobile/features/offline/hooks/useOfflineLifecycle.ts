import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { connectivityService } from '../connectivity/connectivity.service';
import { useSyncStatus } from './useOffline';
import { registerOfflineMutationExecutor } from '../sync/mutationRegistry';
import { markAsRead, updateNotificationPreferences } from '@/features/notifications/notification.service';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import { hydrateOfflineQueryCache, subscribeToOfflineQueryCache } from '../storage/queryPersistence';
import { updateCreatorDraft } from '@/features/hunts/repositories/creator.repository';
import { updateQuestProofDraft, submitQuestProof } from '@/features/quests/services/questProof.service';
import { rpcSubmitHuntProof } from '@/features/hunts/repositories/hunt.repository';
import { uploadProofMediaFromUri } from '@/services/media/media.service';
import { updateLocalAsset } from '@/features/offline/storage/localAssets';

export function useOfflineLifecycle() {
  const { syncNow, state } = useSyncStatus();
  const { user } = useAuth();
  const syncRef = useRef(syncNow);
  syncRef.current = syncNow;
  useEffect(() => {
    const stopConnectivity = connectivityService.start();
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void syncRef.current(); });
    return () => { stopConnectivity(); subscription.remove(); };
  }, []);
  useEffect(() => { void syncRef.current(); }, [state]);
  useEffect(() => {
    if (!user?.id) return undefined;
    void hydrateOfflineQueryCache(user.id, queryClient);
    const stopCachePersistence = subscribeToOfflineQueryCache(user.id, queryClient);
    const removeRead = registerOfflineMutationExecutor('notification_read', async item => {
      if (!item.payload.notificationId) return { status: 'needs_attention', errorCode: 'INVALID_PAYLOAD', message: 'This notification change needs attention.' };
      await markAsRead(user.id, String(item.payload.notificationId));
      return { status: 'completed' };
    });
    const removePreferences = registerOfflineMutationExecutor('profile_preference_save', async item => {
      await updateNotificationPreferences(user.id, item.payload as Parameters<typeof updateNotificationPreferences>[1]);
      return { status: 'completed' };
    });
    const removeCreatorDraft = registerOfflineMutationExecutor('creator_draft_save', async item => {
      const payload = item.payload as { draftId?: string; payload?: unknown; revision?: number };
      if (!payload.draftId || !payload.payload || payload.revision == null) return { status: 'needs_attention', errorCode: 'INVALID_PAYLOAD', message: 'This draft needs attention before syncing.' };
      await updateCreatorDraft(payload.draftId, payload.payload as Parameters<typeof updateCreatorDraft>[1], payload.revision);
      return { status: 'completed' };
    });
    const removeProof = registerOfflineMutationExecutor('proof_submission_intent', async item => {
      const payload = item.payload as {
        operation?: string; proofId?: string; userId?: string; participationId?: string; stopId?: string; submissionType?: string;
        textResponse?: string | null; mediaIds?: string[] | null; previousSubmissionId?: string | null;
        updates?: Parameters<typeof updateQuestProofDraft>[2];
      };
      if (payload.userId !== user.id || !payload.proofId || !payload.operation) return { status: 'needs_attention', errorCode: 'INVALID_PAYLOAD', message: 'This proof needs attention before syncing.' };
      if (payload.operation === 'update_draft' && payload.updates) {
        const result = await updateQuestProofDraft(payload.proofId, user.id, payload.updates);
        if (!result.success) throw new Error(result.error?.message ?? 'Proof draft could not sync');
        return { status: 'completed' };
      }
      if (payload.operation === 'submit' && payload.participationId) {
        const result = await submitQuestProof(payload.proofId, user.id, payload.participationId);
        if (!result.success) throw new Error(result.error?.message ?? 'Proof could not sync');
        return { status: 'completed' };
      }
      if (payload.operation === 'hunt_submit' && payload.participationId && payload.stopId && payload.submissionType) {
        const result = await rpcSubmitHuntProof(payload.participationId, payload.stopId, payload.submissionType, payload.textResponse, payload.mediaIds, null, null, null, payload.previousSubmissionId);
        if (!result.success) return { status: 'needs_attention', errorCode: result.reasonCode ?? 'PROOF_REJECTED', message: result.userMessage || 'The server could not accept this proof.' };
        return { status: 'completed' };
      }
      return { status: 'needs_attention', errorCode: 'INVALID_PAYLOAD', message: 'This proof needs attention before syncing.' };
    });
    const removeMedia = registerOfflineMutationExecutor('proof_media_upload', async item => {
      const payload = item.payload as { assetId?: string; localUri?: string; mimeType?: string; fileSize?: number; proofId?: string };
      if (!payload.assetId || !payload.localUri || !payload.mimeType) return { status: 'needs_attention', errorCode: 'INVALID_PAYLOAD', message: 'This image needs attention before syncing.' };
      await updateLocalAsset(user.id, payload.assetId, { status: 'uploading' });
      try {
        const asset = await uploadProofMediaFromUri({ userId: user.id, localUri: payload.localUri, mimeType: payload.mimeType, fileSize: payload.fileSize, proofId: payload.proofId });
        await updateLocalAsset(user.id, payload.assetId, { status: 'uploaded', remoteAssetId: asset.id });
        return { status: 'completed' };
      } catch (error) {
        await updateLocalAsset(user.id, payload.assetId, { status: 'failed', retryCount: 1 });
        throw error;
      }
    });
    return () => { removeRead(); removePreferences(); removeCreatorDraft(); removeProof(); removeMedia(); stopCachePersistence(); };
  }, [user?.id]);
}