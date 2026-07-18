/**
 * Login screen — Worlds
 *
 * Email + password authentication with full error normalization and
 * post-login routing via NavigationGuard (startup state machine).
 *
 * Error messages avoid account enumeration — generic "couldn't sign you in"
 * wording is used for both wrong password and unknown email.
 *
 * Handles:
 *   - Invalid credentials
 *   - Unverified email
 *   - Suspended account
 *   - Network failure
 *   - Rate limiting
 *   - Supabase not configured (dev mode)
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { useColors } from '@/hooks/useColors';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().transform((v) => v.trim()),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, startupState } = useAuthContext();
  const configured = isSupabaseConfigured();

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);

    if (!configured) {
      setServerError(
        __DEV__
          ? 'Authentication setup is pending. Account creation and login will be enabled after Supabase is connected.'
          : 'Service is temporarily unavailable. Please try again later.'
      );
      return;
    }

    const { error } = await signIn(values);

    if (error) {
      setServerError(error);
    }
    // On success, NavigationGuard handles redirect via startup state machine
  }

  // Disconnected development notice
  const showDevNotice = !configured && __DEV__;

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Log in to continue your adventures
          </Text>
        </View>

        {/* Dev notice (neutral, development-only) */}
        {showDevNotice && (
          <View
            style={[styles.devNotice, { backgroundColor: colors.muted, borderRadius: radius.md }]}
            accessibilityRole="status"
          >
            <Feather name="info" size={15} color={colors.mutedForeground} />
            <Text style={[styles.devNoticeText, { color: colors.mutedForeground }]}>
              Authentication setup is pending. Account creation and login will be enabled after Supabase is connected.
            </Text>
          </View>
        )}

        {/* Server error */}
        {serverError && (
          <View
            style={[styles.errorBanner, {
              backgroundColor: colors.destructive + '12',
              borderColor: colors.destructive + '30',
              borderRadius: radius.md,
            }]}
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
          >
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{serverError}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
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

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="Your password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotBtn}
            accessibilityRole="link"
          >
            <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
          </Pressable>
        </View>

        {/* Submit */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting || !configured}
        >
          Log in
        </Button>

        {/* Social auth divider (reserved) */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Social placeholders (not yet functional) */}
        <View style={styles.socialButtons}>
          <SocialButton icon="apple" label="Continue with Apple" disabled />
          <SocialButton icon="github" label="Continue with Google" disabled />
        </View>

        {/* Sign up link */}
        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Don't have an account?{' '}
          </Text>
          <Pressable onPress={() => router.replace('/(auth)/signup')} accessibilityRole="link">
            <Text style={[styles.switchLink, { color: colors.primary }]}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Social Button (inactive placeholder) ────────────────────────────────────

function SocialButton({ icon, label, disabled }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[styles.socialBtn, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderRadius: radius.md,
        opacity: disabled ? 0.45 : 1,
      }]}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
      <Text style={[styles.socialLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing[2] },
  header: { gap: spacing[2] },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'], letterSpacing: -0.5 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base },
  devNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    padding: spacing[4],
  },
  devNoticeText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    padding: spacing[4], borderWidth: 1,
  },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  form: { gap: spacing[4] },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  socialButtons: { gap: spacing[3] },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[3], height: 52, borderWidth: 1,
  },
  socialLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: spacing[2] },
  switchText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  switchLink: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
