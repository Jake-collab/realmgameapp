import { offlineStorage } from '../storage/offlineStorage';
import type { ConflictStrategy, OfflineMutationType, OfflineQueueItem, QueueStatus } from '../types/offline.types';

const SAFE_MUTATIONS = new Set<OfflineMutationType>(['notification_read', 'notification_archive', 'creator_draft_save', 'profile_preference_save', 'proof_submission_intent', 'proof_media_upload']);
const MAX_ATTEMPTS = 5;
const queueLocks = new Map<string, Promise<unknown>>();

async function withQueueLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = queueLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  queueLocks.set(userId, current);
  await previous;
  try { return await operation(); } finally { release(); if (queueLocks.get(userId) === current) queueLocks.delete(userId); }
}

export function canQueueOffline(type: string): type is OfflineMutationType {
  return SAFE_MUTATIONS.has(type as OfflineMutationType);
}

export function makeIdempotencyKey(type: OfflineMutationType, entityId: string, localVersion?: string | number) {
  return `${type}:${entityId}${localVersion == null ? '' : `:${localVersion}`}`;
}

export async function enqueueOfflineMutation<TPayload extends Record<string, unknown>>(input: {
  userId: string; mutationType: OfflineMutationType; entityType: string; entityId: string; payload: TPayload;
  dependencyIds?: string[]; localAssetRefs?: string[]; conflictStrategy?: ConflictStrategy; localVersion?: string | number;
}) {
  return withQueueLock(input.userId, async () => {
    const items = await offlineStorage.loadQueue(input.userId);
    const idempotencyKey = makeIdempotencyKey(input.mutationType, input.entityId, input.localVersion);
    const existing = items.find(item => item.idempotencyKey === idempotencyKey && !['completed', 'cancelled'].includes(item.status));
    if (existing) return existing;
    const item: OfflineQueueItem<TPayload> = {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, userId: input.userId, mutationType: input.mutationType,
      entityType: input.entityType, entityId: input.entityId, payload: input.payload, idempotencyKey,
      createdAt: new Date().toISOString(), lastAttemptedAt: null, nextAttemptAt: null, attemptCount: 0, status: 'pending',
      dependencyIds: input.dependencyIds ?? [], localAssetRefs: input.localAssetRefs ?? [], conflictStrategy: input.conflictStrategy ?? 'server_wins', errorCode: null, errorMessage: null,
    };
    await offlineStorage.saveQueue(input.userId, [...items, item]);
    return item;
  });
}

export async function updateQueueItem(userId: string, id: string, patch: Partial<OfflineQueueItem>) {
  const items = await offlineStorage.loadQueue(userId);
  const next = items.map(item => item.id === id ? { ...item, ...patch } : item);
  await offlineStorage.saveQueue(userId, next);
  return next.find(item => item.id === id) ?? null;
}

export async function cancelQueueItem(userId: string, id: string) {
  return updateQueueItem(userId, id, { status: 'cancelled' });
}

export async function getPendingQueue(userId: string) {
  return (await offlineStorage.loadQueue(userId)).filter(item => !['completed', 'cancelled'].includes(item.status));
}

export function classifySyncFailure(error: unknown): { code: string; retryable: boolean; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.toLowerCase();
  if (normalized.includes('auth') || normalized.includes('session') || normalized.includes('401')) return { code: 'AUTH_EXPIRED', retryable: false, message: 'Sign in again to continue syncing.' };
  if (normalized.includes('conflict') || normalized.includes('version')) return { code: 'VERSION_CONFLICT', retryable: false, message: 'This item changed elsewhere and needs your attention.' };
  if (normalized.includes('expired')) return { code: 'ENTITY_EXPIRED', retryable: false, message: 'This activity is no longer available.' };
  if (normalized.includes('missing') || normalized.includes('file')) return { code: 'FILE_MISSING', retryable: false, message: 'The saved file is no longer available on this device.' };
  return { code: 'TEMPORARY_UNAVAILABLE', retryable: true, message: 'We will retry when the connection improves.' };
}

export function nextRetryAt(attemptCount: number, now = Date.now()) {
  const delay = Math.min(30 * 60 * 1000, 1000 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(now + delay).toISOString();
}

export const MAX_QUEUE_ATTEMPTS = MAX_ATTEMPTS;