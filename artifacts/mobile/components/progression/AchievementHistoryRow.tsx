/**
 * AchievementHistoryRow — Compact row for the Achievement History list.
 * Taps to Achievement Detail screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import AchievementIcon from './AchievementIcon';
import type { AchievementHistoryRow as AchievementHistoryRowType } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

interface Props {
  item: AchievementHistoryRowType;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AchievementHistoryRow({ item }: Props) {
  const colors = useColors();

  function handlePress() {
    router.push(`/achievement-detail/${item.achievementId}`);
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}: ${item.description}. Awarded ${formatDate(item.awardedAt)}`}
    >
      <AchievementIcon iconName={item.iconName} isHidden={item.isHidden} isUnlocked size="sm" />

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color: WORLDS_PURPLE }]}>
            {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
          </Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(item.awardedAt)}
          </Text>
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  category: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
