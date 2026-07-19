/**
 * LeaderboardRow — A single entry in the Quest leaderboard.
 *
 * Privacy rules:
 * - Anonymous users: show "Anonymous Explorer", no avatar, no username.
 * - Current user: highlighted with primary color accent.
 * - Never shows email, account status, or internal user ID.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { QuestLeaderboardEntry } from '@/features/quests/types/questProgress.types';

interface Props {
  entry: QuestLeaderboardEntry;
}

function rankDisplay(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function LeaderboardRow({ entry }: Props) {
  const colors = useColors();

  const isTop3 = entry.rank <= 3;
  const highlight = entry.isCurrentUser;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: highlight ? colors.primary + '12' : 'transparent',
          borderRadius: radius.lg,
          borderColor: highlight ? colors.primary + '30' : 'transparent',
          borderWidth: highlight ? 1 : 0,
        },
      ]}
      accessible
      accessibilityLabel={`Rank ${entry.rank}: ${entry.displayName}, ${entry.points.toLocaleString()} quest points${entry.isCurrentUser ? ', this is you' : ''}`}
    >
      {/* Rank */}
      <Text
        style={[
          styles.rank,
          {
            color: isTop3 ? colors.foreground : colors.mutedForeground,
            fontFamily: isTop3 ? fontFamily.bold : fontFamily.semiBold,
            fontSize: isTop3 ? fontSize.base : fontSize.sm,
          },
        ]}
        accessibilityElementsHidden
      >
        {isTop3 ? rankDisplay(entry.rank) : `#${entry.rank}`}
      </Text>

      {/* Avatar placeholder */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: entry.isAnonymous ? colors.muted : colors.primary + '20' },
        ]}
        accessibilityElementsHidden
      >
        {entry.isAnonymous ? (
          <Feather name="user" size={16} color={colors.mutedForeground} />
        ) : (
          <Text style={[styles.avatarInitial, { color: colors.primary }]}>
            {entry.displayName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Name + username */}
      <View style={styles.nameBlock}>
        <Text
          style={[
            styles.displayName,
            {
              color: colors.foreground,
              fontFamily: highlight ? fontFamily.semiBold : fontFamily.regular,
            },
          ]}
          numberOfLines={1}
        >
          {entry.displayName}
          {entry.isCurrentUser && (
            <Text style={[styles.youLabel, { color: colors.primary }]}> (you)</Text>
          )}
        </Text>
        {!entry.isAnonymous && entry.username && (
          <Text
            style={[styles.username, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            @{entry.username}
          </Text>
        )}
        {entry.isAnonymous && (
          <Text style={[styles.username, { color: colors.mutedForeground }]}>
            Anonymous
          </Text>
        )}
      </View>

      {/* Points */}
      <View style={styles.pointsBlock}>
        <Text
          style={[
            styles.points,
            { color: highlight ? colors.primary : colors.foreground },
          ]}
        >
          {entry.points.toLocaleString()}
        </Text>
        <Text style={[styles.pointsLabel, { color: colors.mutedForeground }]}>pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  rank: {
    width: 36,
    textAlign: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  nameBlock: {
    flex: 1,
    gap: 1,
  },
  displayName: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.35,
  },
  youLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  username: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  pointsBlock: {
    alignItems: 'flex-end',
  },
  points: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  pointsLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
