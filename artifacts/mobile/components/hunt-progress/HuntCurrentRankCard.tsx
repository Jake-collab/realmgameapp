/**
 * HuntCurrentRankCard — Pinned current-user Hunt rank summary.
 *
 * Shows rank even when outside the loaded page.
 * Hidden users see personal points but no public rank.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntCurrentRank } from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

interface Props {
  rank: HuntCurrentRank | null | undefined;
  isLoading?: boolean;
}

export default function HuntCurrentRankCard({ rank, isLoading }: Props) {
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: HUNT_COLOR + '12', borderColor: HUNT_COLOR + '30' }]}>
        <View style={[styles.skeleton, { backgroundColor: colors.muted, width: 80, height: 14 }]} />
        <View style={[styles.skeleton, { backgroundColor: colors.muted, width: 120, height: 28, marginTop: 4 }]} />
      </View>
    );
  }

  if (!rank || !rank.qualifies) {
    return (
      <View style={[styles.card, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="map" size={18} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Complete a Hunt to enter this leaderboard.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { backgroundColor: HUNT_COLOR + '12', borderColor: HUNT_COLOR + '30' }]}
      accessible
      accessibilityLabel={
        rank.rank != null
          ? `Your Hunt rank: #${rank.rank} with ${rank.points.toLocaleString()} Hunt points`
          : `Your Hunt points: ${rank.points.toLocaleString()}. You are not in the public ranking.`
      }
    >
      <View style={styles.row}>
        <View style={styles.leftBlock}>
          <Text style={[styles.label, { color: HUNT_COLOR }]}>Your Rank</Text>
          {rank.rank != null ? (
            <Text style={[styles.rankValue, { color: colors.foreground }]}>#{rank.rank}</Text>
          ) : (
            <Text style={[styles.hiddenNote, { color: colors.mutedForeground }]}>Rankings private</Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.rightBlock}>
          <Text style={[styles.label, { color: HUNT_COLOR }]}>Hunt Points</Text>
          <Text style={[styles.pointsValue, { color: colors.foreground }]}>
            {rank.points.toLocaleString()}
          </Text>
        </View>

        {rank.totalRankedUsers > 0 && rank.rank != null && (
          <>
            <View style={styles.divider} />
            <View style={styles.rightBlock}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Ranked</Text>
              <Text style={[styles.totalText, { color: colors.mutedForeground }]}>
                of {rank.totalRankedUsers.toLocaleString()}
              </Text>
            </View>
          </>
        )}
      </View>

      {rank.rank == null && rank.points > 0 && (
        <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
          {rank.noRankReason ?? 'Leaderboard visibility is set to private.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing[4], gap: spacing[2],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  leftBlock: { gap: 2, flex: 1 },
  rightBlock: { gap: 2, alignItems: 'flex-end' },
  label: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  rankValue: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'] },
  pointsValue: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  totalText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  hiddenNote: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, fontStyle: 'italic' },
  divider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: '#00000020' },
  emptyText: {
    fontFamily: fontFamily.regular, fontSize: fontSize.sm,
    textAlign: 'center', lineHeight: fontSize.sm * 1.5,
  },
  skeleton: { borderRadius: radius.sm },
  privacyNote: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, fontStyle: 'italic' },
});
