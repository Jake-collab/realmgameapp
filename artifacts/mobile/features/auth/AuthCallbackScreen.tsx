import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { isExpiredAuthCallbackError, parseAuthCallbackUrl } from './authCallback';

type CallbackState =
  | 'processing'
  | 'success_verification'
  | 'success_recovery'
  | 'error_malformed'
  | 'error_expired'
  | 'error_generic';

export default function AuthCallbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [callbackState, setCallbackState] = useState<CallbackState>('processing');
  const handledUrl = useRef<string | null>(null);

  const processCallback = useCallback(async (url: string) => {
    if (handledUrl.current === url) return;
    handledUrl.current = url;

    if (!isSupabaseConfigured()) {
      setCallbackState('error_generic');
      return;
    }
    if (!url) {
      setCallbackState('error_malformed');
      return;
    }

    const { accessToken, refreshToken, code, type, errorCode, errorDescription } = parseAuthCallbackUrl(url);

    if (errorCode) {
      if (__DEV__) console.warn('[AuthCallback] Error in callback URL:', errorCode);
      setCallbackState(isExpiredAuthCallbackError(errorCode, errorDescription) ? 'error_expired' : 'error_generic');
      return;
    }

    const result = code
      ? await authService.exchangeCodeForSession(code)
      : accessToken && refreshToken
        ? await authService.setSessionFromTokens(accessToken, refreshToken)
        : null;

    if (!result) {
      setCallbackState('error_malformed');
      return;
    }
    if (result.error || !result.session) {
      if (__DEV__) console.warn('[AuthCallback] Session exchange failed:', result.error?.message);
      setCallbackState(isExpiredAuthCallbackError(result.error?.code ?? null, result.error?.message) ? 'error_expired' : 'error_generic');
      return;
    }

    if (type?.toLowerCase() === 'recovery') {
      authService.markPasswordRecoverySession(result.session);
      setCallbackState('success_recovery');
      return;
    }

    if (result.session.user?.id) analytics.emailVerified(result.session.user.id);
    setCallbackState('success_verification');
    // AuthProvider owns the resulting destination through its startup state.
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void processCallback(url);
    });

    void Linking.getInitialURL().then((initialUrl) => {
      void processCallback(initialUrl ?? '');
    });

    return () => subscription.remove();
  }, [processCallback]);

  useEffect(() => {
    if (callbackState !== 'success_recovery') return;
    const timeout = setTimeout(() => router.replace('/(auth)/reset-password'), 350);
    return () => clearTimeout(timeout);
  }, [callbackState, router]);

  const topPad = Platform.OS === 'web' ? 80 : insets.top + spacing[4];
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + spacing[6];

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad }]}>
      {callbackState === 'processing' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Completing sign in…</Text>
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
            {callbackState === 'error_expired' ? 'Link has expired' : callbackState === 'error_malformed' ? 'Invalid link' : 'Something went wrong'}
          </Text>
          <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
            {callbackState === 'error_expired'
              ? 'This link is no longer valid. Please request a new one.'
              : callbackState === 'error_malformed'
                ? 'The link appears to be malformed. Please try again.'
                : 'We were unable to complete sign in. Please try again.'}
          </Text>
          <Button variant="primary" size="lg" onPress={() => router.replace('/(auth)/welcome')}>
            Back to Welcome
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  center: { alignItems: 'center', gap: spacing[5] },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.base },
  errorBox: { alignItems: 'center', gap: spacing[5], maxWidth: 340 },
  errorTitle: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center', letterSpacing: -0.3 },
  errorBody: { fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center', lineHeight: fontSize.base * 1.6 },
});