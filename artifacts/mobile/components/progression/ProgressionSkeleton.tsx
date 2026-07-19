/**
 * ProgressionSkeleton — Layout-matching skeleton loaders for Progression sections.
 *
 * Exports: AchievementsSkeleton, TitlesSkeleton, BadgesSkeleton,
 *          StatisticsSkeleton, ProgressOverviewSkeleton, HistorySkeleton
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { radius, spacing } from '@/constants/spacing';

function Box({ width = '100%' as string | number, height = 16, br = 8 }) {
  const colors = useColors();
  return (
    <View
      style={{ width: width as any, height, borderRadius: br, backgroundColor: colors.muted }}
      accessibilityElementsHidden
    />
  );
}

export function ProgressOverviewSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.muted }]}>
      <Box width="30%" height={12} />
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        {[0,1,2].map(i => (
          <View key={i} style={{ flex: 1, gap: 4, alignItems: 'center' }}>
            <Box width="50%" height={20} />
            <Box width="80%" height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function AchievementsSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[3] }}>
      {[0,1,2,3].map(i => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, flexDirection: 'row', gap: spacing[3] }]}>
          <Box width={48} height={48} br={radius.lg} />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Box width="60%" height={14} />
            <Box width="40%" height={11} />
            <Box width="80%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function HistorySkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[3] }}>
      {[0,1,2,3,4,5].map(i => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, flexDirection: 'row', gap: spacing[3] }]}>
          <Box width={36} height={36} br={radius.md} />
          <View style={{ flex: 1, gap: 6 }}>
            <Box width="55%" height={13} />
            <Box width="35%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TitlesSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[3] }}>
      {[0,1,2].map(i => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, flexDirection: 'row', gap: spacing[3], alignItems: 'center' }]}>
          <Box width={36} height={36} br={radius.md} />
          <View style={{ flex: 1, gap: 6 }}>
            <Box width="45%" height={14} />
            <Box width="70%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function BadgesSkeleton() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
      {[0,1,2,3,4].map(i => (
        <View key={i} style={{ width: 80, alignItems: 'center', gap: spacing[1] }}>
          <Box width={40} height={40} br={radius.lg} />
          <Box width={60} height={10} />
        </View>
      ))}
    </View>
  );
}

export function StatisticsSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, gap: spacing[3] }]}>
      {[0,1,2,3,4,5,6,7].map(i => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Box width="45%" height={12} />
          <Box width="20%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing[4], borderRadius: radius.xl },
});
