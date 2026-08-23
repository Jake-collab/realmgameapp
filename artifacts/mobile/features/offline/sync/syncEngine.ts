import { getPendingQueue, updateQueueItem, classifySyncFailure, MAX_QUEUE_ATTEMPTS } from '../queue/mutationQueue';
import type { OfflineQueueItem, QueueStatus } from '../types/offline.types';

export type SyncResult = { status: 'completed' | 'retryable' | 'needs_attention'; errorCode?: string; message?: string };
export type MutationExecutor = (item: OfflineQueueItem) => Promise<SyncResult>;

function dependenciesReady(item: OfflineQueueItem, all: OfflineQueueItem[]) {
  return item.dependencyIds.every(id => all.find(dependency => dependency.id === id)?.status === 'completed');
}

export async function syncOfflineQueue(userId: string, executor: MutationExecutor, options: { maxItems?: number; now?: number } = {}) {
  const items = await getPendingQueue(userId);
  const results: Array<{ item: OfflineQueueItem; result: SyncResult }> = [];
  const limit = options.maxItems ?? 10;
  const working = [...items];
  for (const item of working.slice(0, limit)) {
    if (item.attemptCount >= MAX_QUEUE_ATTEMPTS) {
      await updateQueueItem(userId, item.id, { status: 'needs_attention', errorCode: 'RETRY_LIMIT_REACHED', errorMessage: 'This change needs your attention.' });
      continue;
    }
    if (!dependenciesReady(item, working)) {
      await updateQueueItem(userId, item.id, { status: 'waiting_dependency' as QueueStatus });
      continue;
    }
    await updateQueueItem(userId, item.id, { status: 'syncing', attemptCount: item.attemptCount + 1, lastAttemptedAt: new Date(options.now ?? Date.now()).toISOString() });
    try {
      const result = await executor(item);
      await updateQueueItem(userId, item.id, result.status === 'completed'
        ? { status: 'completed', errorCode: null, errorMessage: null }
        : { status: result.status === 'retryable' ? 'failed_retryable' : 'needs_attention', errorCode: result.errorCode ?? 'SYNC_FAILED', errorMessage: result.message ?? null });
      results.push({ item, result });
      const workingItem = working.find(candidate => candidate.id === item.id);
      if (workingItem) workingItem.status = result.status === 'completed' ? 'completed' : result.status === 'retryable' ? 'failed_retryable' : 'needs_attention';
    } catch (error) {
      const failure = classifySyncFailure(error);
      const status: QueueStatus = failure.retryable && item.attemptCount + 1 < MAX_QUEUE_ATTEMPTS ? 'failed_retryable' : 'needs_attention';
      const result: SyncResult = { status: status === 'failed_retryable' ? 'retryable' : 'needs_attention', errorCode: failure.code, message: failure.message };
      await updateQueueItem(userId, item.id, { status, errorCode: failure.code, errorMessage: failure.message });
      results.push({ item, result });
    }
  }
  return results;
}