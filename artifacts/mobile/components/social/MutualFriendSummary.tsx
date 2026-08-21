/**
 * MutualFriendSummary — "N mutual friends" pill or empty.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface MutualFriendSummaryProps {
  count: number;
  permitted: boolean;
}

export function MutualFriendSummary({ count, permitted }: MutualFriendSummaryProps) {
  const colors = useColors();
  if (!permitted || count === 0) return null;
  const label = count === 1 ? '1 mutual friend' : `${count} mutual friends`;
  return (
    <View style={[styles.row, { backgroundColor: colors.muted }]} accessibilityLabel={label}>
      <Feather name="users" size={11} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: radius.full,
  },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
