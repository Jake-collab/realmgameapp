/**
 * Onboarding — Location step
 *
 * Explains WHY location access is useful before requesting the permission.
 * Per the spec: never request location on the splash screen or without explanation.
 * Skippable — location can be enabled later from Settings.
 *
 * Actual expo-location permission request implemented in Build 5 (Mapbox).
 */

import React from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

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
    body: 'Location is only used while the app is active. Never shared without consent.',
  },
];

export default function OnboardingLocationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 60 : insets.top + spacing[6];
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + spacing[6];

  function handleAllow() {
    // TODO (Build 5): Call expo-location requestForegroundPermissionsAsync() here
    // For now, show an informational alert
    Alert.alert(
      'Location permission',
      'Full location access will be requested when the map feature launches in Build 5.',
      [{ text: 'OK', onPress: () => router.push('/(onboarding)/starting-mode') }]
    );
  }

  function handleSkip() {
    router.push('/(onboarding)/starting-mode');
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      {/* Icon */}
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

      {/* Benefits */}
      <View style={styles.benefits}>
        {LOCATION_BENEFITS.map((b) => (
          <View
            key={b.title}
            style={[styles.benefit, { borderBottomColor: colors.border }]}
          >
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: colors.primary + '10', borderRadius: radius.md },
              ]}
            >
              <Feather name={b.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.benefitText}>
              <Text style={[styles.benefitTitle, { color: colors.foreground }]}>
                {b.title}
              </Text>
              <Text style={[styles.benefitBody, { color: colors.mutedForeground }]}>
                {b.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button variant="primary" size="lg" onPress={handleAllow}>
          Allow location access
        </Button>
        <Button variant="ghost" size="md" onPress={handleSkip}>
          Skip for now
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  benefitIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, gap: spacing[1] },
  benefitTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  benefitBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  actions: { gap: spacing[3] },
});
