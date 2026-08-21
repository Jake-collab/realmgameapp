/**
 * PublicStatisticsSummary — shows visible public stats on a profile.
 * Only renders when showStatistics=true on the profile.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { PublicProfile } from '@/features/social/types/social.types';

interface StatItem { label: string; value: string | number; icon: string }

interface PublicStatisticsSummaryProps {
  profile: PublicProfile;
  questsCompleted?: number;
  huntsCompleted?: number;
  combinedPoints?: number;
}

export function PublicStatisticsSummary({
  profile,
  questsCompleted,
  huntsCompleted,
  combinedPoints,
}: PublicStatisticsSummaryProps) {
  const colors = useColors();
  if (!profile.showStatistics) return null;

  const stats: StatItem[] = [
    ...(questsCompleted !== undefined ? [{ label: 'Quests', value: questsCompleted, icon: 'compass' }] : []),
    ...(huntsCompleted !== undefined  ? [{ label: 'Hunts',  value: huntsCompleted,  icon: 'map-pin' }] : []),
    ...(combinedPoints !== undefined  ? [{ label: 'Points', value: combinedPoints.toLocaleString(), icon: 'star' }] : []),
  ];

  if (stats.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Statistics</Text>
      <View style={styles.grid}>
        {stats.map(s => (
          <View key={s.label} style={[styles.stat, { backgroundColor: colors.muted }]}>
            <Feather name={s.icon as any} size={14} color={colors.mutedForeground} />
            <Text style={[styles.value, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  sectionLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  grid: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  stat: {
    flex: 1, minWidth: 80, alignItems: 'center', gap: 2,
    padding: spacing[3], borderRadius: radius.lg,
  },
  value: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
