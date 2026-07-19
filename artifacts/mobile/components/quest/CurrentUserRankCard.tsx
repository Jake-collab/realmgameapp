/**
 * CurrentUserRankCard — Pinned current-user rank summary for the leaderboard.
 *
 * Shows the user's rank even when they are outside the initially loaded entries.
 * Hidden users see their personal points but no public rank.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { QuestCurrentRank } from '@/features/quests/types/questProgress.types';

interface Props {
  rank: QuestCurrentRank | null | undefined;
  isLoading?: boolean;
}

export default function CurrentUserRankCard({ rank, isLoading }: Props) {
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
        <View style={[styles.skeleton, { backgroundColor: colors.muted, width: 80, height: 14 }]} />
        <View style={[styles.skeleton, { backgroundColor: colors.muted, width: 120, height: 28, marginTop: 4 }]} />
      </View>
    );
  }

  if (!rank || !rank.qualifies) {
    return (
      <View style={[styles.card, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="award" size={18} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Complete a Quest to enter this leaderboard.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
      accessible
      accessibilityLabel={
        rank.rank != null
          ? `Your rank: #${rank.rank} with ${rank.points.toLocaleString()} quest points`
          : `Your quest points: ${rank.points.toLocaleString()}. You are not in the public ranking.`
      }
    >
      <View style={styles.row}>
        <View style={styles.leftBlock}>
          <Text style={[styles.label, { color: colors.primary }]}>Your Rank</Text>
          {rank.rank != null ? (
            <Text style={[styles.rankValue, { color: colors.foreground }]}>#{rank.rank}</Text>
          ) : (
            <Text style={[styles.hiddenNote, { color: colors.mutedForeground }]}>
              Rankings private
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.rightBlock}>
          <Text style={[styles.label, { color: colors.primary }]}>Quest Points</Text>
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
          Your leaderboard visibility is set to private.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  leftBlock: {
    gap: 2,
    flex: 1,
  },
  rightBlock: {
    gap: 2,
    alignItems: 'flex-end',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rankValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  pointsValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  totalText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  hiddenNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: '#00000020',
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.5,
  },
  skeleton: {
    borderRadius: radius.sm,
  },
  privacyNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
});
