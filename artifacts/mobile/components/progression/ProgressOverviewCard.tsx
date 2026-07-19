/**
 * ProgressOverviewCard — Compact header summary for Profile + Achievements hub.
 * Shows active title, pinned badge, achievement count, combined points.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ProgressOverview } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

interface Props {
  overview: ProgressOverview;
  isLoading?: boolean;
}

export default function ProgressOverviewCard({ overview, isLoading }: Props) {
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={[styles.skel, { width: 80, height: 12 }]} />
        <View style={[styles.skel, { width: 140, height: 20 }]} />
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { backgroundColor: WORLDS_PURPLE + '08', borderColor: WORLDS_PURPLE + '25' }]}
      accessible
      accessibilityLabel={[
        overview.activeTitleName ? `Title: ${overview.activeTitleName}` : '',
        `${overview.achievementsCount} achievement${overview.achievementsCount !== 1 ? 's' : ''}`,
        `${overview.combinedPoints.toLocaleString()} combined points`,
        `${overview.totalActivities} activities`,
      ].filter(Boolean).join(', ')}
    >
      {/* Active title */}
      {overview.activeTitleName && (
        <View style={styles.titleRow}>
          <Feather name="tag" size={13} color={WORLDS_PURPLE} />
          <Text style={[styles.titleLabel, { color: WORLDS_PURPLE }]}>
            {overview.activeTitleName}
          </Text>
        </View>
      )}

      {/* Stats strip */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {overview.achievementsCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Achievements</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {overview.combinedPoints.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Points</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {overview.totalActivities}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Activities</Text>
        </View>

        {overview.pinnedBadgeName && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Feather name={overview.pinnedBadgeIcon as any ?? 'shield'} size={18} color={WORLDS_PURPLE} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                {overview.pinnedBadgeName}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing[4], gap: spacing[3],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  titleLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  statLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 32 },
  skel: { borderRadius: 6, backgroundColor: '#0001' },
});
