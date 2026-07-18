/**
 * Onboarding — Complete step
 *
 * Marks onboarding as completed in the database, syncs local state,
 * then routes into the main application.
 *
 * What happens here:
 *   1. Update profile.onboarding_status = 'completed'
 *   2. Record onboarding_completed_at timestamp
 *   3. Update user_settings.onboarding_progress.step = 'complete'
 *   4. Set hasOnboarded = true in Zustand
 *   5. Trigger AuthProvider.retryStartup() → NavigationGuard sees
 *      authenticated_ready and routes to (main)
 *
 * Show a polished "You're ready" transition while the above happens.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/lib/store';
import {
  updateMyProfile,
  updateMySettings,
  updateOnboardingProgress,
} from '@/services/profile/profile.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { analytics } from '@/lib/auth/analyticsHooks';

export default function OnboardingCompleteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile, retryStartup } = useAuthContext();
  const { activeMode, setHasOnboarded } = useAppStore();

  const [isCompleting, setIsCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === 'web' ? 80 : insets.top + spacing[8];
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + spacing[6];

  // ── Entrance animation ────────────────────────────────────────────────────

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  // ── Mark complete ─────────────────────────────────────────────────────────

  const completeOnboarding = useCallback(async () => {
    if (isCompleting || !user) return;
    setIsCompleting(true);
    setError(null);

    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        await Promise.all([
          updateMyProfile(user.id, {
            onboarding_status: 'completed',
            onboarding_completed_at: now,
          }),
          updateMySettings(user.id, {
            last_game_mode: activeMode as any,
          }),
          updateOnboardingProgress(user.id, {
            step: 'complete',
          }),
        ]);
      } catch (err) {
        if (__DEV__) console.warn('[Complete] DB write failed:', err);
        setError('Having trouble connecting. Tap below to try again.');
        setIsCompleting(false);
        return;
      }
    }

    // Sync local state
    setHasOnboarded(true);

    // Re-run startup state machine — will now see onboarding_status = 'completed'
    // and transition to authenticated_ready → NavigationGuard routes to (main)
    await refreshProfile();
    retryStartup();

    analytics.onboardingCompleted(user.id, activeMode);
    setCompleted(true);
    setIsCompleting(false);
  }, [isCompleting, user, activeMode, setHasOnboarded, refreshProfile, retryStartup]);

  return (
    <View
      style={[styles.root, {
        backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad,
      }]}
    >
      <Animated.View style={[styles.center, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        {/* Success icon */}
        <View style={[styles.iconRing, { borderColor: colors.accent + '30' }]}>
          <View style={[styles.iconInner, { backgroundColor: colors.accent + '15', borderRadius: radius.full }]}>
            <Feather name="globe" size={48} color={colors.accent} />
          </View>
        </View>

        <Text style={[styles.headline, { color: colors.foreground }]}>
          You're ready to enter Worlds.
        </Text>

        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Complete quests, join hunts, and explore your city in ways you never have before.
        </Text>

        {/* Badges */}
        <View style={styles.badges}>
          {[
            { icon: 'compass' as const, label: 'Quests await', color: '#F97316' },
            { icon: 'map-pin' as const, label: 'Hunts ready', color: '#059669' },
          ].map((b) => (
            <View key={b.label} style={[styles.badge, { backgroundColor: b.color + '12', borderRadius: radius.md }]}>
              <Feather name={b.icon} size={16} color={b.color} />
              <Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '12', borderRadius: radius.md }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      <Button
        variant="primary"
        size="lg"
        onPress={completeOnboarding}
        loading={isCompleting}
        disabled={isCompleting}
      >
        {completed ? 'Entering Worlds…' : `Enter Worlds`}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing[6], justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[6] },
  iconRing: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  iconInner: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  headline: {
    fontFamily: fontFamily.bold, fontSize: fontSize['2xl'],
    textAlign: 'center', letterSpacing: -0.5, lineHeight: fontSize['2xl'] * 1.2,
  },
  body: {
    fontFamily: fontFamily.regular, fontSize: fontSize.base,
    textAlign: 'center', lineHeight: fontSize.base * 1.6,
    maxWidth: 300,
  },
  badges: { flexDirection: 'row', gap: spacing[3] },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  badgeText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  errorBanner: { padding: spacing[4], marginBottom: spacing[3] },
  errorText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },
});
