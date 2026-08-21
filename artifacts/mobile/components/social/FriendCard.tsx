/**
 * FriendCard — single row in the friends list.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { FriendEntry } from '@/features/social/types/social.types';
import { SOCIAL_PURPLE } from '@/features/social/constants/social.constants';

interface FriendCardProps {
  friend: FriendEntry;
  onPress: () => void;
}

export function FriendCard({ friend, onPress }: FriendCardProps) {
  const colors = useColors();
  const initial = (friend.displayName || friend.username || '?').charAt(0).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${friend.displayName}'s profile`}
    >
      <View style={[styles.avatar, { backgroundColor: SOCIAL_PURPLE + '20' }]}>
        <Text style={[styles.initial, { color: SOCIAL_PURPLE }]}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{friend.displayName}</Text>
        <Text style={[styles.username, { color: colors.mutedForeground }]}>@{friend.username}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fontFamily.bold, fontSize: 18 },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
});
