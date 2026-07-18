/**
 * Reset Password screen — Worlds
 *
 * Reached via the password-reset email link (deep link: worlds://reset-password?token=...).
 * Allows the user to set a new password.
 *
 * Nonfunctional until Supabase is connected (Build 2) and deep linking
 * is configured (scheme: "worlds" in app.json is already set).
 */

import React, { useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(_values: FormValues) {
    // TODO (Build 2): supabase.auth.updateUser({ password: values.password })
    await new Promise((r) => setTimeout(r, 600));
    setDone(true);
  }

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  if (done) {
    return (
      <View
        style={[
          styles.root,
          styles.doneRoot,
          { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.success + '15', borderRadius: radius.xl }]}>
          <Feather name="check-circle" size={36} color={colors.success} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Password updated</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your password has been reset. You can now log in with your new password.
        </Text>
        <Button variant="primary" size="lg" onPress={() => router.replace('/(auth)/login')}>
          Go to Log In
        </Button>
      </View>
    );
  }

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
                leftIcon={<Feather name="lock" size={18} color={colors.mutedForeground} />}
              />
            )}
          />
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
  doneRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5], paddingHorizontal: spacing[8] },
  header: { gap: spacing[3] },
  iconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  form: { gap: spacing[4] },
});
