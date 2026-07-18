/**
 * Forgot Password screen — Worlds
 *
 * User enters their email; Supabase sends a password-reset link.
 * Nonfunctional until Supabase credentials are connected (Build 2).
 */

import React, { useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sent, setSent] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(_values: FormValues) {
    // TODO (Build 2): supabase.auth.resetPasswordForEmail(values.email)
    // Simulate success for now
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
  }

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom + spacing[4];

  if (sent) {
    return (
      <View
        style={[
          styles.root,
          styles.successRoot,
          { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
        ]}
      >
        <View style={[styles.successIcon, { backgroundColor: colors.success + '15', borderRadius: radius.xl }]}>
          <Feather name="check-circle" size={36} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          Reset link sent
        </Text>
        <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
          Check your inbox at{'\n'}
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.semiBold }}>
            {getValues('email')}
          </Text>
          {'\n\n'}
          Follow the link in the email to reset your password.
        </Text>
        <Button variant="primary" size="lg" onPress={() => router.replace('/(auth)/login')}>
          Back to Log In
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

        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Send reset link
        </Button>

        <Pressable
          onPress={() => router.back()}
          style={styles.backLink}
          accessibilityRole="link"
        >
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
  backBtn: { alignSelf: 'flex-start' },
  header: { gap: spacing[3] },
  iconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  backLink: { alignItems: 'center', paddingTop: spacing[2] },
  backLinkText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
