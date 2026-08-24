export type ConnectivityState = 'online' | 'offline' | 'limited' | 'unknown' | 'recovering';
export type QueueStatus = 'pending' | 'waiting_dependency' | 'syncing' | 'failed_retryable' | 'needs_attention' | 'completed' | 'cancelled';
export type ConflictStrategy = 'server_wins' | 'draft_merge' | 'explicit_review';

export type OfflineMutationType =
  | 'notification_read'
  | 'notification_read_all'
  | 'notification_archive'
  | 'creator_draft_save'
  | 'profile_preference_save'
  | 'proof_submission_intent'
  | 'proof_media_upload';

export interface OfflineQueueItem<TPayload = Record<string, unknown>> {
  id: string;
  userId: string;
  mutationType: OfflineMutationType;
  entityType: string;
  entityId: string;
  payload: TPayload;
  idempotencyKey: string;
  createdAt: string;
  lastAttemptedAt: string | null;
  nextAttemptAt: string | null;
  attemptCount: number;
  status: QueueStatus;
  dependencyIds: string[];
  localAssetRefs: string[];
  conflictStrategy: ConflictStrategy;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface CachedRecord<T = unknown> {
  value: T;
  fetchedAt: string;
  entityVersion: string | number | null;
  staleAt: string;
  userId: string;
  schemaVersion: number;
}

export interface LocalAsset {
  id: string;
  userId: string;
  uri: string;
  mimeType: string;
  size: number | null;
  sha256: string | null;
  domain: 'quest_proof' | 'hunt_proof' | 'creator_draft';
  entityId: string;
  status: 'local' | 'waiting' | 'uploading' | 'uploaded' | 'failed' | 'cancelled';
  retryCount: number;
  remoteAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineDiagnostics {
  queueCount: number;
  pendingCount: number;
  attentionCount: number;
  assetCount: number;
  lastSyncAt: string | null;
  connectivity: ConnectivityState;
  lastErrorCode: string | null;
}

export const OFFLINE_SCHEMA_VERSION = 1;