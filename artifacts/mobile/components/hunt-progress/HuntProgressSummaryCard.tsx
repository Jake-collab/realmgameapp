/**
 * HuntProgressSummaryCard — Compact personal Hunt stats shown at top of progress screen.
 * Shows total hunt points, hunts completed, active hunts.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntProgressSummary } from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

interface Props {
  summary: HuntProgressSummary | null | undefined;
  isLoading?: boolean;
}

export default function HuntProgressSummaryCard({ summary, isLoading }: Props) {
  const colors = useColors();

  if (isLoading || !summary) return null;

  const stats: Array<{ label: string; value: string | number; urgent?: boolean }> = [
    { label: 'Hunt Points', value: summary.totalHuntPoints.toLocaleString() },
    { label: 'Completed',   value: summary.huntsCompleted },
    ...(summary.activeHunts > 0 ? [{ label: 'Active', value: summary.activeHunts }] : []),
    ...(summary.stopsNeedingResubmission > 0 ? [{ label: 'Resubmit', value: summary.stopsNeedingResubmission, urgent: true }] : []),
    ...(summary.proofUnderReview > 0 ? [{ label: 'Reviewing', value: summary.proofUnderReview }] : []),
  ];

  return (
    <View style={[styles.card, { backgroundColor: HUNT_COLOR + '10', borderColor: HUNT_COLOR + '25' }]}>
      <View style={styles.stats}>
        {stats.map((s, i) => (
          <View key={i} style={styles.stat}>
            <Text style={[styles.value, { color: s.urgent ? colors.destructive : colors.foreground }]}>
              {s.value}
            </Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl, borderWidth: 1,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  stats: {
    flexDirection: 'row', gap: spacing[4], flexWrap: 'wrap',
  },
  stat: { alignItems: 'center', minWidth: 60 },
  value: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: 1 },
});
