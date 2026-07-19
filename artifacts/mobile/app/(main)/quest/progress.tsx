/**
 * Quest — Progress Tab (Prompt 8)
 *
 * Three internal sections via segmented control:
 *   Leaderboards | In Action | Completed
 *
 * Default section selection:
 *   1. In Action → needs_resubmission exists
 *   2. In Action → awaiting_proof exists
 *   3. In Action → active quest exists
 *   4. In Action → under review
 *   5. Leaderboards (general default)
 *
 * Deep screens for detail are pushed as Stack overlays:
 *   /quest-completion-detail/:id
 *   /quest-other-activity/:id
 *   /quest-submission/:id
 *   /quest-point-history
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
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

// Domain hooks
import { useProgressInAction } from '@/features/quests/hooks/useProgressInAction';
import { useProgressCompleted } from '@/features/quests/hooks/useProgressCompleted';
import { useQuestLeaderboard } from '@/features/quests/hooks/useQuestLeaderboard';
import { useMyQuestRank } from '@/features/quests/hooks/useMyQuestRank';
import { useProgressOtherActivity } from '@/features/quests/hooks/useProgressOtherActivity';

// Components
import ProgressSegmentedControl from '@/components/quest/ProgressSegmentedControl';
import QuestProgressCard from '@/components/quest/QuestProgressCard';
import CompletionHistoryRow from '@/components/quest/CompletionHistoryRow';
import LeaderboardRow from '@/components/quest/LeaderboardRow';
import CurrentUserRankCard from '@/components/quest/CurrentUserRankCard';
import LeaderboardPeriodSelector from '@/components/quest/LeaderboardPeriodSelector';
import ArchivedActivityRow from '@/components/quest/ArchivedActivityRow';
import PaginationFooter from '@/components/quest/PaginationFooter';
import ProgressEmptyState from '@/components/quest/ProgressEmptyState';
import FilterBottomSheet from '@/components/quest/FilterBottomSheet';
import {
  LeaderboardSkeleton,
  InActionSkeleton,
  CompletedSkeleton,
} from '@/components/quest/ProgressSkeleton';

// Types
import type {
  ProgressSection,
  LeaderboardPeriod,
  CompletedFilter,
  InActionItem,
} from '@/features/quests/types/questProgress.types';
import {
  DEFAULT_COMPLETED_FILTER,
  IN_ACTION_GROUP_PRIORITY,
} from '@/features/quests/types/questProgress.types';

// ─── Section: Leaderboards ────────────────────────────────────────────────────

function LeaderboardsSection() {
  const colors = useColors();
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');

  const leaderboard = useQuestLeaderboard(period);
  const rank = useMyQuestRank(period);

  const allEntries = useMemo(
    () => leaderboard.data?.pages.flatMap(p => p.entries) ?? [],
    [leaderboard.data]
  );

  const hasMore = leaderboard.data?.pages.at(-1)?.hasMore ?? false;

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
      <ScrollView
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
      >
        <LeaderboardSkeleton />
      </ScrollView>
    );
  }

  if (leaderboard.isError) {
    return (
      <ProgressEmptyState
        icon="wifi-off"
        title="Leaderboard Unavailable"
        body="Rankings could not be loaded. In Action and Completed sections are still available."
        actionLabel="Retry"
        onAction={handleRefresh}
      />
    );
  }

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
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing[4] }}>
          {/* Period selector */}
          <LeaderboardPeriodSelector period={period} onSelect={p => { setPeriod(p); }} />

          {/* Current user rank */}
          <CurrentUserRankCard rank={rank.data} isLoading={rank.isLoading} />

          {/* List header */}
          <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.listHeaderText, { color: colors.mutedForeground }]}>
              Quest Leaderboard — {period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}
            </Text>
            <Text style={[styles.listHeaderNote, { color: colors.mutedForeground }]}>
              Quest points only
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <ProgressEmptyState
          icon="bar-chart-2"
          title="No Rankings Yet"
          body="No Quest rankings are available for this period yet."
        />
      }
      ListFooterComponent={
        <PaginationFooter
          hasMore={hasMore}
          isLoading={leaderboard.isFetchingNextPage}
          onLoadMore={handleLoadMore}
          emptyLabel="End of leaderboard"
        />
      }
      renderItem={({ item }) => <LeaderboardRow entry={item} />}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
      )}
    />
  );
}

// ─── Section: In Action ───────────────────────────────────────────────────────

function InActionSection() {
  const colors = useColors();
  const { items, summary, isLoading, isError, refetch } = useProgressInAction();

  const sorted = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        (IN_ACTION_GROUP_PRIORITY[b.status] ?? 0) -
        (IN_ACTION_GROUP_PRIORITY[a.status] ?? 0)
    );
  }, [items]);

  const needsResubmission = sorted.filter(i => i.status === 'needs_resubmission');
  const awaitingProof     = sorted.filter(i => i.status === 'awaiting_proof');
  const activeItems       = sorted.filter(i => ['started', 'in_progress'].includes(i.status));
  const underReview       = sorted.filter(i => i.status === 'under_review');
  const rejected          = sorted.filter(i => i.status === 'rejected');

  const hasAny = items.length > 0;

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <InActionSkeleton />
      </ScrollView>
    );
  }

  if (isError) {
    return (
      <ProgressEmptyState
        icon="wifi-off"
        title="Could Not Load Activity"
        body="Your active quests could not be loaded right now."
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  if (!hasAny) {
    return (
      <ProgressEmptyState
        icon="play-circle"
        title="No Quests In Action"
        body="You don't have a Quest in action. Choose one when you're ready for your next activity."
        actionLabel="Browse Quests"
        onAction={() => router.push('/quest/quests')}
      />
    );
  }

  function renderGroup(title: string, groupItems: InActionItem[]) {
    if (groupItems.length === 0) return null;
    return (
      <View style={{ gap: spacing[3] }}>
        <Text style={[styles.groupHeading, { color: colors.mutedForeground }]}>{title}</Text>
        {groupItems.map(item => (
          <QuestProgressCard key={item.participationId} item={item} />
        ))}
      </View>
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
          tintColor={colors.primary}
        />
      }
    >
      {/* Summary header (compact) */}
      {hasAny && (
        <View style={[styles.summaryRow, { backgroundColor: colors.muted }]}>
          {summary.needsResubmission > 0 && (
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.destructive }]}>
                {summary.needsResubmission}
              </Text>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>
                resubmit
              </Text>
            </View>
          )}
          {summary.awaitingProof > 0 && (
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>
                {summary.awaitingProof}
              </Text>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>
                proof due
              </Text>
            </View>
          )}
          {summary.totalActive > 0 && (
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {summary.totalActive}
              </Text>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>
                active
              </Text>
            </View>
          )}
          {summary.underReview > 0 && (
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {summary.underReview}
              </Text>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>
                reviewing
              </Text>
            </View>
          )}
          {summary.hasExpiringToday && (
            <View style={[styles.summaryStat, { flexDirection: 'row', gap: 4 }]}>
              <Feather name="clock" size={13} color={colors.warning} />
              <Text style={[styles.summaryKey, { color: colors.warning }]}>
                Expiring today
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Priority groups */}
      {renderGroup('Needs Resubmission', needsResubmission)}
      {renderGroup('Ready to Submit Proof', awaitingProof)}
      {renderGroup('Active Quests', activeItems)}
      {renderGroup('Under Review', underReview)}
      {renderGroup('Rejected', rejected)}
    </ScrollView>
  );
}

// ─── Section: Completed ───────────────────────────────────────────────────────

function CompletedSection() {
  const colors = useColors();
  const [filter, setFilter] = useState<CompletedFilter>(DEFAULT_COMPLETED_FILTER);
  const [showFilter, setShowFilter] = useState(false);

  const completed = useProgressCompleted(filter);
  const otherActivity = useProgressOtherActivity();

  const allItems = useMemo(
    () => completed.data?.pages.flatMap(p => p.items) ?? [],
    [completed.data]
  );
  const hasMore = completed.data?.pages.at(-1)?.hasMore ?? false;
  const otherItems = useMemo(
    () => otherActivity.data?.pages.flatMap(p => p.items) ?? [],
    [otherActivity.data]
  );

  function handleLoadMore() {
    if (completed.hasNextPage && !completed.isFetchingNextPage) {
      completed.fetchNextPage();
    }
  }

  function handleRefresh() {
    completed.refetch();
  }

  const isActiveFilter = filter.questType !== 'all' || filter.sortOrder !== 'newest';

  if (completed.isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <CompletedSkeleton />
      </ScrollView>
    );
  }

  return (
    <>
      <FlatList
        data={allItems}
        keyExtractor={item => item.participationId}
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={completed.isRefetching && !completed.isFetchingNextPage}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing[3] }}>
            {/* Filter bar */}
            <View style={styles.filterBar}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Completed Quests
              </Text>
              <Pressable
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: isActiveFilter ? colors.primary + '15' : colors.muted,
                    borderColor: isActiveFilter ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setShowFilter(true)}
                accessibilityRole="button"
                accessibilityLabel="Filter and sort"
              >
                <Feather
                  name="sliders"
                  size={14}
                  color={isActiveFilter ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.filterBtnLabel, {
                  color: isActiveFilter ? colors.primary : colors.mutedForeground,
                }]}>
                  Filter
                  {isActiveFilter ? ' •' : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <ProgressEmptyState
            icon="check-circle"
            title="No Completed Quests"
            body={isActiveFilter ? 'No quests match the current filter.' : 'Completed Quests will appear here.'}
            actionLabel={isActiveFilter ? 'Clear Filter' : 'Find a Quest'}
            onAction={isActiveFilter
              ? () => { setFilter(DEFAULT_COMPLETED_FILTER); }
              : () => router.push('/quest/quests')
            }
          />
        }
        ListFooterComponent={
          <View style={{ gap: spacing[5] }}>
            <PaginationFooter
              hasMore={hasMore}
              isLoading={completed.isFetchingNextPage}
              onLoadMore={handleLoadMore}
              emptyLabel="All completed quests shown"
            />

            {/* Other Activity link */}
            {(otherItems.length > 0 || !otherActivity.isLoading) && (
              <Pressable
                style={[styles.otherActivityLink, { borderColor: colors.border }]}
                onPress={() => {/* section inline */ }}
                accessibilityRole="none"
              >
                <View style={{ gap: spacing[3] }}>
                  <View style={styles.otherHeader}>
                    <Text style={[styles.otherTitle, { color: colors.mutedForeground }]}>
                      Other Activity
                    </Text>
                    <Text style={[styles.otherCount, { color: colors.mutedForeground }]}>
                      {otherItems.length > 0 ? `${otherItems.length} item${otherItems.length !== 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.otherBody, { color: colors.mutedForeground }]}>
                    Abandoned, expired, and rejected participations.
                  </Text>
                  {otherItems.slice(0, 3).map(item => (
                    <ArchivedActivityRow key={item.participationId} item={item} />
                  ))}
                  {otherActivity.hasNextPage && (
                    <Pressable
                      onPress={() => otherActivity.fetchNextPage()}
                      accessibilityRole="button"
                      accessibilityLabel="Load more archived activity"
                    >
                      <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                        Load more
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            )}

            {/* Point History link */}
            <Pressable
              style={[styles.pointHistoryLink, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => router.push('/quest-point-history')}
              accessibilityRole="button"
              accessibilityLabel="View Quest Point History"
            >
              <Feather name="list" size={16} color={colors.primary} />
              <Text style={[styles.pointHistoryLabel, { color: colors.foreground }]}>
                Quest Point History
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <CompletionHistoryRow item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
      />

      <FilterBottomSheet
        visible={showFilter}
        filter={filter}
        onApply={setFilter}
        onDismiss={() => setShowFilter(false)}
      />
    </>
  );
}

// ─── Root Screen ──────────────────────────────────────────────────────────────

export default function QuestProgressScreen() {
  const colors = useColors();
  const { items, summary } = useProgressInAction();

  // Determine default section
  const defaultSection = useMemo((): ProgressSection => {
    if (!items || items.length === 0) return 'leaderboards';
    if (summary.needsResubmission > 0) return 'in_action';
    if (summary.awaitingProof > 0)     return 'in_action';
    if (summary.totalActive > 0)       return 'in_action';
    if (summary.underReview > 0)       return 'in_action';
    return 'leaderboards';
  }, [items, summary]);

  const [section, setSection] = useState<ProgressSection>(defaultSection);
  const hasAppliedDefault = useRef(false);

  // Apply default section once after data loads (don't switch on subsequent refreshes)
  useEffect(() => {
    if (!hasAppliedDefault.current && items.length >= 0) {
      setSection(defaultSection);
      hasAppliedDefault.current = true;
    }
  }, [defaultSection]);

  const urgentCount = summary.needsResubmission + summary.awaitingProof;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Segmented control */}
      <View style={[styles.controlBar, { borderBottomColor: colors.border }]}>
        <ProgressSegmentedControl
          activeSection={section}
          onSelect={setSection}
          inActionUrgentCount={urgentCount}
        />
      </View>

      {/* Section content */}
      <View style={{ flex: 1 }}>
        {section === 'leaderboards' && <LeaderboardsSection />}
        {section === 'in_action'    && <InActionSection />}
        {section === 'completed'    && <CompletedSection />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  controlBar: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionContent: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[10],
  },
  groupHeading: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    padding: spacing[3],
    borderRadius: radius.xl,
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  summaryKey: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBtnLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listHeaderText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  listHeaderNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing[3],
  },
  otherActivityLink: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[4],
  },
  otherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otherTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  otherCount: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  otherBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  loadMoreText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing[2],
  },
  pointHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pointHistoryLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    flex: 1,
  },
});
