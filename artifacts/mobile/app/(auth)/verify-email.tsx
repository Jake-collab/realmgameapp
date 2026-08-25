/**
 * Verify Email screen — Worlds
 *
 * Shown when a user has an authenticated session but their email is
 * not yet confirmed (authenticated_needs_verification startup state),
 * or immediately after sign-up when email confirmation is required.
 *
 * Features:
 *   - Shows the email address that was used
 *   - Resend with 60-second cooldown to prevent abuse
 *   - Open email app shortcut
 *   - Poll / watch auth state for verification (NavigationGuard handles redirect)
 *   - Return to welcome / logout option
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import { getAuthRedirectUrl } from '@/features/auth/authRedirects';

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 5_000;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pendingVerificationEmail, resendVerification, signOut } = useAuthContext();

  const email = pendingVerificationEmail ?? user?.email ?? '';

  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cooldown timer ───────────────────────────────────────────────────────

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Poll for verification ─────────────────────────────────────────────────
  // NavigationGuard will redirect automatically when onAuthStateChange fires
  // after the user verifies via the email link. The poll below is a backup
  // for cases where the deep link does not trigger a state change.

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    pollRef.current = setInterval(async () => {
      const client = requireSupabase();
      const { data } = await client.auth.getUser();
      if (data.user?.email_confirmed_at) {
        // User verified — onAuthStateChange should fire; clear poll
        clearInterval(pollRef.current!);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Resend ────────────────────────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || !email) return;
    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    const { error } = await resendVerification(email, getAuthRedirectUrl());
    setIsResending(false);

    if (error) {
      setResendError(error);
    } else {
      setResendMessage('Verification email sent. Check your inbox.');
      startCooldown();
    }
  }, [cooldown, email, resendVerification, startCooldown]);

  // ── Open email app ────────────────────────────────────────────────────────

  const handleOpenEmail = useCallback(() => {
    const schemes = ['message://', 'googlegmail://', 'ms-outlook://', 'mailspring://'];
    const tryScheme = (index: number) => {
      if (index >= schemes.length) {
        Linking.openURL('mailto:').catch(() => {});
        return;
      }
      Linking.canOpenURL(schemes[index])
        .then((can) => (can ? Linking.openURL(schemes[index]) : tryScheme(index + 1)))
        .catch(() => tryScheme(index + 1));
    };
    tryScheme(0);
  }, []);

  const topPad = Platform.OS === 'web' ? 80 : insets.top + spacing[6];
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + spacing[6];

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad }]}
    >
      {/* Icon */}
      <View style={styles.center}>
        <View
          style={[styles.iconWrap, { backgroundColor: colors.primary + '12', borderRadius: radius.xl }]}
        >
          <Feather name="mail" size={40} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          Verify your email
        </Text>

        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          We sent a verification link to
        </Text>

        {email ? (
          <Text style={[styles.email, { color: colors.foreground }]}>{email}</Text>
        ) : null}

        <Text style={[styles.instructions, { color: colors.mutedForeground }]}>
          Click the link in your email to activate your account. Once verified,
          Worlds will open automatically.
        </Text>
      </View>

      {/* Feedback */}
      {resendMessage && (
        <View style={[styles.notice, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30', borderRadius: radius.md }]}>
          <Feather name="check-circle" size={15} color={colors.accent} />
          <Text style={[styles.noticeText, { color: colors.accent }]}>{resendMessage}</Text>
        </View>
      )}
      {resendError && (
        <View style={[styles.notice, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '30', borderRadius: radius.md }]}>
          <Feather name="alert-circle" size={15} color={colors.destructive} />
          <Text style={[styles.noticeText, { color: colors.destructive }]}>{resendError}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          onPress={handleOpenEmail}
        >
          Open email app
        </Button>

        <Button
          variant="outline"
          size="md"
          onPress={handleResend}
          loading={isResending}
          disabled={isResending || cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </Button>

        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
          style={styles.backLink}
          accessibilityRole="button"
        >
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>
            Use a different account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  iconWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  email: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  instructions: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.6,
    maxWidth: 320,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[4],
    borderWidth: 1,
    marginBottom: spacing[4],
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  actions: {
    gap: spacing[3],
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  backText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
