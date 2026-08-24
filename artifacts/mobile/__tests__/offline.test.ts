import AsyncStorage from '@react-native-async-storage/async-storage';
import { canQueueOffline, enqueueOfflineMutation, makeIdempotencyKey, classifySyncFailure, nextRetryAt, retryQueueItem } from '@/features/offline/queue/mutationQueue';
import { offlineStorage } from '@/features/offline/storage/offlineStorage';
import { syncOfflineQueue } from '@/features/offline/sync/syncEngine';
import { setOfflineFailureSimulation } from '@/features/offline/sync/failureSimulation';

describe('offline queue boundaries', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('only allows approved safe intents and uses deterministic keys', () => {
    expect(canQueueOffline('notification_read')).toBe(true);
    expect(canQueueOffline('complete_quest')).toBe(false);
    expect(makeIdempotencyKey('creator_draft_save', 'draft-1', 4)).toBe('creator_draft_save:draft-1:4');
  });

  it('deduplicates a queued mutation after storage restoration', async () => {
    const input = { userId: 'user-1', mutationType: 'notification_read' as const, entityType: 'notification', entityId: 'n-1', payload: { read: true } };
    const first = await enqueueOfflineMutation(input);
    const second = await enqueueOfflineMutation(input);
    expect(second.id).toBe(first.id);
    expect(await offlineStorage.loadQueue('user-1')).toHaveLength(1);
  });

  it('processes dependencies in order and preserves wrong-user isolation', async () => {
    const parent = await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'proof_media_upload', entityType: 'proof', entityId: 'asset-1', payload: { localAssetId: 'asset-1' } });
    await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'proof_submission_intent', entityType: 'proof', entityId: 'proof-1', payload: { mediaId: 'asset-1' }, dependencyIds: [parent.id] });
    await enqueueOfflineMutation({ userId: 'user-2', mutationType: 'notification_read', entityType: 'notification', entityId: 'n-2', payload: { read: true } });
    const seen: string[] = [];
    const result = await syncOfflineQueue('user-1', async item => { seen.push(item.mutationType); return { status: 'completed' }; });
    expect(seen).toEqual(['proof_media_upload', 'proof_submission_intent']);
    expect(result).toHaveLength(2);
    expect(await offlineStorage.loadQueue('user-2')).toHaveLength(1);
  });

  it('recognizes a completed dependency after an app restart', async () => {
    const parent = await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'creator_draft_save', entityType: 'hunt_draft', entityId: 'draft-1', payload: { revision: 1 } });
    await syncOfflineQueue('user-1', async () => ({ status: 'completed' }));
    await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'proof_submission_intent', entityType: 'proof', entityId: 'proof-1', payload: { operation: 'submit' }, dependencyIds: [parent.id] });
    const seen: string[] = [];
    await syncOfflineQueue('user-1', async item => { seen.push(item.entityId); return { status: 'completed' }; });
    expect(seen).toEqual(['proof-1']);
  });

  it('does not retry before the persisted retry window', async () => {
    await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'notification_read', entityType: 'notification', entityId: 'n-1', payload: { notificationId: 'n-1' } });
    await syncOfflineQueue('user-1', async () => ({ status: 'retryable', errorCode: 'TEMPORARY_UNAVAILABLE' }), { now: 0 });
    const skipped = await syncOfflineQueue('user-1', async () => ({ status: 'completed' }), { now: 999 });
    expect(skipped).toHaveLength(0);
    const retried = await syncOfflineQueue('user-1', async () => ({ status: 'completed' }), { now: 3000 });
    expect(retried).toHaveLength(1);
  });

  it('classifies permanent errors and caps exponential retry', () => {
    expect(classifySyncFailure(new Error('version conflict')).retryable).toBe(false);
    expect(classifySyncFailure(new Error('timeout')).retryable).toBe(true);
    expect(new Date(nextRetryAt(20, 0)).getTime()).toBe(30 * 60 * 1000);
  });

  it('supports development-only failure simulation without changing queue rules', async () => {
    await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'notification_read', entityType: 'notification', entityId: 'n-sim', payload: { notificationId: 'n-sim' } });
    setOfflineFailureSimulation({ failNext: 1 });
    const failed = await syncOfflineQueue('user-1', async () => ({ status: 'completed' }), { now: 0 });
    expect(failed[0]?.result.status).toBe('retryable');
    const recovered = await syncOfflineQueue('user-1', async () => ({ status: 'completed' }), { now: 2000 });
    expect(recovered[0]?.result.status).toBe('completed');
  });

  it('makes attention items recoverable without changing their idempotency key', async () => {
    const item = await enqueueOfflineMutation({ userId: 'user-1', mutationType: 'notification_read', entityType: 'notification', entityId: 'n-attention', payload: { notificationId: 'n-attention' } });
    await syncOfflineQueue('user-1', async () => ({ status: 'needs_attention', errorCode: 'VERSION_CONFLICT', message: 'Changed elsewhere' }));
    const retried = await retryQueueItem('user-1', item.id);
    expect(retried).toMatchObject({ status: 'pending', errorCode: null, idempotencyKey: item.idempotencyKey });
  });

  it('does not leak malformed cached records across user boundaries', async () => {
    await offlineStorage.saveQueue('user-1', [{
      id: 'foreign', userId: 'user-2', mutationType: 'notification_read', entityType: 'notification', entityId: 'n-foreign',
      payload: {}, idempotencyKey: 'foreign', createdAt: '', lastAttemptedAt: null, nextAttemptAt: null, attemptCount: 0,
      status: 'pending', dependencyIds: [], localAssetRefs: [], conflictStrategy: 'server_wins', errorCode: null, errorMessage: null,
    }]);
    expect(await offlineStorage.loadQueue('user-1')).toEqual([]);
  });
});