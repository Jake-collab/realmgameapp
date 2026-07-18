/**
 * Reset Password screen — Worlds
 *
 * Reached via the auth-callback screen after a valid password-recovery
 * deep link is exchanged for a session.
 *
 * Security:
 *   - Verifies that an active recovery session exists before accepting input
 *   - Rejects mismatched passwords at the form level
 *   - Calls supabase.auth.updateUser() to set the new password
 *   - After success, the session returns to normal (not recovery mode)
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { analytics } from '@/lib/auth/analyticsHooks';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updatePassword } = useAuthContext();

  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Verify a valid recovery session exists before showing the form
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setHasSession(false);
      return;
    }
    const client = requireSupabase();
    client.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await updatePassword(values.password);

    if (error) {
      setServerError(error);
      return;
    }

    analytics.passwordUpdated();
    setDone(true);
  }

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  // ── No valid recovery session ─────────────────────────────────────────────

  if (hasSession === false) {
    return (
      <View style={[styles.root, styles.centeredRoot, {
        backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad,
      }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.destructive + '15', borderRadius: radius.xl }]}>
          <Feather name="alert-triangle" size={36} color={colors.destructive} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Link has expired</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
          This password-reset link is no longer valid. Please request a new one.
        </Text>
        <Button variant="primary" size="lg" onPress={() => router.replace('/(auth)/forgot-password')}>
          Request new link
        </Button>
      </View>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (done) {
    return (
      <View style={[styles.root, styles.centeredRoot, {
        backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad,
      }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent + '15', borderRadius: radius.xl }]}>
          <Feather name="check-circle" size={36} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Password updated</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Your password has been reset. You can now log in with your new password.
        </Text>
        <Button variant="primary" size="lg" onPress={() => router.replace('/(auth)/login')}>
          Go to Log In
        </Button>
      </View>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (hasSession === null) {
    return (
      <View style={[styles.root, styles.centeredRoot, {
        backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad,
      }]}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Verifying link…</Text>
      </View>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '12', borderRadius: radius.xl }]}>
            <Feather name="lock" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Set new password</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Choose a strong password for your Worlds account.
          </Text>
        </View>

        {serverError && (
          <View style={[styles.errorBanner, {
            backgroundColor: colors.destructive + '12',
            borderColor: colors.destructive + '30',
            borderRadius: radius.md,
          }]} accessibilityRole="alert">
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{serverError}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="New password"
                placeholder="At least 8 characters"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Confirm new password"
                placeholder="Re-enter your password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          {/* Password requirements */}
          <View style={styles.hints} accessibilityLabel="Password requirements">
            {['At least 8 characters', 'One uppercase letter', 'One number'].map((h) => (
              <View key={h} style={styles.hintRow}>
                <Feather name="check" size={12} color={colors.mutedForeground} />
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{h}</Text>
              </View>
            ))}
          </View>
        </View>

        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Update password
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: spacing[5], gap: spacing[5] },
  centeredRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5], paddingHorizontal: spacing[8] },
  header: { gap: spacing[3] },
  iconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], padding: spacing[4], borderWidth: 1 },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  form: { gap: spacing[4] },
  hints: { gap: spacing[1.5], marginTop: -spacing[2] },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  hintText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
