/**
 * HuntPaginationFooter — Load-more control and end-of-list indicator (hunt-themed).
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface Props {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  emptyLabel?: string;
}

export default function HuntPaginationFooter({ hasMore, isLoading, onLoadMore, emptyLabel }: Props) {
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={styles.center} accessibilityLabel="Loading more items">
        <ActivityIndicator size="small" color="#059669" />
      </View>
    );
  }

  if (hasMore) {
    return (
      <Pressable
        style={[styles.loadMore, { borderColor: colors.border }]}
        onPress={onLoadMore}
        accessibilityRole="button"
        accessibilityLabel="Load more"
      >
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        <Text style={[styles.loadMoreLabel, { color: colors.mutedForeground }]}>Load more</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={[styles.endLabel, { color: colors.mutedForeground }]}>
        {emptyLabel ?? 'No more items'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: spacing[5] },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing[2],
  },
  loadMoreLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  endLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
