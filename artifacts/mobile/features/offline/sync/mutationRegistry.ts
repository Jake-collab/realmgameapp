import type { OfflineQueueItem } from '../types/offline.types';
import type { MutationExecutor, SyncResult } from './syncEngine';

const executors = new Map<OfflineQueueItem['mutationType'], MutationExecutor>();

export function registerOfflineMutationExecutor(type: OfflineQueueItem['mutationType'], executor: MutationExecutor) {
  executors.set(type, executor);
  return () => executors.delete(type);
}

export const executeRegisteredMutation: MutationExecutor = async item => {
  const executor = executors.get(item.mutationType);
  if (!executor) {
    const result: SyncResult = { status: 'retryable', errorCode: 'SYNC_ADAPTER_UNAVAILABLE', message: 'This change will sync when the service is available.' };
    return result;
  }
  return executor(item);
};