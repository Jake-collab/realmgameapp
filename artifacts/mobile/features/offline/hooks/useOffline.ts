import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { connectivityService } from '../connectivity/connectivity.service';
import { getPendingQueue, enqueueOfflineMutation } from '../queue/mutationQueue';
import { executeRegisteredMutation } from '../sync/mutationRegistry';
import { syncOfflineQueue } from '../sync/syncEngine';
import type { ConnectivityState, OfflineQueueItem } from '../types/offline.types';

export function useConnectivity() {
  const [state, setState] = useState<ConnectivityState>(connectivityService.getState());
  useEffect(() => {
    const unsubscribe = connectivityService.subscribe(setState);
    return () => { unsubscribe(); };
  }, []);
  return { state, isOnline: state === 'online', isOffline: state === 'offline', isRecovering: state === 'recovering' };
}

export function useOfflineQueue() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [isLoading, setLoading] = useState(Boolean(userId));
  const refresh = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setItems(await getPendingQueue(userId));
    setLoading(false);
  }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { items, isLoading, refresh, pendingCount: items.filter(item => ['pending', 'waiting_dependency', 'syncing', 'failed_retryable'].includes(item.status)).length, attentionCount: items.filter(item => item.status === 'needs_attention').length };
}

export function useSyncStatus() {
  const { user } = useAuth();
  const connectivity = useConnectivity();
  const queue = useOfflineQueue();
  const [isSyncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const syncLock = useRef(false);
  const syncNow = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured() || !['online', 'recovering'].includes(connectivity.state) || syncLock.current) return [];
    const activeSession = await authService.getSession();
    if (!activeSession.session?.user || activeSession.session.user.id !== user.id) return [];
    syncLock.current = true;
    setSyncing(true);
    try {
      const result = await syncOfflineQueue(user.id, async item => {
        // The identity can change while a long upload or reconnect cycle is
        // underway. Check again before every protected server operation.
        const current = await authService.getSession();
        if (!current.session?.user || current.session.user.id !== user.id) {
          return { status: 'needs_attention', errorCode: 'AUTH_EXPIRED', message: 'Sign in again to continue syncing.' };
        }
        return executeRegisteredMutation(item);
      });
      setLastSyncAt(new Date().toISOString());
      await queue.refresh();
      return result;
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [connectivity.state, queue.refresh, user?.id]);
  return { ...connectivity, ...queue, isSyncing, lastSyncAt, syncNow };
}

export function useEnqueueOfflineMutation() {
  const { user } = useAuth();
  return useCallback(async (input: Omit<Parameters<typeof enqueueOfflineMutation>[0], 'userId'>) => {
    if (!user?.id) throw new Error('Sign in to save this change on the device.');
    return enqueueOfflineMutation({ ...input, userId: user.id });
  }, [user?.id]);
}