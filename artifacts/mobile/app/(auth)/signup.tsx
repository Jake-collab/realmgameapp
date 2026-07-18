/**
 * Sign-up screen — Worlds
 *
 * Creates a new Worlds account.
 * Fields: display name, username, email, password, confirm password,
 *         ToS acceptance, Privacy Policy acceptance.
 *
 * Social auth slots (Apple, Google) reserved for future activation.
 *
 * States handled:
 *   - Default input
 *   - Field-level validation errors
 *   - Loading (submitting)
 *   - Server error
 *   - Email verification pending state
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

const schema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Display name must be at least 2 characters')
      .max(50, 'Display name is too long'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be 20 characters or fewer')
      .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
    acceptedTerms: z.boolean().refine((v) => v, 'You must accept the Terms of Service'),
    acceptedPrivacy: z.boolean().refine((v) => v, 'You must accept the Privacy Policy'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

// ─── Screen ───────────────────────────────────────────────────────────────────

type ScreenState = 'form' | 'verify-email';

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuthContext();
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
      acceptedPrivacy: false,
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await signUp({
      email: values.email,
      password: values.password,
      username: values.username,
    });

    if (error) {
      if (error.toLowerCase().includes('already')) {
        setServerError('An account with this email already exists. Try logging in.');
      } else if (error.toLowerCase().includes('configured')) {
        setServerError('Authentication is not yet connected. Check back soon.');
      } else {
        setServerError('Something went wrong. Please try again.');
      }
      return;
    }

    // Supabase sends an email verification link by default
    setScreenState('verify-email');
  }

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  // ── Email verification pending ─────────────────────────────────────────────
  if (screenState === 'verify-email') {
    return (
      <View
        style={[
          styles.root,
          styles.verifyRoot,
          { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
        ]}
      >
        <View
          style={[
            styles.verifyIcon,
            { backgroundColor: colors.primary + '12', borderRadius: radius.xl },
          ]}
        >
          <Feather name="mail" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.verifyTitle, { color: colors.foreground }]}>
          Check your email
        </Text>
        <Text style={[styles.verifyBody, { color: colors.mutedForeground }]}>
          We sent a verification link to{'\n'}
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.semiBold }}>
            {getValues('email')}
          </Text>
          {'\n\n'}
          Click the link to activate your account, then come back to log in.
        </Text>
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.replace('/(auth)/login')}
        >
          Go to Log In
        </Button>
      </View>
    );
  }

  // ── Sign-up form ───────────────────────────────────────────────────────────
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
            Create account
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Join Worlds and start your first adventure
          </Text>
        </View>

        {/* Server error */}
        {serverError && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.destructive + '12',
                borderColor: colors.destructive + '30',
                borderRadius: radius.md,
              },
            ]}
          >
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {serverError}
            </Text>
          </View>
        )}

        {/* Form fields */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Display name"
                placeholder="How you'll appear to others"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.displayName?.message}
                autoComplete="name"
                leftIcon={<Feather name="user" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Username"
                placeholder="lowercase, no spaces"
                value={value}
                onChangeText={(t) => onChange(t.toLowerCase())}
                onBlur={onBlur}
                error={errors.username?.message}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Feather name="at-sign" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

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
                placeholder="At least 8 characters"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                secureTextEntry
                autoComplete="new-password"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Confirm password"
                placeholder="Re-enter your password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
                secureTextEntry
                autoComplete="new-password"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          {/* Password hints */}
          <View style={styles.passwordHints}>
            {PASSWORD_HINTS.map((hint) => (
              <View key={hint} style={styles.hintRow}>
                <Feather name="check" size={12} color={colors.mutedForeground} />
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {hint}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Checkboxes */}
        <View style={styles.checkboxes}>
          <Controller
            control={control}
            name="acceptedTerms"
            render={({ field: { onChange, value } }) => (
              <CheckboxRow
                checked={value}
                onToggle={() => onChange(!value)}
                error={errors.acceptedTerms?.message}
              >
                I accept the{' '}
                <Text style={{ color: colors.primary, fontFamily: fontFamily.medium }}>
                  Terms of Service
                </Text>
              </CheckboxRow>
            )}
          />
          <Controller
            control={control}
            name="acceptedPrivacy"
            render={({ field: { onChange, value } }) => (
              <CheckboxRow
                checked={value}
                onToggle={() => onChange(!value)}
                error={errors.acceptedPrivacy?.message}
              >
                I accept the{' '}
                <Text style={{ color: colors.primary, fontFamily: fontFamily.medium }}>
                  Privacy Policy
                </Text>
              </CheckboxRow>
            )}
          />
        </View>

        {/* Submit */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Create account
        </Button>

        {/* Login link */}
        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Already have an account?{' '}
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="link"
          >
            <Text style={[styles.switchLink, { color: colors.primary }]}>Log in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Checkbox Row ─────────────────────────────────────────────────────────────

function CheckboxRow({
  checked,
  onToggle,
  error,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  error?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.checkboxWrap}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.checkboxRow}
      >
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: checked ? colors.primary : 'transparent',
              borderColor: checked ? colors.primary : colors.border,
              borderRadius: radius.sm,
            },
          ]}
        >
          {checked && <Feather name="check" size={12} color="#fff" />}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>
          {children}
        </Text>
      </Pressable>
      {error && (
        <Text style={[styles.checkboxError, { color: colors.destructive }]}>{error}</Text>
      )}
    </View>
  );
}

const PASSWORD_HINTS = [
  'At least 8 characters',
  'One uppercase letter',
  'One number',
];

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  verifyRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingHorizontal: spacing[8],
  },
  verifyIcon: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
  },
  verifyBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.6,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing[2] },
  header: { gap: spacing[2] },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: -0.5,
  },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base },
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
  passwordHints: { gap: spacing[1.5], marginTop: -spacing[2] },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  hintText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  checkboxes: { gap: spacing[3] },
  checkboxWrap: { gap: spacing[1] },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxLabel: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  checkboxError: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginLeft: spacing[8] },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: spacing[2] },
  switchText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  switchLink: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
