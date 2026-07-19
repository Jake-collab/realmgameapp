/**
 * ProgressSkeleton — Layout-matching skeleton loaders for Progress sections.
 *
 * Exports:
 *   LeaderboardSkeleton, InActionSkeleton, CompletedSkeleton,
 *   CompletionDetailSkeleton, PointHistorySkeleton
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { radius, spacing } from '@/constants/spacing';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

function Box({ width = '100%', height = 16, borderRadius = 8 }: SkeletonBoxProps) {
  const colors = useColors();
  return (
    <View
      style={{
        width: width as any,
        height,
        borderRadius,
        backgroundColor: colors.muted,
      }}
      accessibilityElementsHidden
    />
  );
}

function CardSkeleton() {
  return (
    <View style={{ gap: 10, padding: spacing[4] }}>
      <Box width="40%" height={12} />
      <Box width="85%" height={18} />
      <Box width="60%" height={12} />
    </View>
  );
}

export function LeaderboardSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[3] }}>
      {/* Rank card skeleton */}
      <View style={[skStyles.card, { backgroundColor: colors.muted }]}>
        <Box width="30%" height={12} />
        <Box width="20%" height={28} />
      </View>
      {/* Leaderboard rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[2] }}>
          <Box width={36} height={14} borderRadius={4} />
          <Box width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1, gap: 6 }}>
            <Box width="60%" height={13} />
            <Box width="40%" height={11} />
          </View>
          <Box width={40} height={14} />
        </View>
      ))}
    </View>
  );
}

export function InActionSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[4] }}>
      {/* Summary header */}
      <View style={[skStyles.card, { backgroundColor: colors.muted, gap: spacing[2] }]}>
        <Box width="50%" height={12} />
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <Box width={60} height={24} />
          <Box width={60} height={24} />
          <Box width={60} height={24} />
        </View>
      </View>
      {/* Cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={[skStyles.card, { backgroundColor: colors.card }]}>
          <CardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function CompletedSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[3] }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={[
            skStyles.card,
            { backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
          ]}
        >
          <Box width={40} height={40} borderRadius={radius.lg} />
          <View style={{ flex: 1, gap: 6 }}>
            <Box width="70%" height={13} />
            <Box width="45%" height={11} />
            <Box width="30%" height={10} />
          </View>
          <Box width={36} height={16} />
        </View>
      ))}
    </View>
  );
}

export function CompletionDetailSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[5], padding: spacing[5] }}>
      <Box width="80%" height={22} />
      <View style={[skStyles.card, { backgroundColor: colors.card, gap: spacing[3] }]}>
        <Box width="40%" height={12} />
        <Box width="20%" height={32} />
        <Box width="30%" height={12} />
      </View>
      <View style={{ gap: spacing[2] }}>
        <Box width="30%" height={12} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}>
            <Box width={24} height={24} borderRadius={12} />
            <Box width="70%" height={13} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function PointHistorySkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: spacing[1] }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] }}>
          <Box width={38} height={38} borderRadius={radius.lg} />
          <View style={{ flex: 1, gap: 5 }}>
            <Box width="65%" height={13} />
            <Box width="40%" height={10} />
          </View>
          <Box width={44} height={16} />
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    padding: spacing[4],
    borderRadius: radius.xl,
  },
});
