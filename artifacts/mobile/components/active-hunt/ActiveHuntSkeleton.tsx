/**
 * ActiveHuntSkeleton — Worlds (Prompt 13)
 *
 * Layout-specific loading skeleton for the Active Hunt screen.
 * Matches the shape of the full screen to avoid layout shift.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { radius, spacing } from '@/constants/spacing';

function SkeletonBlock({ height, width = '100%', style }: {
  height: number;
  width?: number | string;
  style?: any;
}) {
  const colors = useColors();
  return (
    <View style={[
      styles.block,
      { height, width: width as any, backgroundColor: colors.border },
      style,
    ]} />
  );
}

export function ActiveHuntSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header skeleton */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <SkeletonBlock height={40} width={40} style={{ borderRadius: radius.full }} />
        <SkeletonBlock height={18} width={160} style={{ borderRadius: radius.sm }} />
        <SkeletonBlock height={40} width={40} style={{ borderRadius: radius.full }} />
      </View>

      <View style={styles.content}>
        {/* Deadline notice placeholder */}
        <SkeletonBlock height={32} style={{ borderRadius: radius.md }} />

        {/* Current clue card */}
        <View style={[styles.clueCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonBlock height={4} style={{ borderRadius: 0 }} />
          <View style={styles.clueCardContent}>
            <SkeletonBlock height={18} width={120} style={{ borderRadius: radius.sm }} />
            <SkeletonBlock height={28} style={{ borderRadius: radius.sm }} />
            <SkeletonBlock height={160} style={{ borderRadius: radius.lg }} />
            <SkeletonBlock height={60} style={{ borderRadius: radius.lg }} />
          </View>
        </View>

        {/* Progress */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonBlock height={14} width={80} style={{ borderRadius: radius.sm }} />
            <SkeletonBlock height={18} width={40} style={{ borderRadius: radius.sm }} />
          </View>
          <SkeletonBlock height={6} style={{ borderRadius: radius.full }} />
        </View>

        {/* Action button */}
        <SkeletonBlock height={52} style={{ borderRadius: radius.xl }} />

        {/* Stop list */}
        {[1, 2].map(i => (
          <View key={i} style={[styles.stopRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SkeletonBlock height={40} width={40} style={{ borderRadius: radius.lg }} />
            <View style={{ flex: 1, gap: spacing[1] }}>
              <SkeletonBlock height={14} width={120} style={{ borderRadius: radius.sm }} />
              <SkeletonBlock height={12} width={80} style={{ borderRadius: radius.sm }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: spacing[4],
    paddingTop:       52,
    paddingBottom:    spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:              spacing[3],
  },
  content: {
    padding: spacing[4],
    gap:     spacing[4],
  },
  clueCard: {
    borderRadius: radius.xl,
    borderWidth:  1,
    overflow:     'hidden',
  },
  clueCardContent: {
    padding: spacing[5],
    gap:     spacing[4],
  },
  progressCard: {
    borderRadius: radius.lg,
    borderWidth:  1,
    padding:      spacing[4],
    gap:          spacing[2],
  },
  stopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    borderRadius:  radius.lg,
    borderWidth:   1,
    padding:       spacing[4],
  },
  block: {
    opacity: 0.6,
  },
});
