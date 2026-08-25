import { Platform } from 'react-native';

/**
 * The only destinations Supabase Auth may redirect to.
 *
 * Native email flows must use the custom scheme. Web flows return to the
 * current web origin, which is the production domain in a deployed build and
 * the current preview origin while testing Expo web.
 */
export const NATIVE_AUTH_CALLBACK_URL = 'worlds://auth-callback';
export const PRODUCTION_WEB_AUTH_CALLBACK_URL = 'https://matterrealm.com/auth/callback';

export function getAuthRedirectUrl(): string {
  if (Platform.OS !== 'web') return NATIVE_AUTH_CALLBACK_URL;

  const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
  return origin ? `${origin}/auth/callback` : PRODUCTION_WEB_AUTH_CALLBACK_URL;
}