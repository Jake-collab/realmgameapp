import { updateQueueItem, classifySyncFailure, MAX_QUEUE_ATTEMPTS, nextRetryAt } from '../queue/mutationQueue';
import { offlineStorage } from '../storage/offlineStorage';
import { consumeOfflineFailureSimulation } from './failureSimulation';
import type { OfflineQueueItem, QueueStatus } from '../types/offline.types';

export type SyncResult = { status: 'completed' | 'retryable' | 'needs_attention'; errorCode?: string; message?: string };
export type MutationExecutor = (item: OfflineQueueItem) => Promise<SyncResult>;

function dependencyState(item: OfflineQueueItem, all: OfflineQueueItem[]) {
  for (const id of item.dependencyIds) {
    const dependency = all.find(candidate => candidate.id === id);
    if (!dependency || dependency.status === 'cancelled' || dependency.status === 'needs_attention') return 'invalid';
    if (dependency.status !== 'completed') return 'waiting';
  }
  return 'ready';
}

export async function syncOfflineQueue(userId: string, executor: MutationExecutor, options: { maxItems?: number; now?: number } = {}) {
  const allItems = await offlineStorage.loadQueue(userId);
  const items = allItems.filter(item => !['completed', 'cancelled'].includes(item.status));
  const results: Array<{ item: OfflineQueueItem; result: SyncResult }> = [];
  const limit = options.maxItems ?? 10;
  const working = [...items];
  const dependencyView = [...allItems];
  for (const item of working.slice(0, limit)) {
    if (item.nextAttemptAt && new Date(item.nextAttemptAt).getTime() > (options.now ?? Date.now())) continue;
    if (item.attemptCount >= MAX_QUEUE_ATTEMPTS) {
      await updateQueueItem(userId, item.id, { status: 'needs_attention', errorCode: 'RETRY_LIMIT_REACHED', errorMessage: 'This change needs your attention.' });
      continue;
    }
    const dependencyStatus = dependencyState(item, dependencyView);
    if (dependencyStatus === 'invalid') {
      await updateQueueItem(userId, item.id, { status: 'needs_attention', errorCode: 'DEPENDENCY_UNAVAILABLE', errorMessage: 'A required saved change is no longer available.' });
      continue;
    }
    if (dependencyStatus === 'waiting') {
      await updateQueueItem(userId, item.id, { status: 'waiting_dependency' as QueueStatus });
      continue;
    }
    await updateQueueItem(userId, item.id, { status: 'syncing', attemptCount: item.attemptCount + 1, lastAttemptedAt: new Date(options.now ?? Date.now()).toISOString(), nextAttemptAt: null });
    try {
      await consumeOfflineFailureSimulation();
      const result = await executor(item);
      await updateQueueItem(userId, item.id, result.status === 'completed'
        ? { status: 'completed', errorCode: null, errorMessage: null }
        : { status: result.status === 'retryable' ? 'failed_retryable' : 'needs_attention', errorCode: result.errorCode ?? 'SYNC_FAILED', errorMessage: result.message ?? null, nextAttemptAt: result.status === 'retryable' ? nextRetryAt(item.attemptCount + 1, options.now ?? Date.now()) : null });
      results.push({ item, result });
      const workingItem = working.find(candidate => candidate.id === item.id);
      if (workingItem) workingItem.status = result.status === 'completed' ? 'completed' : result.status === 'retryable' ? 'failed_retryable' : 'needs_attention';
      const persistedItem = dependencyView.find(candidate => candidate.id === item.id);
      if (persistedItem) persistedItem.status = workingItem?.status ?? persistedItem.status;
    } catch (error) {
      const failure = classifySyncFailure(error);
      const status: QueueStatus = failure.retryable && item.attemptCount + 1 < MAX_QUEUE_ATTEMPTS ? 'failed_retryable' : 'needs_attention';
      const result: SyncResult = { status: status === 'failed_retryable' ? 'retryable' : 'needs_attention', errorCode: failure.code, message: failure.message };
      await updateQueueItem(userId, item.id, { status, errorCode: failure.code, errorMessage: failure.message, nextAttemptAt: status === 'failed_retryable' ? nextRetryAt(item.attemptCount + 1, options.now ?? Date.now()) : null });
      const persistedItem = dependencyView.find(candidate => candidate.id === item.id);
      if (persistedItem) persistedItem.status = status;
      results.push({ item, result });
    }
  }
  return results;
}