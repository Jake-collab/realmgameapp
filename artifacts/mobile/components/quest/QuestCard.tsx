/**
 * QuestCard
 *
 * Displays a quest in a list context (Daily, Monthly, or Geo-Quest).
 * Supports compact (list) and expanded (active quest on Home) presentations.
 *
 * Full implementation in Build 4 — Quest Core.
 * This file stubs the props contract and visual shell so the design system
 * is defined before feature work begins.
 *
 * Usage (compact):
 *   <QuestCard quest={quest} variant="compact" onPress={openDetail} />
 *
 * Usage (expanded — Home screen active quest):
 *   <QuestCard quest={quest} variant="expanded" onPress={continueQuest} />
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import PointsBadge from '@/components/ui/PointsBadge';
import type { Difficulty } from '@/types/game.types';

// ─── Data shape ───────────────────────────────────────────────────────────────

export interface QuestCardData {
  id: string;
  title: string;
  type: 'daily' | 'monthly' | 'geo';
  difficulty: Difficulty;
  points: number;
  status: 'available' | 'active' | 'completed' | 'locked';
  /** For geo quests: human-readable location name */
  locationName?: string;
  /** For geo quests: distance in meters (formatted externally) */
  distanceMeters?: number;
  /** Progress through a multi-step quest (0–1) */
  progress?: number;
  /** Current objective text — shown in expanded variant */
  currentObjective?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  quest: QuestCardData;
  variant?: 'compact' | 'expanded';
  onPress?: () => void;
}

export default function QuestCard({ quest, variant = 'compact', onPress }: Props) {
  const colors = useColors();

  const typeColor =
    quest.type === 'daily'
      ? colors.quest
      : quest.type === 'monthly'
        ? colors.primary
        : colors.accent;

  const typeLabel =
    quest.type === 'daily'
      ? 'Daily'
      : quest.type === 'monthly'
        ? 'Monthly'
        : 'Geo-Quest';

  if (variant === 'expanded') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={`${quest.title} — ${typeLabel}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.expanded,
          {
            backgroundColor: colors.card,
            borderColor: typeColor + '30',
            borderRadius: radius.xl,
            opacity: pressed ? 0.92 : 1,
            ...shadows.md,
          },
        ]}
      >
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '15' }]}>
          <Feather name="compass" size={12} color={typeColor} />
          <Text style={[styles.typeLabel, { color: typeColor }]}>{typeLabel}</Text>
        </View>

        <Text style={[styles.expandedTitle, { color: colors.foreground }]}>
          {quest.title}
        </Text>

        {quest.currentObjective && (
          <Text style={[styles.objective, { color: colors.mutedForeground }]}>
            {quest.currentObjective}
          </Text>
        )}

        <View style={styles.expandedFooter}>
          <PointsBadge value={quest.points} color={typeColor} />
          <View style={[styles.actionPill, { backgroundColor: typeColor }]}>
            <Text style={styles.actionText}>
              {quest.status === 'active' ? 'Continue' : 'Start Quest'}
            </Text>
            <Feather name="arrow-right" size={14} color="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  // Compact variant
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${quest.title} — ${typeLabel}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.compact,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.9 : 1,
          ...shadows.sm,
        },
      ]}
    >
      {/* Left color stripe */}
      <View style={[styles.stripe, { backgroundColor: typeColor }]} />

      <View style={styles.compactBody}>
        <View style={styles.compactTop}>
          <Text style={[styles.compactTitle, { color: colors.foreground }]} numberOfLines={1}>
            {quest.title}
          </Text>
          <PointsBadge value={quest.points} size="sm" color={typeColor} />
        </View>

        <View style={styles.compactMeta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {typeLabel}
          </Text>
          {quest.locationName && (
            <>
              <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {quest.locationName}
              </Text>
            </>
          )}
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={colors.border} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Expanded
  expanded: {
    padding: spacing[5],
    gap: spacing[3],
    borderWidth: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  typeLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
  expandedTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  objective: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.5,
  },
  expandedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  actionText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#FFFFFF',
  },

  // Compact
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  compactBody: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
  },
  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  compactTitle: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  metaDot: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
