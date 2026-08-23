import { useCallback, useEffect, useState } from 'react';
import { getPushPermission, openNotificationSettings, requestPushPermission, type PushPermissionStatus } from './push.service';

export function usePushPermission() {
  const [status, setStatus] = useState<PushPermissionStatus>('not_asked');
  const [isLoading, setLoading] = useState(true);
  useEffect(() => { void getPushPermission().then(setStatus).finally(() => setLoading(false)); }, []);
  const request = useCallback(async () => { setLoading(true); const next = await requestPushPermission(); setStatus(next); setLoading(false); return next; }, []);
  return { status, isLoading, request, openSettings: openNotificationSettings };
}