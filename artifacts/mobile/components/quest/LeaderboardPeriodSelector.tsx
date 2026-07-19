/**
 * LeaderboardPeriodSelector — Time period toggle for the Quest leaderboard.
 *
 * Periods: This Week | This Month | All Time
 * Weeks start Monday UTC. Months start the 1st UTC.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { LeaderboardPeriod } from '@/features/quests/types/questProgress.types';

interface Props {
  period: LeaderboardPeriod;
  onSelect: (period: LeaderboardPeriod) => void;
}

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'week',     label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'all_time', label: 'All Time' },
];

export default function LeaderboardPeriodSelector({ period, onSelect }: Props) {
  const colors = useColors();

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {PERIODS.map(p => {
        const isActive = p.key === period;
        return (
          <Pressable
            key={p.key}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? colors.primary : colors.muted,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onSelect(p.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={p.label}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? '#fff' : colors.mutedForeground },
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
