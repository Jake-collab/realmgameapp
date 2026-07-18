/**
 * Login screen — Worlds
 *
 * Email + password authentication.
 * Social auth slots (Apple, Google) reserved for future activation.
 *
 * States handled:
 *   - Default input
 *   - Loading (submitting)
 *   - Invalid credentials error
 *   - Network error
 *   - Unverified email notice
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
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthContext();
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
    const { error } = await signIn(values);
    if (error) {
      // Map technical errors to friendly messages
      if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('credentials')) {
        setServerError('Incorrect email or password. Please try again.');
      } else if (error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')) {
        setServerError('Connection error. Check your internet and try again.');
      } else if (error.toLowerCase().includes('configured')) {
        setServerError('Authentication is not yet connected. Check back soon.');
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
    // On success, NavigationGuard in _layout.tsx handles the redirect
  }

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
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
          <Text style={[styles.title, { color: colors.foreground }]}>
            Welcome back
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Log in to continue your adventures
          </Text>
        </View>

        {/* Server error */}
        {serverError && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '30', borderRadius: radius.md },
            ]}
          >
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {serverError}
            </Text>
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
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          {/* Forgot password */}
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotBtn}
            accessibilityRole="link"
          >
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Forgot password?
            </Text>
          </Pressable>
        </View>

        {/* Submit */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Log in
        </Button>

        {/* Social auth divider (reserved) */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
            or
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Social placeholders */}
        <View style={styles.socialButtons}>
          <SocialButton icon="apple" label="Continue with Apple" disabled />
          <SocialButton icon="github" label="Continue with Google" disabled />
        </View>

        {/* Sign up link */}
        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Don't have an account?{' '}
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/signup')}
            accessibilityRole="link"
          >
            <Text style={[styles.switchLink, { color: colors.primary }]}>
              Sign up
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Social Button (placeholder) ─────────────────────────────────────────────

function SocialButton({
  icon,
  label,
  disabled,
}: {
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
      style={[
        styles.socialBtn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.md,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
      <Text style={[styles.socialLabel, { color: colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[5],
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  header: { gap: spacing[2] },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[4],
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  form: { gap: spacing[4] },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  socialButtons: { gap: spacing[3] },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    height: 52,
    borderWidth: 1,
  },
  socialLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing[2],
  },
  switchText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  switchLink: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
});
