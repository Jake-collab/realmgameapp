/**
 * Quest Point History — Worlds
 *
 * Paginated ledger view of quest-related point transactions.
 * Shows rewards and reversals as separate append-only entries.
 * Never exposes raw ledger IDs, reason strings, or other users' entries.
 */

import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useQuestPointHistory } from '@/features/quests/hooks/useQuestPointHistory';
import PointTransactionRow from '@/components/quest/PointTransactionRow';
import { PointHistorySkeleton } from '@/components/quest/ProgressSkeleton';
import ProgressEmptyState from '@/components/quest/ProgressEmptyState';
import PaginationFooter from '@/components/quest/PaginationFooter';
import type { QuestPointTransaction } from '@/features/quests/types/questProgress.types';

export default function QuestPointHistoryScreen() {
  const colors = useColors();

  const history = useQuestPointHistory();

  const allItems = useMemo(
    () => history.data?.pages.flatMap(p => p.items) ?? [],
    [history.data]
  );

  const hasMore = history.data?.pages.at(-1)?.hasMore ?? false;
  const totalPoints = useMemo(
    () => allItems.reduce((sum, t) => sum + t.amount, 0),
    [allItems]
  );

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/quest/progress');
  }

  function handleLoadMore() {
    if (history.hasNextPage && !history.isFetchingNextPage) {
      history.fetchNextPage();
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Quest Point History</Text>
        <View style={{ width: 22 }} />
      </View>

      {history.isLoading ? (
        <View style={{ padding: spacing[5] }}>
          <PointHistorySkeleton />
        </View>
      ) : history.isError ? (
        <ProgressEmptyState
          icon="wifi-off"
          title="Could Not Load History"
          body="Your point history could not be retrieved right now."
          actionLabel="Retry"
          onAction={() => history.refetch()}
        />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching && !history.isFetchingNextPage}
              onRefresh={() => history.refetch()}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            allItems.length > 0 ? (
              <View style={[styles.summaryCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                <Text style={[styles.summaryLabel, { color: colors.primary }]}>
                  Net Quest Points (shown)
                </Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {totalPoints >= 0 ? '+' : ''}{totalPoints.toLocaleString()}
                </Text>
                <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
                  The append-only ledger is the source of truth. Reversals appear as separate offsetting entries.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <ProgressEmptyState
              icon="list"
              title="No Point History"
              body="Quest point transactions will appear here after you complete quests."
              actionLabel="Find a Quest"
              onAction={() => router.push('/quest/quests')}
            />
          }
          ListFooterComponent={
            <PaginationFooter
              hasMore={hasMore}
              isLoading={history.isFetchingNextPage}
              onLoadMore={handleLoadMore}
              emptyLabel="All transactions shown"
            />
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item }) => <PointTransactionRow transaction={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[1] },
  summaryCard: {
    padding: spacing[4], borderRadius: radius.xl, borderWidth: 1,
    gap: spacing[1], marginBottom: spacing[4],
  },
  summaryLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'] },
  summaryNote: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.5 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing[2] },
});
