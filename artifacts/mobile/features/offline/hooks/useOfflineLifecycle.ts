import { useEffect } from 'react';
import { AppState } from 'react-native';
import { connectivityService } from '../connectivity/connectivity.service';
import { useSyncStatus } from './useOffline';

export function useOfflineLifecycle() {
  const { syncNow } = useSyncStatus();
  useEffect(() => {
    const stopConnectivity = connectivityService.start();
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void syncNow(); });
    return () => { stopConnectivity(); subscription.remove(); };
  }, [syncNow]);
  useEffect(() => { void syncNow(); }, [syncNow]);
}