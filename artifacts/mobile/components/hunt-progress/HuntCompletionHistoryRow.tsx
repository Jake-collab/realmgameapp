/**
 * HuntCompletionHistoryRow — A completed Hunt in the Completed section.
 * Shows confirmed awarded points. Taps to completion detail screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { CompletedHuntItem } from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

interface Props {
  item: CompletedHuntItem;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HuntCompletionHistoryRow({ item }: Props) {
  const colors = useColors();

  function handlePress() {
    router.push(`/hunt-completion-detail/${item.participationId}`);
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.huntTitle} — completed ${formatDate(item.completedAt)}${item.awardedPoints != null ? `, ${item.awardedPoints.toLocaleString()} points` : ''}`}
    >
      {/* Icon */}
      <View style={[styles.iconBox, { backgroundColor: HUNT_COLOR + '18' }]}>
        <Feather name="flag" size={20} color={HUNT_COLOR} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {item.huntTitle}
        </Text>

        <View style={styles.metaRow}>
          {/* Group badge */}
          {item.isGroup && (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={10} color={colors.mutedForeground} />
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Group</Text>
            </View>
          )}
          {/* Ordering */}
          {item.stopOrdering && (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {item.stopOrdering === 'ordered' ? 'Ordered' : 'Free roam'}
            </Text>
          )}
          {/* Stops */}
          {item.stopsRequired > 0 && (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {item.stopsCompleted}/{item.stopsRequired} stops
            </Text>
          )}
        </View>

        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {item.occurrenceLabel ?? formatDate(item.completedAt)}
        </Text>
      </View>

      {/* Points + chevron */}
      <View style={styles.right}>
        {item.awardedPoints != null && (
          <View style={styles.pointsBlock}>
            <Text style={[styles.pointsValue, { color: HUNT_COLOR }]}>
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
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing[1] },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.35 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full,
  },
  badgeText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  right: { alignItems: 'flex-end', gap: spacing[1] },
  pointsBlock: { alignItems: 'flex-end' },
  pointsValue: { fontFamily: fontFamily.bold, fontSize: fontSize.sm },
  pointsLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
