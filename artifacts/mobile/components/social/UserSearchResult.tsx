/**
 * UserSearchResult — a single row in the people search list.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { UserSearchResult as SearchResult } from '@/features/social/types/social.types';
import { SOCIAL_PURPLE } from '@/features/social/constants/social.constants';
import { RelationshipStatusBadge } from './RelationshipStatusBadge';
import { MutualFriendSummary } from './MutualFriendSummary';

interface UserSearchResultProps {
  result: SearchResult;
  onPress: () => void;
}

export function UserSearchResult({ result, onPress }: UserSearchResultProps) {
  const colors = useColors();
  const initial = (result.displayName || result.username || '?').charAt(0).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${result.displayName}, @${result.username}, ${result.relationshipState}`}
    >
      <View style={[styles.avatar, { backgroundColor: SOCIAL_PURPLE + '20' }]}>
        <Text style={[styles.initial, { color: SOCIAL_PURPLE }]}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{result.displayName}</Text>
        <Text style={[styles.username, { color: colors.mutedForeground }]}>@{result.username}</Text>
        <View style={styles.meta}>
          <RelationshipStatusBadge state={result.relationshipState} />
          <MutualFriendSummary count={result.mutualFriendCount ?? 0} permitted={result.mutualFriendCount !== undefined} />
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fontFamily.bold, fontSize: 18 },
  body: { flex: 1, gap: spacing[1] },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  meta: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
});
