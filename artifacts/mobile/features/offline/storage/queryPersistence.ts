import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { offlineStorage } from './offlineStorage';

function belongsToUser(queryKey: readonly unknown[], userId: string) {
  return queryKey.some(part => part === userId);
}

export async function hydrateOfflineQueryCache(userId: string, queryClient: QueryClient) {
  const state = await offlineStorage.loadQueryCache(userId);
  if (state && typeof state === 'object') hydrate(queryClient, state);
}

export function subscribeToOfflineQueryCache(userId: string, queryClient: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const dehydrated = dehydrate(queryClient, {
        shouldDehydrateQuery: query => belongsToUser(query.queryKey, userId),
      });
      void offlineStorage.saveQueryCache(userId, dehydrated).catch(() => undefined);
    }, 250);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe(persist);
  return () => { if (timer) clearTimeout(timer); unsubscribe(); };
}