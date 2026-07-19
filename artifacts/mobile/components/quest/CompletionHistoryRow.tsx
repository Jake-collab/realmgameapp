/**
 * CompletionHistoryRow — A single completed quest in the Completed section.
 * Shows only confirmed awarded points. Tappable to open Completion Detail.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import QuestTypeBadge from './QuestTypeBadge';
import DifficultyBadge from './DifficultyBadge';
import type { CompletedQuestItem } from '@/features/quests/types/questProgress.types';

interface Props {
  item: CompletedQuestItem;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatOccurrence(key: string | null): string | null {
  if (!key) return null;
  if (key.startsWith('daily:')) {
    const parts = key.split(':');
    return parts[2] ? `Daily — ${parts[2]}` : 'Daily';
  }
  if (key.startsWith('monthly:')) {
    const parts = key.split(':');
    return parts[2] ? `Monthly — ${parts[2]}` : 'Monthly';
  }
  return null;
}

export default function CompletionHistoryRow({ item }: Props) {
  const colors = useColors();

  function handlePress() {
    router.push(`/quest-completion-detail/${item.participationId}`);
  }

  const occurrenceLabel = formatOccurrence(item.occurrenceKey);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.quest?.title ?? 'Quest'} — completed ${formatDate(item.completedAt)}${item.awardedPoints != null ? `, ${item.awardedPoints.toLocaleString()} points awarded` : ''}`}
    >
      {/* Left: checkmark */}
      <View style={[styles.iconBox, { backgroundColor: colors.success + '18' }]}>
        <Feather name="check-circle" size={20} color={colors.success} />
      </View>

      {/* Centre: title + meta */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {item.quest?.title ?? 'Quest'}
        </Text>

        <View style={styles.metaRow}>
          {item.quest?.quest_type && (
            <QuestTypeBadge questType={item.quest.quest_type} compact />
          )}
          {item.quest?.difficulty && (
            <DifficultyBadge difficulty={item.quest.difficulty} compact dotsOnly />
          )}
          {occurrenceLabel && (
            <Text style={[styles.occurrence, { color: colors.mutedForeground }]}>
              {occurrenceLabel}
            </Text>
          )}
        </View>

        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(item.completedAt)}
        </Text>
      </View>

      {/* Right: points + chevron */}
      <View style={styles.right}>
        {item.awardedPoints != null && (
          <View style={styles.pointsBlock}>
            <Text style={[styles.pointsValue, { color: colors.primary }]}>
              +{item.awardedPoints.toLocaleString()}
            </Text>
            <Text style={[styles.pointsLabel, { color: colors.mutedForeground }]}>pts</Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.35,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  occurrence: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  pointsBlock: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  pointsLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
