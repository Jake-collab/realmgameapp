/**
 * Hunt Point History Screen — Worlds (Prompt 14)
 *
 * Owner-only view of Hunt-related point ledger entries.
 * Hunt_reward + offsetting reversals only. Never mixes Quest points.
 *
 * Route: /hunt-point-history
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

import { useHuntPointHistory }    from '@/features/hunts/hooks/useHuntPointHistory';
import HuntPointTransactionRow    from '@/components/hunt-progress/HuntPointTransactionRow';
import HuntPaginationFooter       from '@/components/hunt-progress/HuntPaginationFooter';
import HuntProgressEmptyState     from '@/components/hunt-progress/HuntProgressEmptyState';
import { HuntPointHistorySkeleton } from '@/components/hunt-progress/HuntProgressSkeleton';

const HUNT_COLOR = '#059669';

export default function HuntPointHistoryScreen() {
  const colors  = useColors();
  const history = useHuntPointHistory();

  const allItems = useMemo(
    () => history.data?.pages.flatMap(p => p.items) ?? [],
    [history.data],
  );
  const hasMore = history.data?.pages.at(-1)?.hasMore ?? false;

  // Total net points
  const netPoints = allItems.reduce((sum, t) => sum + t.amount, 0);

  function handleLoadMore() {
    if (history.hasNextPage && !history.isFetchingNextPage) {
      history.fetchNextPage();
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/hunt/progress');
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Hunt Point History
        </Text>
      </View>

      {history.isLoading && (
        <View style={styles.loadPad}>
          <HuntPointHistorySkeleton />
        </View>
      )}

      {!history.isLoading && history.isError && (
        <HuntProgressEmptyState
          icon="wifi-off"
          title="Could Not Load"
          body="Your Hunt point history could not be loaded."
          actionLabel="Retry"
          onAction={() => history.refetch()}
        />
      )}

      {!history.isLoading && !history.isError && (
        <FlatList
          data={allItems}
          keyExtractor={item => item.ledgerId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching && !history.isFetchingNextPage}
              onRefresh={() => history.refetch()}
              tintColor={HUNT_COLOR}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: spacing[4] }}>
              {/* Net summary */}
              {allItems.length > 0 && (
                <View style={[styles.summaryCard, { backgroundColor: HUNT_COLOR + '12', borderColor: HUNT_COLOR + '30' }]}>
                  <Text style={[styles.summaryLabel, { color: HUNT_COLOR }]}>Total Hunt Points</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                    {netPoints.toLocaleString()}
                  </Text>
                  <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
                    Hunt rewards only. Quest points tracked separately.
                  </Text>
                </View>
              )}

              <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.listHeaderText, { color: colors.mutedForeground }]}>
                  Hunt point transactions
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <HuntProgressEmptyState
              icon="list"
              title="No Hunt Points Yet"
              body="Complete a Hunt to earn points. They will appear here."
              actionLabel="Browse Hunts"
              onAction={() => router.push('/hunt/hunts')}
            />
          }
          ListFooterComponent={
            <HuntPaginationFooter
              hasMore={hasMore}
              isLoading={history.isFetchingNextPage}
              onLoadMore={handleLoadMore}
              emptyLabel="All Hunt transactions shown"
            />
          }
          renderItem={({ item }) => <HuntPointTransactionRow transaction={item} />}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: spacing[1] },
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg },
  loadPad: { padding: spacing[5] },
  listContent: {
    paddingHorizontal: spacing[5], paddingTop: spacing[4],
    paddingBottom: spacing[12], gap: spacing[0],
  },
  summaryCard: {
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing[5], gap: spacing[1], alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  summaryValue: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'] },
  summaryNote: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'center' },
  listHeader: {
    paddingBottom: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listHeaderText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing[1] },
});
