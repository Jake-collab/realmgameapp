/**
 * Onboarding — Welcome step
 *
 * First screen after a user creates their account.
 * Personalized greeting; brief orientation to Worlds.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

export default function OnboardingWelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();

  const firstName = user?.email?.split('@')[0] ?? 'Explorer';
  const topPad = Platform.OS === 'web' ? 80 : insets.top + spacing[8];
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + spacing[6];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Decorative */}
      <View style={[styles.accent, { backgroundColor: colors.accent + '08' }]} />

      <View style={[styles.content, { paddingTop: topPad }]}>
        {/* Logo */}
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Feather name="globe" size={32} color="#fff" />
        </View>

        {/* Greeting */}
        <View style={styles.text}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Welcome to Worlds
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            Hey, {firstName}!
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            You're about to join a platform built for real-world adventures.
            Complete quests, compete in hunts, and explore your city in a whole new way.
          </Text>
        </View>

        {/* Highlights */}
        <View style={styles.highlights}>
          {HIGHLIGHTS.map((h) => (
            <View
              key={h.text}
              style={[
                styles.highlight,
                {
                  backgroundColor: h.color + '10',
                  borderColor: h.color + '20',
                  borderRadius: radius.md,
                },
              ]}
            >
              <Feather name={h.icon} size={18} color={h.color} />
              <Text style={[styles.highlightText, { color: colors.foreground }]}>
                {h.text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.push('/(onboarding)/interests')}
        >
          Let's set you up
        </Button>
      </View>
    </View>
  );
}

const HIGHLIGHTS = [
  { icon: 'compass' as const, text: 'Daily, monthly & geo quests', color: '#F97316' },
  { icon: 'map-pin' as const, text: 'Live scavenger hunts on a real map', color: '#059669' },
  { icon: 'award' as const, text: 'Leaderboards, XP & achievements', color: '#1D4ED8' },
];

const styles = StyleSheet.create({
  root: { flex: 1 },
  accent: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    gap: spacing[6],
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { gap: spacing[3] },
  greeting: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'], letterSpacing: -0.5 },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.55 },
  highlights: { gap: spacing[3] },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
  },
  highlightText: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  footer: { paddingHorizontal: spacing[5] },
});
