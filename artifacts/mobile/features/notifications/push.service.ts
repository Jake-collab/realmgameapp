import { Linking, Platform } from 'react-native';
import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

export type PushPermissionStatus = 'not_asked' | 'granted' | 'denied' | 'provisional';

type ExpoNotificationsModule = {
  getPermissionsAsync: () => Promise<{ status: string; ios?: { status: string } }>;
  requestPermissionsAsync: () => Promise<{ status: string; ios?: { status: string } }>;
  getExpoPushTokenAsync: () => Promise<{ data: string }>;
};

function notificationsModule(): ExpoNotificationsModule | null {
  try {
    // Optional until the native Expo notification module is installed in the app build.
    return require('expo-notifications') as ExpoNotificationsModule;
  } catch {
    return null;
  }
}

function statusOf(permission: { status: string; ios?: { status: string } }): PushPermissionStatus {
  if (permission.ios?.status === 'PROVISIONAL') return 'provisional';
  if (permission.status === 'granted') return 'granted';
  if (permission.status === 'denied') return 'denied';
  return 'not_asked';
}

export async function getPushPermission(): Promise<PushPermissionStatus> {
  const module = notificationsModule();
  if (!module || Platform.OS === 'web') return 'not_asked';
  return statusOf(await module.getPermissionsAsync());
}

export async function requestPushPermission(): Promise<PushPermissionStatus> {
  const module = notificationsModule();
  if (!module || Platform.OS === 'web') return 'not_asked';
  return statusOf(await module.requestPermissionsAsync());
}

export async function openNotificationSettings() {
  if (Platform.OS !== 'web') await Linking.openSettings();
}

export async function registerCurrentDevice(userId: string, installationId: string, appVersion: string | null = null) {
  const module = notificationsModule();
  if (!module || !isSupabaseConfigured() || Platform.OS === 'web') return null;
  const permission = await getPushPermission();
  if (permission !== 'granted' && permission !== 'provisional') return null;
  const token = (await module.getExpoPushTokenAsync()).data;
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { data, error } = await requireSupabase().rpc('register_push_device', {
    p_installation_id: installationId, p_push_token: token, p_platform: platform, p_app_version: appVersion, p_metadata: {},
  });
  if (error) throw error;
  return data;
}

export async function unregisterCurrentDevice(installationId: string) {
  if (!isSupabaseConfigured()) return;
  const { error } = await requireSupabase().rpc('unregister_push_device', { p_installation_id: installationId });
  if (error) throw error;
}