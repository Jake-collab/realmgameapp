import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CachedRecord, LocalAsset, OfflineQueueItem } from '../types/offline.types';
import { OFFLINE_SCHEMA_VERSION } from '../types/offline.types';

const key = (userId: string, area: string) => `worlds-offline:v${OFFLINE_SCHEMA_VERSION}:${area}:${userId}`;
const queueKey = (userId: string) => key(userId, 'queue');
const cacheKey = (userId: string) => key(userId, 'cache');
const assetsKey = (userId: string) => key(userId, 'assets');

async function read<T>(storageKey: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(storageKey: string, value: T) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(value));
}

export const offlineStorage = {
  loadQueue: (userId: string) => read<OfflineQueueItem[]>(queueKey(userId), []),
  saveQueue: (userId: string, items: OfflineQueueItem[]) => write(queueKey(userId), items),
  loadCache: (userId: string) => read<Record<string, CachedRecord>>(cacheKey(userId), {}),
  saveCache: (userId: string, cache: Record<string, CachedRecord>) => write(cacheKey(userId), cache),
  loadAssets: (userId: string) => read<LocalAsset[]>(assetsKey(userId), []),
  saveAssets: (userId: string, assets: LocalAsset[]) => write(assetsKey(userId), assets),
  clearUser: async (userId: string) => { await AsyncStorage.multiRemove([queueKey(userId), cacheKey(userId), assetsKey(userId)]); },
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
  return record?.userId === userId ? record : null;
}

export function isCachedRecordStale(record: CachedRecord): boolean {
  return Date.now() >= new Date(record.staleAt).getTime();
}