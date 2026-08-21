/**
 * BlockedUserRow — single row in the Blocked Users list.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { BlockedUserEntry } from '@/features/social/types/social.types';

interface BlockedUserRowProps {
  entry: BlockedUserEntry;
  onUnblock: () => void;
  isLoading?: boolean;
}

export function BlockedUserRow({ entry, onUnblock, isLoading }: BlockedUserRowProps) {
  const colors = useColors();
  const initial = (entry.displayName || entry.username || '?').charAt(0).toUpperCase();

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
        <Text style={[styles.initial, { color: colors.mutedForeground }]}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{entry.displayName}</Text>
        {entry.username && (
          <Text style={[styles.username, { color: colors.mutedForeground }]}>@{entry.username}</Text>
        )}
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          Blocked {new Date(entry.blockedAt).toLocaleDateString()}
        </Text>
      </View>
      <Pressable
        style={[styles.unblock, { backgroundColor: colors.muted }]}
        onPress={onUnblock}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={`Unblock ${entry.displayName}`}
      >
        <Text style={[styles.unblockText, { color: colors.foreground }]}>Unblock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fontFamily.bold, fontSize: 16 },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  unblock: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.lg },
  unblockText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
