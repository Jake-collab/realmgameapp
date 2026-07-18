/**
 * Sign-up screen — Worlds
 *
 * Creates a new Worlds account with full validation, username availability
 * checking, legal acceptance, and error normalization.
 *
 * Flow:
 *   form → [API] → needsVerification? → inline verify state → (auth)/verify-email
 *                                     → no → NavigationGuard → (onboarding)
 *
 * Document versions (placeholder until final legal text is approved):
 *   terms_v1_draft | privacy_v1_draft
 */

import React, { useCallback, useState } from 'react';
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
import { useUsernameAvailability } from '@/features/auth/hooks/useUsernameAvailability';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Constants ────────────────────────────────────────────────────────────────

const TERMS_VERSION = 'terms_v1_draft';
const PRIVACY_VERSION = 'privacy_v1_draft';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Display name must be at least 2 characters')
      .max(50, 'Display name is too long')
      .transform((v) => v.trim()),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be 20 characters or fewer')
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9_]*[a-z0-9]$|^[a-z0-9]$/, 'Only lowercase letters, numbers, and underscores — no leading/trailing underscores'),
    email: z
      .string()
      .email('Enter a valid email address')
      .toLowerCase()
      .transform((v) => v.trim()),
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

// ─── Screen state ─────────────────────────────────────────────────────────────

type ScreenState = 'form' | 'verify-email';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuthContext();
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    control,
    handleSubmit,
    watch,
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
    mode: 'onBlur',
  });

  const usernameValue = watch('username');
  const { status: usernameStatus, message: usernameStatusMessage } =
    useUsernameAvailability(usernameValue ?? '');

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setServerError(null);

      // Soft-block if username is known-unavailable (DB is the real gatekeeper)
      if (usernameStatus === 'unavailable') {
        setServerError('That username is already taken. Please choose another.');
        return;
      }

      const { error, needsVerification } = await signUp({
        email: values.email,
        password: values.password,
        username: values.username,
        displayName: values.displayName,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      });

      if (error) {
        setServerError(error);
        return;
      }

      setSubmittedEmail(values.email);

      if (needsVerification) {
        setScreenState('verify-email');
      }
      // On success without verification, NavigationGuard redirects to (onboarding)
    },
    [signUp, usernameStatus]
  );

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  // ── Email verification pending state ─────────────────────────────────────

  if (screenState === 'verify-email') {
    return (
      <View
        style={[
          styles.root,
          styles.verifyRoot,
          { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
        ]}
      >
        <View style={[styles.verifyIcon, { backgroundColor: colors.primary + '12', borderRadius: radius.xl }]}>
          <Feather name="mail" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.verifyTitle, { color: colors.foreground }]}>
          Check your email
        </Text>
        <Text style={[styles.verifyBody, { color: colors.mutedForeground }]}>
          We sent a verification link to{'\n'}
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.semiBold }}>
            {submittedEmail}
          </Text>
          {'\n\n'}
          Tap the link to activate your account, then return to Worlds to log in.
        </Text>
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.replace('/(auth)/verify-email')}
        >
          Go to Verification
        </Button>
        <Button
          variant="ghost"
          size="md"
          onPress={() => router.replace('/(auth)/login')}
        >
          Back to Log In
        </Button>
      </View>
    );
  }

  // ── Sign-up form ──────────────────────────────────────────────────────────

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
          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Join Worlds and start your first adventure
          </Text>
        </View>

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
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {serverError}
            </Text>
          </View>
        )}

        {/* Form fields */}
        <View style={styles.form}>
          {/* Display name */}
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
                textContentType="name"
                leftIcon={<Feather name="user" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          {/* Username */}
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <Input
                  label="Username"
                  placeholder="lowercase letters, numbers, underscores"
                  value={value}
                  onChangeText={(t) => onChange(t.toLowerCase().replace(/\s/g, ''))}
                  onBlur={onBlur}
                  error={errors.username?.message}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  leftIcon={<Feather name="at-sign" size={18} color={colors.mutedForeground} />}
                />
                {/* Username availability indicator */}
                {!errors.username && usernameStatusMessage && (
                  <View style={styles.usernameStatus}>
                    <Feather
                      name={
                        usernameStatus === 'available' ? 'check-circle' :
                        usernameStatus === 'unavailable' ? 'x-circle' :
                        usernameStatus === 'checking' ? 'loader' :
                        'info'
                      }
                      size={13}
                      color={
                        usernameStatus === 'available' ? colors.accent :
                        usernameStatus === 'unavailable' || usernameStatus === 'invalid' ? colors.destructive :
                        colors.mutedForeground
                      }
                    />
                    <Text
                      style={[styles.usernameStatusText, {
                        color:
                          usernameStatus === 'available' ? colors.accent :
                          usernameStatus === 'unavailable' || usernameStatus === 'invalid' ? colors.destructive :
                          colors.mutedForeground,
                      }]}
                    >
                      {usernameStatusMessage}
                    </Text>
                  </View>
                )}
              </View>
            )}
          />

          {/* Email */}
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

          {/* Password */}
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
                textContentType="newPassword"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          {/* Confirm password */}
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
                textContentType="newPassword"
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />

          {/* Password requirements */}
          <View style={styles.passwordHints} accessibilityLabel="Password requirements">
            {PASSWORD_HINTS.map((hint) => (
              <View key={hint} style={styles.hintRow}>
                <Feather name="check" size={12} color={colors.mutedForeground} />
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{hint}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Legal checkboxes */}
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
                {' '}
                <Text style={[styles.draftBadge, { color: colors.mutedForeground }]}>(draft)</Text>
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
                {' '}
                <Text style={[styles.draftBadge, { color: colors.mutedForeground }]}>(draft)</Text>
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
          disabled={isSubmitting || usernameStatus === 'checking'}
        >
          Create account
        </Button>

        {/* Login link */}
        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Already have an account?{' '}
          </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="link">
            <Text style={[styles.switchLink, { color: colors.primary }]}>Log in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Checkbox Row ─────────────────────────────────────────────────────────────

function CheckboxRow({
  checked, onToggle, error, children,
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
          style={[styles.checkbox, {
            backgroundColor: checked ? colors.primary : 'transparent',
            borderColor: checked ? colors.primary : colors.border,
            borderRadius: radius.sm,
          }]}
        >
          {checked && <Feather name="check" size={12} color="#fff" />}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>{children}</Text>
      </Pressable>
      {error && (
        <Text
          style={[styles.checkboxError, { color: colors.destructive }]}
          accessibilityLiveRegion="assertive"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  verifyIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  verifyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  verifyBody: { fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center', lineHeight: fontSize.base * 1.6 },
  backBtn: { alignSelf: 'flex-start', marginBottom: spacing[2] },
  header: { gap: spacing[2] },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'], letterSpacing: -0.5 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    padding: spacing[4], borderWidth: 1,
  },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  form: { gap: spacing[4] },
  usernameStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], marginTop: spacing[1.5] },
  usernameStatusText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  passwordHints: { gap: spacing[1.5], marginTop: -spacing[2] },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  hintText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  checkboxes: { gap: spacing[3] },
  checkboxWrap: { gap: spacing[1] },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxLabel: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  checkboxError: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginLeft: spacing[8] },
  draftBadge: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: spacing[2] },
  switchText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  switchLink: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
