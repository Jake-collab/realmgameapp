/**
 * Onboarding — Location step
 *
 * Explains WHY location access is useful before requesting the native
 * permission. Only requests permission after the user explicitly taps
 * "Enable Location". The OS permission dialog appears once.
 *
 * Rules:
 *   - Never request background-location permission
 *   - Never request precise continuous location history
 *   - Do not repeatedly prompt users who have denied permission
 *   - Store onboarding choice; treat OS permission state as source of truth
 *
 * Permission status map:
 *   granted    → save location_sharing_enabled = true, continue
 *   denied     → save location_sharing_enabled = false, continue (non-blocking)
 *   restricted → inform user, continue
 *   blocked    → direct user to Settings, continue
 *   unavailable→ skip silently, continue
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { updateMySettings, updateOnboardingProgress } from '@/services/profile/profile.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { analytics } from '@/lib/auth/analyticsHooks';

const LOCATION_BENEFITS = [
  {
    icon: 'map-pin' as const,
    title: 'Find nearby quests & hunts',
    body: 'Discover adventures happening right around you.',
  },
  {
    icon: 'navigation' as const,
    title: 'Real-time distance tracking',
    body: 'Know how far you are from your next objective.',
  },
  {
    icon: 'shield' as const,
    title: 'Your privacy matters',
    body: 'Location is only used while the app is open. Never tracked in the background.',
  },
];

export default function OnboardingLocationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();
  const [isRequesting, setIsRequesting] = useState(false);

  const topPad = Platform.OS === 'web' ? 60 : insets.top + spacing[6];
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + spacing[6];

  // ── Save choice and continue ──────────────────────────────────────────────

  const saveAndContinue = useCallback(
    async (granted: boolean) => {
      if (user && isSupabaseConfigured()) {
        try {
          await Promise.all([
            updateMySettings(user.id, {
              location_sharing_enabled: granted,
            }),
            updateOnboardingProgress(user.id, {
              location_explanation_shown: true,
              location_permission_granted: granted,
            }),
          ]);
        } catch (err) {
          if (__DEV__) console.warn('[Location] Settings save failed:', err);
          // Non-fatal — continue regardless
        }
      }
      router.push('/(onboarding)/starting-mode');
    },
    [user, router]
  );

  // ── Request permission ─────────────────────────────────────────────────────

  const handleAllow = useCallback(async () => {
    setIsRequesting(true);
    try {
      // Check current status first to avoid re-prompting blocked users
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      if (existingStatus === 'granted') {
        analytics.onboardingLocationGranted();
        await saveAndContinue(true);
        return;
      }

      if (existingStatus === 'denied') {
        // iOS: permission was denied — OS won't show dialog again
        // Direct user to Settings
        Alert.alert(
          'Location access blocked',
          "You've previously denied location access. You can enable it in your device Settings.",
          [
            { text: 'Not now', onPress: () => saveAndContinue(false) },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings().catch(() => {});
                saveAndContinue(false);
              },
            },
          ]
        );
        analytics.onboardingLocationDenied();
        return;
      }

      // Request foreground permission — OS shows the system dialog once
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        analytics.onboardingLocationGranted();
        await saveAndContinue(true);
      } else {
        analytics.onboardingLocationDenied();
        await saveAndContinue(false);
      }
    } catch (err) {
      if (__DEV__) console.warn('[Location] Permission request failed:', err);
      await saveAndContinue(false);
    } finally {
      setIsRequesting(false);
    }
  }, [saveAndContinue]);

  const handleSkip = useCallback(async () => {
    analytics.onboardingLocationSkipped();
    await saveAndContinue(false);
  }, [saveAndContinue]);

  return (
    <View
      style={[styles.root, {
        backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad,
      }]}
    >
      {/* Icon + header */}
      <View style={styles.heroSection}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent + '12', borderRadius: radius.xl }]}>
          <Feather name="map" size={40} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 2 of 3</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Worlds is better with location
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Here's how we use it — and why you're in control.
          </Text>
        </View>
      </View>

      {/* Benefits list */}
      <View style={styles.benefits}>
        {LOCATION_BENEFITS.map((b) => (
          <View key={b.title} style={[styles.benefit, { borderBottomColor: colors.border }]}>
            <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '10', borderRadius: radius.md }]}>
              <Feather name={b.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.benefitText}>
              <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{b.title}</Text>
              <Text style={[styles.benefitBody, { color: colors.mutedForeground }]}>{b.body}</Text>
            </View>
          </View>
        ))}

        {/* Privacy note */}
        <View style={[styles.privacyNote, { backgroundColor: colors.muted, borderRadius: radius.md }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            You can change your location settings at any time in the Worlds app or your device Settings.
            Denying permission will limit map and geo-quest features.
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          onPress={handleAllow}
          loading={isRequesting}
          disabled={isRequesting}
        >
          Enable location access
        </Button>
        <Button variant="ghost" size="md" onPress={handleSkip} disabled={isRequesting}>
          Not now
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing[5], gap: spacing[6] },
  heroSection: { alignItems: 'flex-start', gap: spacing[4] },
  iconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerText: { gap: spacing[2] },
  step: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  benefits: { flex: 1, gap: spacing[1] },
  benefit: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4],
    paddingVertical: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  benefitIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, gap: spacing[1] },
  benefitTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  benefitBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  privacyNote: { flexDirection: 'row', gap: spacing[2], padding: spacing[3], marginTop: spacing[2] },
  privacyText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.6 },
  actions: { gap: spacing[3] },
});
