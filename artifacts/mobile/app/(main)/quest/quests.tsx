/**
 * Quest — Quests Tab
 *
 * Browse all quest categories: Daily, Monthly Drop, Geo-Quest.
 * These are three sections within one screen — NOT separate bottom tabs.
 *
 * Does not include Discover or generalized recommendation categories.
 */

import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import { useAssignedDailyQuest, useDailyQuests, useMonthlyQuests, useGeoQuests } from '@/features/quests/hooks';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import DifficultyBadge from '@/components/quest/DifficultyBadge';
import DurationLabel from '@/components/quest/DurationLabel';
import PointsBadge from '@/components/ui/PointsBadge';
import AvailabilityNotice from '@/components/quest/AvailabilityNotice';
import LocationSummary from '@/components/quest/LocationSummary';
import { QuestCardSkeleton } from '@/components/quest/QuestSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import type { QuestRowExtended } from '@/features/quests/repositories/quest.repository';
import { useRevenueSummary } from '@/features/revenue/hooks/useRevenueSummary';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestSection = 'daily' | 'monthly' | 'geo';

// ─── Quest List Item ──────────────────────────────────────────────────────────

function QuestListItem({
  quest,
  showLocation = false,
  onPress,
}: {
  quest: QuestRowExtended;
  showLocation?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const typeColors = {
    daily:   colors.quest,
    monthly: colors.primary,
    geo:     colors.accent,
  };
  const accentColor = typeColors[quest.quest_type] ?? colors.primary;

  const location = (quest as QuestRowExtended & { quest_locations?: Array<{ display_name: string; address_hint?: string; public_lat?: number | null; public_lng?: number | null; public_radius_meters?: number | null }> })
    .quest_locations?.[0];

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={`${quest.title}. ${quest.quest_type} quest. ${quest.points_reward} points.`}
      accessibilityRole="button"
      activeOpacity={0.88}
      style={[
        itemStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.lg,
          ...shadows.sm,
        },
      ]}
    >
      {/* Left accent stripe */}
      <View style={[itemStyles.stripe, { backgroundColor: accentColor }]} />

      <View style={itemStyles.body}>
        {/* Top row: title + points */}
        <View style={itemStyles.topRow}>
          <Text
            style={[itemStyles.title, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {quest.title}
          </Text>
          <PointsBadge value={quest.points_reward} color={accentColor} size="sm" />
        </View>

        {/* Summary */}
        {quest.summary && (
          <Text
            style={[itemStyles.summary, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {quest.summary}
          </Text>
        )}

        {/* Location (geo quests) */}
        {showLocation && location && (
          <LocationSummary
            location={{
              id: '',
              quest_id: quest.id,
              display_name: location.display_name,
              public_lat: location.public_lat ?? null,
              public_lng: location.public_lng ?? null,
              public_radius_meters: location.public_radius_meters ?? null,
              address_hint: location.address_hint ?? null,
            }}
            compact
          />
        )}

        {/* Meta row */}
        <View style={itemStyles.metaRow}>
          <DurationLabel estimatedMinutes={quest.estimated_duration_minutes} size="sm" />
          <DifficultyBadge difficulty={quest.difficulty} size="sm" />
          {quest.available_from || quest.available_until ? (
            <AvailabilityNotice state="available" compact />
          ) : null}
        </View>
      </View>

      <Feather name="chevron-right" size={18} color={colors.border} style={itemStyles.chevron} />
    </TouchableOpacity>
  );
}

const itemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    gap: spacing[2],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.3,
  },
  summary: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  chevron: {
    alignSelf: 'center',
    marginRight: spacing[3],
  },
});

// ─── Section Tab ──────────────────────────────────────────────────────────────

function SectionTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        tabStyles.tab,
        {
          backgroundColor: active ? colors.primary : 'transparent',
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          tabStyles.label,
          {
            color: active ? colors.primaryForeground : colors.mutedForeground,
            fontFamily: active ? fontFamily.semiBold : fontFamily.regular,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const tabStyles = StyleSheet.create({
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  label: {
    fontSize: fontSize.sm,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function QuestListScreen() {
  const router = useRouter();
  const colors = useColors();
  const [activeSection, setActiveSection] = useState<QuestSection>('daily');

  const dailyQuery = useDailyQuests();
  const assignedDailyQuery = useAssignedDailyQuest();
  const monthlyQuery = useMonthlyQuests();
  const geoQuery = useGeoQuests();
  const revenueSummary = useRevenueSummary();

  const activeQuery =
    activeSection === 'daily'   ? dailyQuery :
    activeSection === 'monthly' ? monthlyQuery :
    geoQuery;

  const handleRefresh = useCallback(() => {
    void dailyQuery.refetch();
    void assignedDailyQuery.refetch();
    void monthlyQuery.refetch();
    void geoQuery.refetch();
  }, [dailyQuery, assignedDailyQuery, monthlyQuery, geoQuery]);

  const handleQuestPress = useCallback(
    (questId: string) => router.push(`/quest-detail/${questId}`),
    [router]
  );

  const quests: QuestRowExtended[] = activeSection === 'daily' && assignedDailyQuery.data
    ? [
      assignedDailyQuery.data,
      ...((dailyQuery.data ?? []) as QuestRowExtended[]).filter((quest) => quest.id !== assignedDailyQuery.data?.id),
    ]
    : (activeQuery.data ?? []) as QuestRowExtended[];
  const allowanceKind = activeSection === 'monthly'
    ? 'quest_monthly'
    : activeSection === 'geo'
      ? 'quest_geo_weekly'
      : 'quest_personalized_daily';
  const allowance = revenueSummary.data?.allowances.find((item) => item.kind === allowanceKind);
  const showMembershipUpsell = revenueSummary.data?.planCode === 'free'
    && !!allowance && allowance.remaining <= 1;

  // Empty state configs per section
  const emptyConfig = {
    daily: {
      icon: 'sun' as const,
      title: 'No Daily Quest Available',
      description: 'No Daily Quest is available right now. Check back soon.',
    },
    monthly: {
      icon: 'star' as const,
      title: 'No Monthly Quest',
      description: 'The next Monthly Quest Drop is being prepared.',
    },
    geo: {
      icon: 'map-pin' as const,
      title: 'No Geo-Quests Nearby',
      description: 'Browse public Geo-Quests here. Enable location only to sort nearby results.',
    },
  }[activeSection];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Section tabs ─────────────────────────────────────── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          <SectionTab
            label="Daily"
            active={activeSection === 'daily'}
            onPress={() => setActiveSection('daily')}
          />
          <SectionTab
            label="Monthly Drop"
            active={activeSection === 'monthly'}
            onPress={() => setActiveSection('monthly')}
          />
          <SectionTab
            label="Geo-Quests"
            active={activeSection === 'geo'}
            onPress={() => setActiveSection('geo')}
          />
        </ScrollView>
      </View>

      {/* ── Quest list ────────────────────────────────────────── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={activeQuery.isFetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Section header */}
        <View style={styles.sectionHeader}>
          <QuestTypeBadge questType={activeSection} />
          {quests.length > 0 && (
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {quests.length} quest{quests.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Loading */}
        {activeQuery.isLoading && (
          <View style={styles.skeletons}>
            {[0, 1, 2].map(i => <QuestCardSkeleton key={i} />)}
          </View>
        )}

        {/* Error */}
        {activeQuery.isError && !activeQuery.isLoading && (
          <EmptyState
            icon="wifi-off"
            title="Couldn't load quests"
            description="Pull down to retry."
            action={{ label: 'Retry', onPress: handleRefresh }}
          />
        )}

        {/* Empty */}
        {!activeQuery.isLoading && !activeQuery.isError && quests.length === 0 && (
          <EmptyState
            icon={emptyConfig.icon}
            title={emptyConfig.title}
            description={emptyConfig.description}
          />
        )}

        {/* Quest list */}
        {!activeQuery.isLoading && quests.map(quest => (
          <View key={quest.id} style={styles.itemWrapper}>
            <QuestListItem
              quest={quest}
              showLocation={activeSection === 'geo'}
              onPress={() => handleQuestPress(quest.id)}
            />
          </View>
        ))}
        {showMembershipUpsell && (
          <TouchableOpacity
            onPress={() => router.push('/(main)/membership')}
            style={[styles.membershipUpsell, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '45' }]}
            accessibilityRole="button"
            accessibilityLabel="View Worlds Membership options"
          >
            <Feather name="star" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.upsellTitle, { color: colors.foreground }]}>Make room for more Quests</Text>
              <Text style={[styles.upsellBody, { color: colors.mutedForeground }]}>
                {allowance.remaining === 0
                  ? 'Your included Free-plan access for this period is used. Worlds Membership expands Quest allowances.'
                  : `${allowance.remaining} included Quest remains this period. Worlds Membership expands Quest allowances.`}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        <View style={{ height: spacing[20] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarContent: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[2],
    flexDirection: 'row',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  count: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  skeletons: {
    gap: spacing[3],
  },
  itemWrapper: {
    marginBottom: spacing[3],
  },
  membershipUpsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginTop: spacing[2],
  },
  upsellTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  upsellBody: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18, marginTop: 3 },
});
