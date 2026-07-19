/**
 * Achievements Hub Screen — Worlds (Prompt 15)
 *
 * Profile subsection. Navigation:
 *   Overview | History | Titles | Badges | Statistics
 *
 * Route: /profile-achievements
 * Accessed via Profile tab in Quest and Hunt modes.
 * Hidden achievements revealed after unlock. Secret requirements never shown.
 */

import React, { useCallback, useMemo, useState } from 'react';
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

// Progression domain
import { useAchievements }       from '@/features/progression/hooks/useAchievements';
import { useAchievementHistory } from '@/features/progression/hooks/useAchievementHistory';
import { useTitles }             from '@/features/progression/hooks/useTitles';
import { useBadges }             from '@/features/progression/hooks/useBadges';
import { useStatistics }         from '@/features/progression/hooks/useStatistics';
import { useProgressOverview }   from '@/features/progression/hooks/useProgressOverview';
import { useSetActiveTitle }     from '@/features/progression/hooks/useSetActiveTitle';

// Components
import AchievementCard           from '@/components/progression/AchievementCard';
import AchievementHistoryRow     from '@/components/progression/AchievementHistoryRow';
import TitleCard                 from '@/components/progression/TitleCard';
import BadgeCard                 from '@/components/progression/BadgeCard';
import BadgeGrid                 from '@/components/progression/BadgeGrid';
import StatisticsCard            from '@/components/progression/StatisticsCard';
import ProgressOverviewCard      from '@/components/progression/ProgressOverviewCard';
import ProgressionEmptyState     from '@/components/progression/ProgressionEmptyState';
import {
  AchievementsSkeleton, HistorySkeleton, TitlesSkeleton,
  BadgesSkeleton, StatisticsSkeleton, ProgressOverviewSkeleton,
} from '@/components/progression/ProgressionSkeleton';

import type {
  ProgressionSection,
  AchievementCategory,
} from '@/features/progression/types/progression.types';
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_CATEGORY_LABELS } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

const NAV_SECTIONS: { key: ProgressionSection; label: string }[] = [
  { key: 'overview',   label: 'Overview' },
  { key: 'history',    label: 'History' },
  { key: 'titles',     label: 'Titles' },
  { key: 'badges',     label: 'Badges' },
  { key: 'statistics', label: 'Stats' },
];

// ─── Section: Overview ────────────────────────────────────────────────────────

function OverviewSection() {
  const colors       = useColors();
  const overview     = useProgressOverview();
  const achievements = useAchievements();
  const [selectedCat, setSelectedCat] = useState<AchievementCategory | undefined>(undefined);

  const catAchievements = useAchievements(selectedCat);

  const displayAchievements = selectedCat ? (catAchievements.data ?? []) : (achievements.data ?? []);
  const isLoading           = (selectedCat ? catAchievements.isLoading : achievements.isLoading) || overview.isLoading;

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <ProgressOverviewSkeleton />
        <AchievementsSkeleton />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => { overview.refetch(); achievements.refetch(); }}
          tintColor={WORLDS_PURPLE}
        />
      }
    >
      {overview.data && (
        <ProgressOverviewCard overview={overview.data} />
      )}

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
        <Pressable
          style={[styles.catPill, { backgroundColor: !selectedCat ? WORLDS_PURPLE : colors.muted, borderColor: !selectedCat ? WORLDS_PURPLE : colors.border }]}
          onPress={() => setSelectedCat(undefined)}
          accessibilityRole="button" accessibilityLabel="All categories"
        >
          <Text style={[styles.catPillLabel, { color: !selectedCat ? '#fff' : colors.mutedForeground }]}>All</Text>
        </Pressable>
        {ACHIEVEMENT_CATEGORIES.map(cat => {
          const active = selectedCat === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.catPill, { backgroundColor: active ? WORLDS_PURPLE : colors.muted, borderColor: active ? WORLDS_PURPLE : colors.border }]}
              onPress={() => setSelectedCat(cat)}
              accessibilityRole="button" accessibilityLabel={ACHIEVEMENT_CATEGORY_LABELS[cat]}
            >
              <Text style={[styles.catPillLabel, { color: active ? '#fff' : colors.mutedForeground }]}>
                {ACHIEVEMENT_CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {displayAchievements.length === 0 && (
        <ProgressionEmptyState
          icon="award"
          title="No Achievements Yet"
          body="Complete your first Quest or Hunt to start earning achievements."
        />
      )}

      {displayAchievements.map(a => (
        <AchievementCard
          key={a.achievementId}
          achievement={a}
          onPress={() => router.push(`/achievement-detail/${a.achievementId}`)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Section: History ────────────────────────────────────────────────────────

function HistorySection() {
  const history = useAchievementHistory();

  const allItems = useMemo(
    () => history.data?.pages.flatMap(p => p.items) ?? [],
    [history.data],
  );
  const hasMore = history.data?.pages.at(-1)?.hasMore ?? false;

  if (history.isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <HistorySkeleton />
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={allItems}
      keyExtractor={item => item.achievementId}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={history.isRefetching && !history.isFetchingNextPage} onRefresh={() => history.refetch()} tintColor={WORLDS_PURPLE} />
      }
      ListEmptyComponent={
        <ProgressionEmptyState
          icon="clock"
          title="No Achievement History"
          body="Achievements you unlock will appear here, newest first."
        />
      }
      ListFooterComponent={
        hasMore ? (
          <Pressable
            style={styles.loadMore}
            onPress={() => { if (history.hasNextPage) history.fetchNextPage(); }}
            accessibilityRole="button" accessibilityLabel="Load more achievements"
          >
            <Text style={[styles.loadMoreLabel, { color: WORLDS_PURPLE }]}>Load more</Text>
          </Pressable>
        ) : <View style={{ height: spacing[8] }} />
      }
      renderItem={({ item }) => <AchievementHistoryRow item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
    />
  );
}

// ─── Section: Titles ─────────────────────────────────────────────────────────

function TitlesSection() {
  const colors        = useColors();
  const { data: titles, isLoading, refetch } = useTitles();
  const setActive     = useSetActiveTitle();

  const [selectingId, setSelectingId] = useState<string | null>(null);

  const handleSelect = useCallback(async (titleId: string) => {
    setSelectingId(titleId);
    try {
      await setActive.mutateAsync(titleId);
    } finally {
      setSelectingId(null);
    }
  }, [setActive]);

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <TitlesSkeleton />
      </ScrollView>
    );
  }

  const list = titles ?? [];

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={WORLDS_PURPLE} />}
    >
      <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>
        Select a title to display on your profile. Only one title can be active at a time.
      </Text>

      {list.length === 0 && (
        <ProgressionEmptyState
          icon="tag"
          title="No Titles Unlocked"
          body="Titles unlock through achievements. Complete milestones to earn them."
        />
      )}

      {list.map(title => (
        <TitleCard
          key={title.titleId}
          title={title}
          onSelect={handleSelect}
          isSelectingId={selectingId}
        />
      ))}
    </ScrollView>
  );
}

// ─── Section: Badges ─────────────────────────────────────────────────────────

function BadgesSection() {
  const colors = useColors();
  const { data: badges, isLoading, refetch } = useBadges();

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <BadgesSkeleton />
      </ScrollView>
    );
  }

  const list = badges ?? [];

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={WORLDS_PURPLE} />}
    >
      <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>
        Badges are earned through participation. They appear on your profile. No gameplay effect.
      </Text>

      {list.length === 0 && (
        <ProgressionEmptyState
          icon="shield"
          title="No Badges Unlocked"
          body="Badges are earned through participation in Quests, Hunts, and special events."
        />
      )}

      {list.length > 0 && <BadgeGrid badges={list} />}
    </ScrollView>
  );
}

// ─── Section: Statistics ──────────────────────────────────────────────────────

function StatisticsSection() {
  const { data: stats, isLoading, isError, refetch } = useStatistics();

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <StatisticsSkeleton />
      </ScrollView>
    );
  }

  if (isError || !stats) {
    return (
      <ProgressionEmptyState
        icon="wifi-off"
        title="Statistics Unavailable"
        body="Your stats could not be loaded right now."
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={WORLDS_PURPLE} />}
    >
      <StatisticsCard stats={stats} />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileAchievementsScreen() {
  const colors = useColors();
  const [section, setSection] = useState<ProgressionSection>('overview');

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/quest');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Achievements</Text>
      </View>

      {/* Section nav */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navBar}
        style={[styles.navScroll, { borderBottomColor: colors.border }]}
      >
        {NAV_SECTIONS.map(s => {
          const isActive = s.key === section;
          return (
            <Pressable
              key={s.key}
              style={[styles.navTab, isActive && [styles.navTabActive, { borderBottomColor: WORLDS_PURPLE }]]}
              onPress={() => setSection(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={s.label}
            >
              <Text style={[
                styles.navTabLabel,
                { color: isActive ? WORLDS_PURPLE : colors.mutedForeground,
                  fontFamily: isActive ? fontFamily.semiBold : fontFamily.regular },
              ]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Section content */}
      <View style={styles.content}>
        {section === 'overview'   && <OverviewSection />}
        {section === 'history'    && <HistorySection />}
        {section === 'titles'     && <TitlesSection />}
        {section === 'badges'     && <BadgesSection />}
        {section === 'statistics' && <StatisticsSection />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: spacing[1] },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  navScroll: { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
  navBar: { paddingHorizontal: spacing[4], gap: spacing[4] },
  navTab: {
    paddingVertical: spacing[3], paddingHorizontal: spacing[1],
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  navTabActive: {},
  navTabLabel: { fontSize: fontSize.sm },
  content: { flex: 1 },
  sectionContent: {
    paddingHorizontal: spacing[5], paddingTop: spacing[4],
    paddingBottom: spacing[10], gap: spacing[4],
  },
  sectionNote: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.55 },
  catPill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth,
  },
  catPillLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  loadMore: { alignItems: 'center', paddingVertical: spacing[5] },
  loadMoreLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
