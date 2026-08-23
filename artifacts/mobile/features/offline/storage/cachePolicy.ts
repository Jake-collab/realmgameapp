import type { CachedRecord } from '../types/offline.types';

export const CACHE_FRESHNESS_MS = {
  active: 2 * 60 * 1000,
  instructions: 30 * 60 * 1000,
  progress: 10 * 60 * 1000,
  profile: 15 * 60 * 1000,
  notifications: 5 * 60 * 1000,
} as const;

export function cachePresentation<T>(record: CachedRecord<T> | null) {
  if (!record) return { value: null, isStale: true, label: 'Unavailable offline' };
  const stale = Date.now() >= new Date(record.staleAt).getTime();
  return { value: record.value, isStale: stale, label: stale ? `Last updated ${new Date(record.fetchedAt).toLocaleString()}` : null };
}