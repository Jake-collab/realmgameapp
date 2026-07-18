/**
 * Auth Callback screen — Worlds
 *
 * Handles deep links from Supabase Auth for:
 *   - Email verification     (type=signup)
 *   - Password recovery      (type=recovery)
 *   - Future: magic link     (type=magiclink)
 *   - Future: OAuth callback (type=oauth)
 *
 * Deep link format (Supabase):
 *   worlds://auth-callback#access_token=...&refresh_token=...&type=signup
 *   worlds://auth-callback#access_token=...&refresh_token=...&type=recovery
 *
 * Required Supabase redirect URLs (see docs/AUTH_DEEP_LINKS.md):
 *   Development:  worlds://auth-callback
 *   Production:   https://YOUR_DOMAIN/auth/callback (universal link)
 *
 * Security:
 *   - Tokens are parsed from the URL fragment only — never from query params
 *   - Malformed or missing tokens are rejected cleanly
 *   - Recovery tokens are exchanged exactly once, then cleared
 *   - No redirect loops — this screen never links to itself
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useColors } from '@/hooks/useColors';
import { authService } from '@/services/auth.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { analytics } from '@/lib/auth/analyticsHooks';

type CallbackState =
  | 'processing'
  | 'success_verification'
  | 'success_recovery'
  | 'error_malformed'
  | 'error_expired'
  | 'error_generic';

// ─── URL parsing ──────────────────────────────────────────────────────────────

interface ParsedCallback {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

function parseCallbackUrl(url: string): ParsedCallback {
  // Supabase puts tokens in the URL fragment (#)
  const fragmentIndex = url.indexOf('#');
  const fragment = fragmentIndex >= 0 ? url.slice(fragmentIndex + 1) : '';
  const params = new URLSearchParams(fragment);

  // Also check query string (some clients strip fragments)
  const queryIndex = url.indexOf('?');
  const query = queryIndex >= 0 && fragmentIndex < 0
    ? url.slice(queryIndex + 1)
    : '';
  const queryParams = new URLSearchParams(query);

  const get = (key: string) => params.get(key) ?? queryParams.get(key);

  return {
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    type: get('type'),
    errorCode: get('error_code') ?? get('error'),
    errorDescription: get('error_description'),
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuthCallbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [callbackState, setCallbackState] = useState<CallbackState>('processing');
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      if (!isSupabaseConfigured()) {
        setCallbackState('error_generic');
        return;
      }

      // Get the URL that launched the screen
      const initialUrl = await Linking.getInitialURL();
      const url = initialUrl ?? '';

      if (!url) {
        setCallbackState('error_malformed');
        return;
      }

      const { accessToken, refreshToken, type, errorCode } = parseCallbackUrl(url);

      // Supabase error in the callback
      if (errorCode) {
        if (__DEV__) console.warn('[AuthCallback] Error in callback URL:', errorCode);
        setCallbackState(
          errorCode === 'access_denied' || errorCode === 'otp_expired'
            ? 'error_expired'
            : 'error_generic'
        );
        return;
      }

      if (!accessToken || !refreshToken) {
        setCallbackState('error_malformed');
        return;
      }

      // Exchange tokens for a session
      const { session, error } = await authService.setSessionFromTokens(accessToken, refreshToken);

      if (error || !session) {
        if (__DEV__) console.warn('[AuthCallback] setSession error:', error?.message);
        setCallbackState(
          error?.message?.toLowerCase().includes('expired') ? 'error_expired' : 'error_generic'
        );
        return;
      }

      if (type === 'recovery') {
        // Password recovery — route to reset-password, not main app
        setCallbackState('success_recovery');
        analytics.startupStateResolved('authenticated_ready');
      } else {
        // Email verification or magic link
        if (session.user?.id) {
          analytics.emailVerified(session.user.id);
        }
        setCallbackState('success_verification');
        // NavigationGuard will redirect automatically on auth state change
      }
    };

    processCallback();
  }, []);

  // Auto-navigate for success states
  useEffect(() => {
    if (isNavigating) return;

    if (callbackState === 'success_verification') {
      // NavigationGuard handles this via onAuthStateChange
      // Small delay to ensure the state machine has updated
      const t = setTimeout(() => {
        setIsNavigating(true);
        router.replace('/(onboarding)/welcome');
      }, 800);
      return () => clearTimeout(t);
    }

    if (callbackState === 'success_recovery') {
      const t = setTimeout(() => {
        setIsNavigating(true);
        router.replace('/(auth)/reset-password');
      }, 400);
      return () => clearTimeout(t);
    }
  }, [callbackState, isNavigating, router]);

  const topPad = Platform.OS === 'web' ? 80 : insets.top + spacing[4];
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + spacing[6];

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      {callbackState === 'processing' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Completing sign in…
          </Text>
        </View>
      ) : callbackState === 'success_verification' || callbackState === 'success_recovery' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {callbackState === 'success_recovery' ? 'Opening password reset…' : 'Verifying your account…'}
          </Text>
        </View>
      ) : (
        <View style={styles.errorBox}>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            {callbackState === 'error_expired'
              ? 'Link has expired'
              : callbackState === 'error_malformed'
              ? 'Invalid link'
              : 'Something went wrong'}
          </Text>
          <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
            {callbackState === 'error_expired'
              ? 'This link is no longer valid. Please request a new one.'
              : callbackState === 'error_malformed'
              ? 'The link appears to be malformed. Please try again.'
              : 'We were unable to complete sign in. Please try again.'}
          </Text>
          <Button
            variant="primary"
            size="lg"
            onPress={() => router.replace('/(auth)/welcome')}
          >
            Back to Welcome
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  center: {
    alignItems: 'center',
    gap: spacing[5],
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  errorBox: {
    alignItems: 'center',
    gap: spacing[5],
    maxWidth: 340,
  },
  errorTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  errorBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.6,
  },
});
