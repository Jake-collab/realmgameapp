/**
 * HuntLeaderboardPeriodSelector — Period toggle for Hunt leaderboard.
 * Periods: This Week | This Month | All Time (Monday UTC / 1st UTC boundaries).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { LeaderboardPeriod } from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'week',     label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'all_time', label: 'All Time' },
];

interface Props {
  period: LeaderboardPeriod;
  onSelect: (period: LeaderboardPeriod) => void;
}

export default function HuntLeaderboardPeriodSelector({ period, onSelect }: Props) {
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
                backgroundColor: isActive ? HUNT_COLOR : colors.muted,
                borderColor: isActive ? HUNT_COLOR : colors.border,
              },
            ]}
            onPress={() => onSelect(p.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={p.label}
          >
            <Text style={[styles.label, { color: isActive ? '#fff' : colors.mutedForeground }]}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
