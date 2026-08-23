/**
 * Hunt Progress Screen — Worlds (Prompt 14)
 *
 * Three sections via segmented control:
 *   Leaderboards | In Action | Completed
 *
 * Default section selection (highest priority first):
 *   1. In Action → stops need resubmission
 *   2. In Action → stops awaiting proof
 *   3. In Action → active hunt exists
 *   4. In Action → stops under review
 *   5. Completed → arrived from a newly-completed hunt (param: arrivedFromCompletion)
 *   6. Leaderboards (default)
 *
 * Deep screens pushed as Stack overlays:
 *   /hunt-completion-detail/:participationId
 *   /hunt-other-activity/:participationId
 *   /hunt-submission-history/:participationId
 *   /hunt-point-history
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

// Domain hooks
import { useHuntInAction }       from '@/features/hunts/hooks/useHuntInAction';
import { useHuntCompleted }       from '@/features/hunts/hooks/useHuntCompleted';
import { useHuntLeaderboard }     from '@/features/hunts/hooks/useHuntLeaderboard';
import { useMyHuntRank }          from '@/features/hunts/hooks/useMyHuntRank';
import { useHuntOtherActivity }   from '@/features/hunts/hooks/useHuntOtherActivity';
import { useHuntProgressSummary } from '@/features/hunts/hooks/useHuntProgressSummary';

// Components
import HuntProgressSegmentedControl from '@/components/hunt-progress/HuntProgressSegmentedControl';
import HuntInActionCard             from '@/components/hunt-progress/HuntInActionCard';
import HuntCompletionHistoryRow     from '@/components/hunt-progress/HuntCompletionHistoryRow';
import HuntLeaderboardRow           from '@/components/hunt-progress/HuntLeaderboardRow';
import HuntCurrentRankCard          from '@/components/hunt-progress/HuntCurrentRankCard';
import HuntLeaderboardPeriodSelector from '@/components/hunt-progress/HuntLeaderboardPeriodSelector';
import HuntArchivedActivityRow      from '@/components/hunt-progress/HuntArchivedActivityRow';
import HuntPaginationFooter         from '@/components/hunt-progress/HuntPaginationFooter';
import HuntProgressEmptyState       from '@/components/hunt-progress/HuntProgressEmptyState';
import HuntProgressSummaryCard      from '@/components/hunt-progress/HuntProgressSummaryCard';
import {
  HuntLeaderboardSkeleton,
  HuntInActionSkeleton,
  HuntCompletedSkeleton,
} from '@/components/hunt-progress/HuntProgressSkeleton';

// Types
import type {
  HuntProgressSection,
  LeaderboardPeriod,
  HuntCompletedFilter,
} from '@/features/hunts/types/huntProgress.types';
import {
  DEFAULT_HUNT_COMPLETED_FILTER,
  resolveDefaultHuntProgressSection,
} from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

// ─── Section: Leaderboards ────────────────────────────────────────────────────

function LeaderboardsSection() {
  const colors = useColors();
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');

  const leaderboard = useHuntLeaderboard(period);
  const rank        = useMyHuntRank(period);

  const allEntries = useMemo(
    () => leaderboard.data?.entries ?? [],
    [leaderboard.data],
  );
  const hasMore = leaderboard.data?.hasMore ?? false;

  function handleLoadMore() {
    if (leaderboard.hasNextPage && !leaderboard.isFetchingNextPage) {
      leaderboard.fetchNextPage();
    }
  }

  function handleRefresh() {
    leaderboard.refetch();
    rank.refetch();
  }

  const isRefreshing = leaderboard.isRefetching && !leaderboard.isFetchingNextPage;

  if (leaderboard.isLoading || rank.isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <HuntLeaderboardSkeleton />
      </ScrollView>
    );
  }

  if (leaderboard.isError) {
    return (
      <HuntProgressEmptyState
        icon="wifi-off"
        title="Leaderboard Unavailable"
        body="Hunt rankings could not be loaded. In Action and Completed sections are still available."
        actionLabel="Retry"
        onAction={handleRefresh}
      />
    );
  }

  const periodLabel =
    period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';

  return (
    <FlatList
      data={allEntries}
      keyExtractor={(e, i) => `${e.rank}-${i}`}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={HUNT_COLOR}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing[4] }}>
          <HuntLeaderboardPeriodSelector period={period} onSelect={p => { setPeriod(p); }} />
          <HuntCurrentRankCard rank={rank.data} isLoading={rank.isLoading} />

          <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.listHeaderText, { color: colors.mutedForeground }]}>
              Hunt Leaderboard — {periodLabel}
            </Text>
            <Text style={[styles.listHeaderNote, { color: colors.mutedForeground }]}>
              Hunt points only
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <HuntProgressEmptyState
          icon="bar-chart-2"
          title="No Rankings Yet"
          body="No Hunt rankings are available for this period yet."
        />
      }
      ListFooterComponent={
        <HuntPaginationFooter
          hasMore={hasMore}
          isLoading={leaderboard.isFetchingNextPage}
          onLoadMore={handleLoadMore}
          emptyLabel="End of leaderboard"
        />
      }
      renderItem={({ item }) => <HuntLeaderboardRow entry={item} />}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
      )}
    />
  );
}

// ─── Section: In Action ───────────────────────────────────────────────────────

function InActionSection() {
  const colors = useColors();
  const { items, summary, isLoading, isError, refetch } = useHuntInAction();

  const sortedItems = useMemo(() => {
    // Priority: needs_resubmission stop > awaiting_proof stop > active > under_review > none
    const priority = (item: typeof items[0]) => {
      const s = item.pendingStop?.stopStatus;
      if (s === 'needs_resubmission') return 5;
      if (s === 'awaiting_proof')     return 4;
      if (item.status === 'active')   return 3;
      if (s === 'under_review')       return 2;
      return 1;
    };
    return [...items].sort((a, b) => priority(b) - priority(a));
  }, [items]);

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <HuntInActionSkeleton />
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <HuntProgressEmptyState
        icon="wifi-off"
        title="Could Not Load Activity"
        body="Your active Hunts could not be loaded right now."
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  if (items.length === 0) {
    return (
      <HuntProgressEmptyState
        icon="map"
        title="No Hunts In Action"
        body="You don't have a Hunt in action. Browse available Hunts to get started."
        actionLabel="Browse Hunts"
        onAction={() => router.push('/(main)/hunt')}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refetch}
          tintColor={HUNT_COLOR}
        />
      }
    >
      {/* Summary header */}
      <View style={[styles.summaryRow, { backgroundColor: colors.muted }]}>
        {summary.stopsNeedingResubmission > 0 && (
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryValue, { color: colors.destructive }]}>
              {summary.stopsNeedingResubmission}
            </Text>
            <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>resubmit</Text>
          </View>
        )}
        {summary.stopsAwaitingProof > 0 && (
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {summary.stopsAwaitingProof}
            </Text>
            <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>proof due</Text>
          </View>
        )}
        {summary.activeHunts > 0 && (
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryValue, { color: HUNT_COLOR }]}>
              {summary.activeHunts}
            </Text>
            <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>active</Text>
          </View>
        )}
        {summary.stopsUnderReview > 0 && (
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {summary.stopsUnderReview}
            </Text>
            <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>reviewing</Text>
          </View>
        )}
        {summary.hasApproachingDeadline && (
          <View style={[styles.summaryStat, { flexDirection: 'row', gap: 4 }]}>
            <Feather name="clock" size={13} color={colors.warning} />
            <Text style={[styles.summaryKey, { color: colors.warning }]}>Deadline soon</Text>
          </View>
        )}
      </View>

      {/* Hunt cards */}
      <View style={{ gap: spacing[3] }}>
        {sortedItems.map(item => (
          <HuntInActionCard key={item.participationId} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Section: Completed ───────────────────────────────────────────────────────

function CompletedSection() {
  const colors = useColors();
  const [filter, setFilter] = useState<HuntCompletedFilter>(DEFAULT_HUNT_COMPLETED_FILTER);

  const completed     = useHuntCompleted(filter);
  const otherActivity = useHuntOtherActivity();

  const allItems = useMemo(
    () => completed.data?.items ?? [],
    [completed.data],
  );
  const hasMore = completed.data?.hasMore ?? false;

  const otherItems = useMemo(
    () => otherActivity.data?.items ?? [],
    [otherActivity.data],
  );

  function handleLoadMore() {
    if (completed.hasNextPage && !completed.isFetchingNextPage) {
      completed.fetchNextPage();
    }
  }

  function handleRefresh() {
    completed.refetch();
  }

  if (completed.isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <HuntCompletedSkeleton />
      </ScrollView>
    );
  }

  const isActiveFilter = filter.mode !== 'all' || filter.sortOrder !== 'newest';

  return (
    <FlatList
      data={allItems}
      keyExtractor={item => item.participationId}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={completed.isRefetching && !completed.isFetchingNextPage}
          onRefresh={handleRefresh}
          tintColor={HUNT_COLOR}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing[3] }}>
          {/* Filter bar */}
          <View style={styles.filterBar}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Completed Hunts
            </Text>
            <Pressable
              style={[
                styles.filterBtn,
                {
                  backgroundColor: isActiveFilter ? HUNT_COLOR + '15' : colors.muted,
                  borderColor: isActiveFilter ? HUNT_COLOR : colors.border,
                },
              ]}
              onPress={() => {
                // Cycle through modes for simplicity (a full sheet would be added with more time)
                const modes: HuntCompletedFilter['mode'][] = ['all', 'solo', 'group', 'ordered', 'unordered'];
                const idx = modes.indexOf(filter.mode);
                setFilter(f => ({ ...f, mode: modes[(idx + 1) % modes.length] }));
              }}
              accessibilityRole="button"
              accessibilityLabel="Filter hunts"
            >
              <Feather
                name="sliders"
                size={14}
                color={isActiveFilter ? HUNT_COLOR : colors.mutedForeground}
              />
              <Text style={[styles.filterBtnLabel, {
                color: isActiveFilter ? HUNT_COLOR : colors.mutedForeground,
              }]}>
                {filter.mode === 'all' ? 'Filter' : filter.mode.charAt(0).toUpperCase() + filter.mode.slice(1)}
              </Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        <HuntProgressEmptyState
          icon="flag"
          title="No Completed Hunts"
          body={isActiveFilter ? 'No Hunts match the current filter.' : 'Completed Hunts will appear here.'}
          actionLabel={isActiveFilter ? 'Clear Filter' : 'Browse Hunts'}
          onAction={isActiveFilter
            ? () => { setFilter(DEFAULT_HUNT_COMPLETED_FILTER); }
            : () => router.push('/(main)/hunt')
          }
        />
      }
      ListFooterComponent={
        <View style={{ gap: spacing[5] }}>
          <HuntPaginationFooter
            hasMore={hasMore}
            isLoading={completed.isFetchingNextPage}
            onLoadMore={handleLoadMore}
            emptyLabel="All completed Hunts shown"
          />

          {/* Other Activity */}
          {(otherItems.length > 0 || !otherActivity.isLoading) && (
            <View style={[styles.otherActivityBlock, { borderColor: colors.border }]}>
              <View style={styles.otherHeader}>
                <Text style={[styles.otherTitle, { color: colors.mutedForeground }]}>
                  Other Activity
                </Text>
                {otherItems.length > 0 && (
                  <Text style={[styles.otherCount, { color: colors.mutedForeground }]}>
                    {otherItems.length} item{otherItems.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              <Text style={[styles.otherBody, { color: colors.mutedForeground }]}>
                Withdrawn, removed, cancelled, and expired participations.
              </Text>
              {otherItems.slice(0, 3).map(item => (
                <HuntArchivedActivityRow key={item.participationId} item={item} />
              ))}
              {otherActivity.hasNextPage && (
                <Pressable
                  onPress={() => otherActivity.fetchNextPage()}
                  accessibilityRole="button"
                  accessibilityLabel="Load more archived activity"
                >
                  <Text style={[styles.loadMoreText, { color: HUNT_COLOR }]}>Load more</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Hunt Point History link */}
          <Pressable
            style={[styles.pointHistoryLink, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => router.push('/hunt-point-history')}
            accessibilityRole="button"
            accessibilityLabel="View Hunt Point History"
          >
            <Feather name="list" size={16} color={HUNT_COLOR} />
            <Text style={[styles.pointHistoryLabel, { color: colors.foreground }]}>
              Hunt Point History
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      }
      renderItem={({ item }) => <HuntCompletionHistoryRow item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HuntProgressScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ arrivedFromCompletion?: string }>();

  const { items: inActionItems, summary: inActionSummary, isLoading: inActionLoading } = useHuntInAction();
  const progressSummary = useHuntProgressSummary();

  // Compute default section (runs once after initial load)
  const [section, setSection] = useState<HuntProgressSection>('leaderboards');
  const defaultResolved = useRef(false);

  useEffect(() => {
    if (defaultResolved.current || inActionLoading) return;
    defaultResolved.current = true;

    const arrivedFromCompletion = params.arrivedFromCompletion === 'true';
    const resolved = resolveDefaultHuntProgressSection(
      inActionSummary,
      arrivedFromCompletion,
      null,
    );
    setSection(resolved);
  }, [inActionLoading, inActionSummary, params.arrivedFromCompletion]);

  const urgentCount =
    inActionSummary.stopsNeedingResubmission +
    inActionSummary.stopsAwaitingProof;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Hunt Progress</Text>
      </View>

      {/* Personal summary strip */}
      <View style={styles.summaryStrip}>
        <HuntProgressSummaryCard
          summary={progressSummary.data}
          isLoading={progressSummary.isLoading}
        />
      </View>

      {/* Segmented control */}
      <View style={styles.controlWrap}>
        <HuntProgressSegmentedControl
          activeSection={section}
          onSelect={setSection}
          inActionUrgentCount={urgentCount}
        />
      </View>

      {/* Section content */}
      <View style={styles.content}>
        {section === 'leaderboards' && <LeaderboardsSection />}
        {section === 'in_action'    && <InActionSection />}
        {section === 'completed'    && <CompletedSection />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  summaryStrip: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  controlWrap: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  content: { flex: 1 },
  sectionContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
    gap: spacing[4],
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listHeaderText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  listHeaderNote: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing[3] },
  // In Action
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    flexWrap: 'wrap',
  },
  summaryStat: { alignItems: 'center', minWidth: 56 },
  summaryValue: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  summaryKey: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  // Completed
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBtnLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  // Other Activity
  otherActivityBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[3],
  },
  otherHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otherTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  otherCount: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  otherBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  loadMoreText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, textAlign: 'center' },
  // Point history link
  pointHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pointHistoryLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
