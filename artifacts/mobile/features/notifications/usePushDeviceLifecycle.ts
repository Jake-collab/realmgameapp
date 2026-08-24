import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getPushPermission, getPushInstallationId, registerCurrentDevice } from './push.service';

/**
 * Registers only an already-authorized device. It never triggers a permission
 * dialog; Settings owns the contextual opt-in moment.
 */
export function usePushDeviceLifecycle(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    let cancelled = false;
    void (async () => {
      const permission = await getPushPermission();
      if (permission !== 'granted' && permission !== 'provisional') return;
      const installationId = await getPushInstallationId();
      if (!cancelled) await registerCurrentDevice(userId, installationId);
    })().catch(() => {
      // Push registration is optional. In-app notifications remain functional.
    });
    return () => { cancelled = true; };
  }, [userId]);
}