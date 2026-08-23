/**
 * SocialSkeleton — loading placeholders for social screens.
 */
import React from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { radius, spacing } from '@/constants/spacing';

function SkeletonBox({ w, h, r }: { w?: DimensionValue; h: number; r?: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        { width: w ?? '100%', height: h, borderRadius: r ?? 8, backgroundColor: colors.muted },
      ]}
    />
  );
}

export function SocialSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SocialCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function SocialCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBox w={44} h={44} r={22} />
      <View style={styles.lines}>
        <SkeletonBox w="60%" h={14} r={7} />
        <SkeletonBox w="40%" h={12} r={6} />
      </View>
    </View>
  );
}

export function PublicProfileSkeleton() {
  return (
    <View style={styles.profileContainer}>
      <SkeletonBox w={64} h={64} r={32} />
      <SkeletonBox w="50%" h={18} r={9} />
      <SkeletonBox w="35%" h={14} r={7} />
      <SkeletonBox w="100%" h={44} r={12} />
      <SkeletonBox w="100%" h={100} r={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl,
  },
  lines: { flex: 1, gap: spacing[2] },
  profileContainer: { alignItems: 'center', gap: spacing[3], padding: spacing[5] },
});
