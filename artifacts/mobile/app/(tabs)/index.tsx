/**
 * Worlds — Game Selector screen.
 *
 * The top-level experience. Displays all available game modes and
 * allows the user to enter one. Modes are locked until implemented
 * in their respective build steps.
 *
 * Visual direction: immersive, adventure-oriented, blue-and-green palette.
 * "Worlds" brand is displayed prominently here (not on gameplay screens).
 *
 * Navigation:
 *   → Quest navigator (Build 4)
 *   → Hunt navigator  (Build 6)
 */

import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { GAME_MODES } from '@/types/game.types';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';

export default function GameSelectorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 90;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + spacing[6], paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand header */}
      <View style={styles.brand}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Feather name="globe" size={22} color="#FFFFFF" />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          Worlds
        </Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          Real-world adventures, right outside your door
        </Text>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Section label */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        Choose your game mode
      </Text>

      {/* Game mode cards */}
      <View style={styles.modes}>
        {GAME_MODES.map((mode) => (
          <GameModeCard key={mode.id} mode={mode} />
        ))}
      </View>

      {/* Coming soon footer */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <Feather name="zap" size={14} color={colors.accent} />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          More game modes launching soon
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Game Mode Card ───────────────────────────────────────────────────────────

interface GameModeCardProps {
  mode: (typeof GAME_MODES)[number];
}

function GameModeCard({ mode }: GameModeCardProps) {
  const colors = useColors();

  return (
    <Pressable
      disabled={!mode.available}
      accessibilityLabel={`${mode.title} — ${mode.tagline}`}
      accessibilityHint={mode.available ? 'Double-tap to enter' : 'Coming soon'}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: mode.available ? mode.color + '30' : colors.border,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          ...shadows.md,
        },
      ]}
    >
      {/* Left accent stripe */}
      <View style={[styles.accentStripe, { backgroundColor: mode.color }]} />

      <View style={styles.cardBody}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: mode.color + '15',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: mode.color + '25',
            },
          ]}
        >
          <Feather
            name={mode.icon as React.ComponentProps<typeof Feather>['name']}
            size={26}
            color={mode.color}
          />
        </View>

        {/* Text content */}
        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.modeName, { color: colors.foreground }]}>
              {mode.title}
            </Text>
            {!mode.available && (
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: colors.muted, borderRadius: radius.full },
                ]}
              >
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                  Coming soon
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.modeTagline, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {mode.tagline}
          </Text>
        </View>

        {/* Chevron */}
        <Feather
          name="chevron-right"
          size={18}
          color={mode.available ? colors.primary : colors.border}
        />
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[5],
  },

  // Brand header
  brand: {
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[4],
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: -0.5,
  },
  appTagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 260,
  },

  divider: {
    height: 1,
    marginHorizontal: -spacing[5],
  },

  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Cards
  modes: {
    gap: spacing[3],
  },
  card: {
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentStripe: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  iconContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: spacing[1],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  modeName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
  },
  statusPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  modeTagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  footerText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
