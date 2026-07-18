/**
 * Forgot Password screen — Worlds
 *
 * Sends a password-reset email via Supabase Auth.
 * The success message is intentionally neutral — does not reveal
 * whether the email address is registered in Worlds.
 *
 * Rate-limited: resend cooldown of 60 seconds enforced in UI.
 * Supabase also enforces its own rate limits server-side.
 */

import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Deep link redirect URL (see docs/AUTH_DEEP_LINKS.md) ─────────────────────
const REDIRECT_URL = 'worlds://auth-callback';

const RESEND_COOLDOWN = 60;

const schema = z.object({
  email: z
    .string()
    .email('Enter a valid email address')
    .toLowerCase()
    .transform((v) => v.trim()),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestPasswordReset } = useAuthContext();

  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sentEmail, setSentEmail] = useState('');

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const onSubmit = useCallback(async (values: FormValues) => {
    setServerError(null);
    const { error } = await requestPasswordReset(values.email, REDIRECT_URL);
    if (error) {
      setServerError(error);
      return;
    }
    setSentEmail(values.email);
    setSent(true);
    startCooldown();
  }, [requestPasswordReset, startCooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setServerError(null);
    const { error } = await requestPasswordReset(sentEmail, REDIRECT_URL);
    if (error) { setServerError(error); return; }
    startCooldown();
  }, [cooldown, requestPasswordReset, sentEmail, startCooldown]);

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  // ── Success state ─────────────────────────────────────────────────────────

  if (sent) {
    return (
      <View style={[styles.root, styles.successRoot, {
        backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad,
      }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.accent + '15', borderRadius: radius.xl }]}>
          <Feather name="check-circle" size={36} color={colors.accent} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          Reset link sent
        </Text>
        <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
          If an account exists for{' '}
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.semiBold }}>
            {sentEmail}
          </Text>
          , a password-reset link has been sent.{'\n\n'}
          Check your inbox and follow the link to set a new password.
        </Text>

        {serverError && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{serverError}</Text>
        )}

        <View style={styles.successActions}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => router.replace('/(auth)/login')}
          >
            Back to Log In
          </Button>
          <Button
            variant="ghost"
            size="md"
            onPress={handleResend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend reset link'}
          </Button>
        </View>
      </View>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '12', borderRadius: radius.xl }]}>
            <Feather name="key" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Forgot password?</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enter your email address and we'll send you a reset link.
          </Text>
        </View>

        {serverError && (
          <View
            style={[styles.errorBanner, {
              backgroundColor: colors.destructive + '12',
              borderColor: colors.destructive + '30',
              borderRadius: radius.md,
            }]}
            accessibilityRole="alert"
          >
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{serverError}</Text>
          </View>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              leftIcon={<Feather name="mail" size={18} color={colors.mutedForeground} />}
            />
          )}
        />

        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Send reset link
        </Button>

        <Pressable onPress={() => router.back()} style={styles.backLink} accessibilityRole="link">
          <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
            Back to Log In
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: spacing[5], gap: spacing[5] },
  successRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5], paddingHorizontal: spacing[8] },
  successIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  successBody: { fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center', lineHeight: fontSize.base * 1.6 },
  successActions: { width: '100%', gap: spacing[3] },
  backBtn: { alignSelf: 'flex-start' },
  header: { gap: spacing[3] },
  iconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], padding: spacing[4], borderWidth: 1 },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  backLink: { alignItems: 'center', paddingTop: spacing[2] },
  backLinkText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
