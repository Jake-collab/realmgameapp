/**
 * Welcome screen — Worlds
 *
 * Entry point for unauthenticated users.
 * Feels like the entrance to a game platform, not a business app.
 *
 * Layout:
 *   Decorative accents (top-right blue, bottom-left green)
 *   ─────────────────────────
 *   Large globe logo mark
 *   "Worlds" wordmark
 *   Tagline
 *   ─────────────────────────
 *   [Sign Up]   primary
 *   [Log In]    outline
 *   ─────────────────────────
 *   Terms / Privacy micro-text
 */

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 48 : insets.top + spacing[6];
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + spacing[6];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Decorative accents ─────────────────────────────────────── */}
      <View
        style={[
          styles.accentTopRight,
          { backgroundColor: colors.primary + '10' },
        ]}
      />
      <View
        style={[
          styles.accentBottomLeft,
          { backgroundColor: colors.accent + '08' },
        ]}
      />

      {/* ── Hero section ───────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: topPad }]}>
        {/* Logo mark */}
        <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
          <Feather name="globe" size={36} color="#FFFFFF" />
        </View>

        {/* Wordmark */}
        <Text style={[styles.wordmark, { color: colors.foreground }]}>
          Worlds
        </Text>

        {/* Tagline */}
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Explore. Complete quests.{'\n'}Create adventures.
        </Text>
      </View>

      {/* ── Feature hints ──────────────────────────────────────────── */}
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: f.color + '15', borderRadius: radius.sm },
              ]}
            >
              <Feather name={f.icon} size={15} color={f.color} />
            </View>
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
              {f.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── CTA buttons ────────────────────────────────────────────── */}
      <View style={[styles.actions, { paddingBottom: bottomPad }]}>
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.push('/(auth)/signup')}
        >
          Create account
        </Button>

        <Button
          variant="outline"
          size="lg"
          onPress={() => router.push('/(auth)/login')}
        >
          Log in
        </Button>

        {/* Legal micro-text */}
        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          By continuing, you agree to our{' '}
          <Text style={[styles.legalLink, { color: colors.primary }]}>
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text style={[styles.legalLink, { color: colors.primary }]}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </View>
  );
}

const FEATURES = [
  { icon: 'compass' as const, label: 'Daily, monthly & geo quests', color: '#F97316' },
  { icon: 'map-pin' as const, label: 'Live map-based scavenger hunts', color: '#059669' },
  { icon: 'users' as const, label: 'Compete with friends & the world', color: '#1D4ED8' },
];

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Decorative
  accentTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  accentBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    gap: spacing[5],
    flex: 1,
    justifyContent: 'center',
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['4xl'],
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    textAlign: 'center',
    lineHeight: fontSize.lg * 1.5,
  },

  // Feature hints
  features: {
    paddingHorizontal: spacing[8],
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },

  // CTAs
  actions: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  legal: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: fontSize.xs * 1.6,
    paddingHorizontal: spacing[4],
  },
  legalLink: {
    fontFamily: fontFamily.medium,
  },
});
