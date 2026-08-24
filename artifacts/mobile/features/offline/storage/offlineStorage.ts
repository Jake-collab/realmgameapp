import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CachedRecord, LocalAsset, OfflineQueueItem } from '../types/offline.types';
import { OFFLINE_SCHEMA_VERSION } from '../types/offline.types';

const key = (userId: string, area: string) => `worlds-offline:v${OFFLINE_SCHEMA_VERSION}:${area}:${userId}`;
const queueKey = (userId: string) => key(userId, 'queue');
const cacheKey = (userId: string) => key(userId, 'cache');
const assetsKey = (userId: string) => key(userId, 'assets');
const queryCacheKey = (userId: string) => key(userId, 'query-cache');

async function read<T>(storageKey: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function belongsToUser<T extends { userId?: string }>(value: T, userId: string) {
  return !value.userId || value.userId === userId;
}

async function write<T>(storageKey: string, value: T) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(value));
}

export const offlineStorage = {
  loadQueue: async (userId: string) => (await read<OfflineQueueItem[]>(queueKey(userId), [])).filter(item => belongsToUser(item, userId)),
  saveQueue: (userId: string, items: OfflineQueueItem[]) => write(queueKey(userId), items),
  loadCache: (userId: string) => read<Record<string, CachedRecord>>(cacheKey(userId), {}),
  saveCache: (userId: string, cache: Record<string, CachedRecord>) => write(cacheKey(userId), cache),
  loadAssets: async (userId: string) => (await read<LocalAsset[]>(assetsKey(userId), [])).filter(item => belongsToUser(item, userId)),
  saveAssets: (userId: string, assets: LocalAsset[]) => write(assetsKey(userId), assets),
  loadQueryCache: (userId: string) => read<unknown>(queryCacheKey(userId), null),
  saveQueryCache: (userId: string, cache: unknown) => write(queryCacheKey(userId), cache),
  clearUser: async (userId: string) => { await AsyncStorage.multiRemove([queueKey(userId), cacheKey(userId), assetsKey(userId), queryCacheKey(userId)]); },
  clearAllOffline: async () => {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(item => item.startsWith('worlds-offline:')));
  },
};

export async function saveCachedRecord<T>(userId: string, cacheId: string, value: T, options: { staleAfterMs: number; entityVersion?: string | number | null }) {
  const cache = await offlineStorage.loadCache(userId);
  const fetchedAt = new Date().toISOString();
  cache[cacheId] = { value, fetchedAt, entityVersion: options.entityVersion ?? null, staleAt: new Date(Date.now() + options.staleAfterMs).toISOString(), userId, schemaVersion: OFFLINE_SCHEMA_VERSION };
  await offlineStorage.saveCache(userId, cache);
  return cache[cacheId];
}

export async function loadCachedRecord<T>(userId: string, cacheId: string): Promise<CachedRecord<T> | null> {
  const cache = await offlineStorage.loadCache(userId);
  const record = cache[cacheId] as CachedRecord<T> | undefined;
  return record?.userId === userId && record.schemaVersion === OFFLINE_SCHEMA_VERSION ? record : null;
}

export function isCachedRecordStale(record: CachedRecord): boolean {
  return Date.now() >= new Date(record.staleAt).getTime();
}