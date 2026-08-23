import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { connectivityService } from '../connectivity/connectivity.service';
import { useSyncStatus } from './useOffline';
import { registerOfflineMutationExecutor } from '../sync/mutationRegistry';
import { markAsRead, updateNotificationPreferences } from '@/features/notifications/notification.service';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function useOfflineLifecycle() {
  const { syncNow, state } = useSyncStatus();
  const { user } = useAuth();
  const syncRef = useRef(syncNow);
  syncRef.current = syncNow;
  useEffect(() => {
    const stopConnectivity = connectivityService.start();
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void syncRef.current(); });
    return () => { stopConnectivity(); subscription.remove(); };
  }, []);
  useEffect(() => { void syncRef.current(); }, [state]);
  useEffect(() => {
    if (!user?.id) return undefined;
    const removeRead = registerOfflineMutationExecutor('notification_read', async item => {
      if (!item.payload.notificationId) return { status: 'needs_attention', errorCode: 'INVALID_PAYLOAD', message: 'This notification change needs attention.' };
      await markAsRead(user.id, String(item.payload.notificationId));
      return { status: 'completed' };
    });
    const removePreferences = registerOfflineMutationExecutor('profile_preference_save', async item => {
      await updateNotificationPreferences(user.id, item.payload as Parameters<typeof updateNotificationPreferences>[1]);
      return { status: 'completed' };
    });
    return () => { removeRead(); removePreferences(); };
  }, [user?.id]);
}