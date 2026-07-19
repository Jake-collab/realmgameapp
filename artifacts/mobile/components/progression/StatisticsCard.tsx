/**
 * StatisticsCard — Cross-mode aggregate stats display.
 * All values server-computed — never derived client-side.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { CombinedStatistics } from '@/features/progression/types/progression.types';

const QUEST_COLOR  = '#F97316';
const HUNT_COLOR   = '#059669';
const WORLDS_COLOR = '#7C3AED';

interface StatRowProps {
  label: string;
  value: string | number;
  color?: string;
}

function StatRow({ label, value, color }: StatRowProps) {
  const colors = useColors();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color ?? colors.foreground }]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
    </View>
  );
}

interface Props {
  stats: CombinedStatistics;
}

export default function StatisticsCard({ stats }: Props) {
  const colors = useColors();

  function accountAgeLabel(days: number): string {
    if (days < 1)   return 'Today';
    if (days === 1) return '1 day';
    if (days < 30)  return `${days} days`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 month';
    if (months < 12) return `${months} months`;
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year' : `${years} years`;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Activities */}
      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Activities</Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <StatRow label="Total Activities"  value={stats.totalActivities} />
      <StatRow label="Quests Completed"  value={stats.questsCompleted} color={QUEST_COLOR} />
      <StatRow label="Hunts Completed"   value={stats.huntsCompleted}  color={HUNT_COLOR} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Points */}
      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Points</Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <StatRow label="Combined Points"   value={stats.combinedPoints}  color={WORLDS_COLOR} />
      <StatRow label="Quest Points"      value={stats.questPoints}     color={QUEST_COLOR} />
      <StatRow label="Hunt Points"       value={stats.huntPoints}      color={HUNT_COLOR} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Recognition */}
      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Recognition</Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <StatRow label="Achievements"  value={stats.achievementsUnlocked} color={WORLDS_COLOR} />
      <StatRow label="Titles"        value={stats.titlesUnlocked} />
      <StatRow label="Badges"        value={stats.badgesUnlocked} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <StatRow label="Member For" value={accountAgeLabel(stats.accountAgeDays)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4], gap: spacing[2],
  },
  sectionLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, marginTop: spacing[1] },
  divider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[1] },
  statLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  statValue: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
