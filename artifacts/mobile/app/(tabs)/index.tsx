/**
 * Home screen — Game Selector.
 *
 * Displays the available game modes (Quest, Hunt) as tappable cards.
 * Modes are locked until implemented in later Build steps.
 *
 * Navigation hierarchy:
 *   Game Selector → Quest (Build 2)
 *   Game Selector → Hunt  (Build 3)
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
        { paddingTop: topPad + spacing[4], paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          Welcome back
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Choose Your Adventure
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Select a game mode to begin
        </Text>
      </View>

      {/* Game Mode Cards */}
      <View style={styles.modes}>
        {GAME_MODES.map((mode) => (
          <GameModeCard key={mode.id} mode={mode} />
        ))}
      </View>

      {/* Coming Soon Banner */}
      <View
        style={[
          styles.comingSoon,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <Feather name="zap" size={16} color={colors.primary} />
        <Text style={[styles.comingSoonText, { color: colors.mutedForeground }]}>
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
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: mode.available ? mode.color + '40' : colors.border,
          opacity: pressed ? 0.9 : 1,
          ...shadows.md,
        },
      ]}
    >
      {/* Color accent bar */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: mode.color, borderRadius: radius.lg },
        ]}
      />

      <View style={styles.cardContent}>
        {/* Icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: mode.color + '20', borderRadius: radius.md },
          ]}
        >
          <Feather
            name={mode.icon as React.ComponentProps<typeof Feather>['name']}
            size={28}
            color={mode.color}
          />
        </View>

        {/* Text */}
        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.modeName, { color: colors.foreground }]}>
              {mode.title}
            </Text>
            {!mode.available && (
              <View
                style={[
                  styles.lockBadge,
                  { backgroundColor: colors.secondary, borderRadius: radius.full },
                ]}
              >
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={[styles.lockText, { color: colors.mutedForeground }]}>
                  Coming Soon
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.modeTagline, { color: colors.mutedForeground }]}>
            {mode.tagline}
          </Text>
        </View>

        <Feather
          name="chevron-right"
          size={20}
          color={mode.available ? colors.foreground : colors.border}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[6],
  },
  header: {
    gap: spacing[1.5],
  },
  greeting: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  modes: {
    gap: spacing[4],
  },
  card: {
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[5],
    paddingLeft: spacing[5] + 4,
    gap: spacing[4],
  },
  iconWrap: {
    width: 56,
    height: 56,
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
  },
  modeName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
  },
  lockText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  modeTagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  comingSoonText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
