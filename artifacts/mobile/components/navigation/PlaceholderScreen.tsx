/**
 * PlaceholderScreen
 *
 * Shared placeholder used by all main-app tab screens that are not yet
 * fully implemented. Displays the screen name, its game mode, and which
 * build step will implement it.
 *
 * This component is intentionally internal — it is only used by route
 * files that need a placeholder. It will be replaced screen-by-screen
 * as each feature is built.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { GameMode } from '@/types/game.types';

interface Props {
  mode: GameMode;
  screen: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  buildStep?: string;
  description?: string;
}

export default function PlaceholderScreen({
  mode,
  screen,
  icon,
  buildStep,
  description,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const modeColor = mode === 'quest' ? colors.quest : colors.hunt;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: modeColor + '12',
            borderColor: modeColor + '25',
            borderRadius: radius.xl,
          },
        ]}
      >
        <Feather name={icon} size={36} color={modeColor} />
      </View>

      {/* Screen name */}
      <Text style={[styles.name, { color: colors.foreground }]}>{screen}</Text>

      {/* Mode tag */}
      <View style={[styles.modePill, { backgroundColor: modeColor + '12', borderRadius: radius.full }]}>
        <Text style={[styles.modePillText, { color: modeColor }]}>
          {mode === 'quest' ? 'Quest' : 'Hunt'}
        </Text>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        {description ?? `The ${screen} screen will be built here.`}
      </Text>

      {/* Build step */}
      {buildStep && (
        <View style={[styles.buildTag, { backgroundColor: colors.muted, borderRadius: radius.md }]}>
          <Feather name="code" size={12} color={colors.mutedForeground} />
          <Text style={[styles.buildText, { color: colors.mutedForeground }]}>
            Implementing in {buildStep}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    padding: spacing[8],
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
  },
  modePill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  modePillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.55,
    maxWidth: 280,
  },
  buildTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginTop: spacing[2],
  },
  buildText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
