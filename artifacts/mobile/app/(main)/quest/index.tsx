/**
 * Quest Home Screen — Worlds
 *
 * Priority order (from spec):
 *   1. Proof requiring resubmission (most urgent)
 *   2. Active quest requiring user action
 *   3. Active quest in progress
 *   4. Proof under review
 *   5. Prioritized current Daily Quest (when no active participation)
 *   6. Useful empty state
 *
 * Supporting sections always render below the dominant panel:
 *   - Daily Quest summary
 *   - Monthly Quest Drop summary
 *   - Geo-Quest preview
 *   - Personal point summary
 */

import React, { useCallback, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  useActiveQuest,
  useDailyQuests,
  useAssignedDailyQuest,
  useMonthlyQuests,
  useGeoQuests,
  useHomeQuestSummary,
} from '@/features/quests/hooks';
import { participationUrgencyRank } from '@/features/quests/utils/questActionResolver';
import ActiveQuestPanel from '@/components/quest/ActiveQuestPanel';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import DifficultyBadge from '@/components/quest/DifficultyBadge';
import DurationLabel from '@/components/quest/DurationLabel';
import AvailabilityNotice from '@/components/quest/AvailabilityNotice';
import PointsBadge from '@/components/ui/PointsBadge';
import { HomeQuestSkeleton } from '@/components/quest/QuestSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import type { QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import type { QuestRowExtended } from '@/features/quests/repositories/quest.repository';
import type { ParticipationStatus } from '@/lib/supabase/database.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map participation status to availability state for display */
function participationToAvailabilityState(status: ParticipationStatus) {
  switch (status) {
    case 'started':        return 'active' as const;
    case 'in_progress':    return 'active' as const;
    case 'awaiting_proof': return 'awaiting_proof' as const;
    case 'under_review':   return 'under_review' as const;
    case 'needs_resubmission': return 'needs_resubmission' as const;
    default:               return 'active' as const;
  }
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  const colors = useColors();
  return (
    <View style={sectionStyles.header}>
      <Text style={[sectionStyles.title, { color: colors.foreground }]}>{title}</Text>
      {onMore && (
        <Pressable onPress={onMore} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[sectionStyles.more, { color: colors.primary }]}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  more: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});

// ─── Daily Quest Card ─────────────────────────────────────────────────────────

function DailyQuestCard({
  quest,
  onPress,
}: {
  quest: QuestRowExtended;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Daily Quest: ${quest.title}. Tap to view.`}
      accessibilityRole="button"
      style={({ pressed }) => [
        cardStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.quest + '30',
          borderRadius: radius.xl,
          opacity: pressed ? 0.94 : 1,
          ...shadows.sm,
        },
      ]}
    >
      {/* Label */}
      <View style={cardStyles.labelRow}>
        <QuestTypeBadge questType="daily" size="sm" />
        <AvailabilityNotice state="available" compact />
      </View>

      <Text style={[cardStyles.title, { color: colors.foreground }]} numberOfLines={2}>
        {quest.title}
      </Text>

      {quest.summary && (
        <Text style={[cardStyles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>
          {quest.summary}
        </Text>
      )}

      <View style={cardStyles.metaRow}>
        <PointsBadge value={quest.points_reward} color={colors.quest} size="sm" />
        <DurationLabel estimatedMinutes={quest.estimated_duration_minutes} size="sm" />
        <DifficultyBadge difficulty={quest.difficulty} size="sm" />
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    padding: spacing[4],
    gap: spacing[2.5],
    borderWidth: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.3,
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
});

// ─── Monthly Quest Card ────────────────────────────────────────────────────────

function MonthlyQuestCard({
  quest,
  onPress,
}: {
  quest: QuestRowExtended;
  onPress: () => void;
}) {
  const colors = useColors();
  const until = quest.available_until;
  const untilDate = until
    ? new Date(until).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Monthly Quest Drop: ${quest.title}. Tap to view.`}
      accessibilityRole="button"
      style={({ pressed }) => [
        monthlyStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.primary + '25',
          borderRadius: radius.xl,
          opacity: pressed ? 0.94 : 1,
          ...shadows.sm,
        },
      ]}
    >
      {/* Accent bar */}
      <View style={[monthlyStyles.accent, { backgroundColor: colors.primary }]} />

      <View style={monthlyStyles.body}>
        <View style={monthlyStyles.topRow}>
          <QuestTypeBadge questType="monthly" size="sm" />
          {untilDate && (
            <Text style={[monthlyStyles.until, { color: colors.mutedForeground }]}>
              Until {untilDate}
            </Text>
          )}
        </View>
        <Text style={[monthlyStyles.title, { color: colors.foreground }]} numberOfLines={2}>
          {quest.title}
        </Text>
        {quest.summary && (
          <Text style={[monthlyStyles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>
            {quest.summary}
          </Text>
        )}
        <View style={monthlyStyles.metaRow}>
          <PointsBadge value={quest.points_reward} color={colors.primary} size="sm" />
          <DifficultyBadge difficulty={quest.difficulty} size="sm" />
        </View>
      </View>
    </Pressable>
  );
}

const monthlyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
  },
  accent: {
    width: 5,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.3,
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
  },
  until: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});

// ─── Geo Quest Preview Card ────────────────────────────────────────────────────

function GeoQuestPreviewCard({
  quest,
  onPress,
}: {
  quest: QuestRowExtended;
  onPress: () => void;
}) {
  const colors = useColors();
  const locationName = (quest as QuestRowExtended & { quest_locations?: Array<{ display_name: string }> })
    .quest_locations?.[0]?.display_name;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Geo-Quest: ${quest.title}. Tap to view.`}
      accessibilityRole="button"
      style={({ pressed }) => [
        geoStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[geoStyles.pinWrap, { backgroundColor: colors.accent + '15' }]}>
        <Feather name="map-pin" size={20} color={colors.accent} />
      </View>
      <View style={geoStyles.text}>
        <Text style={[geoStyles.title, { color: colors.foreground }]} numberOfLines={1}>
          {quest.title}
        </Text>
        {locationName && (
          <Text style={[geoStyles.location, { color: colors.mutedForeground }]} numberOfLines={1}>
            {locationName}
          </Text>
        )}
        <View style={geoStyles.meta}>
          <PointsBadge value={quest.points_reward} color={colors.accent} size="sm" />
          <DifficultyBadge difficulty={quest.difficulty} size="sm" />
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.border} />
    </Pressable>
  );
}

const geoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: StyleSheet.hairlineWidth,
  },
  pinWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  location: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[0.5],
  },
});

// ─── Points Summary ────────────────────────────────────────────────────────────

function PointsSummaryBar({ totalPoints }: { totalPoints: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        pointStyles.container,
        { backgroundColor: colors.secondary, borderRadius: radius.lg },
      ]}
      accessibilityLabel={`Total points: ${totalPoints.toLocaleString()}`}
    >
      <View style={pointStyles.row}>
        <Feather name="award" size={18} color={colors.primary} />
        <Text style={[pointStyles.label, { color: colors.mutedForeground }]}>
          Total Points
        </Text>
        <Text style={[pointStyles.value, { color: colors.primary }]}>
          {totalPoints.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const pointStyles = StyleSheet.create({
  container: {
    padding: spacing[3.5],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  value: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function QuestHomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { profile } = useAuth();

  const activeQuery = useActiveQuest();
  const dailyQuery = useDailyQuests();
  const assignedDailyQuery = useAssignedDailyQuest();
  const monthlyQuery = useMonthlyQuests();
  const geoQuery = useGeoQuests();
  const summaryQuery = useHomeQuestSummary(new Set());

  const isLoading =
    activeQuery.isLoading || dailyQuery.isLoading || assignedDailyQuery.isLoading;

  const isRefreshing =
    activeQuery.isFetching || dailyQuery.isFetching || assignedDailyQuery.isFetching ||
    monthlyQuery.isFetching || geoQuery.isFetching;

  const handleRefresh = useCallback(() => {
    void activeQuery.refetch();
    void dailyQuery.refetch();
    void monthlyQuery.refetch();
    void geoQuery.refetch();
    void summaryQuery.refetch();
  }, [activeQuery, dailyQuery, monthlyQuery, geoQuery, summaryQuery]);

  // Pick the most urgent active participation
  const dominantParticipation = useMemo<QuestParticipationRowExtended | null>(() => {
    const participations = activeQuery.data ?? [];
    if (participations.length === 0) return null;
    return [...participations].sort(
      (a, b) => participationUrgencyRank(b.status) - participationUrgencyRank(a.status)
    )[0] ?? null;
  }, [activeQuery.data]);

  const dominantDaily = assignedDailyQuery.data ?? null;

  const dominantMonthly = useMemo<QuestRowExtended | null>(() => {
    const quests = monthlyQuery.data ?? [];
    return quests[0] ?? null;
  }, [monthlyQuery.data]);

  const geoQuests = useMemo(() => (geoQuery.data ?? []).slice(0, 3), [geoQuery.data]);

  const handleNavigateToQuestDetail = useCallback(
    (questId: string) => router.push(`/quest-detail/${questId}`),
    [router]
  );

  const handleNavigateToActiveQuest = useCallback(
    (participationId: string) => router.push(`/quest-active/${participationId}`),
    [router]
  );

  if (isLoading) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeQuestSkeleton />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.quest}
        />
      }
    >
      {/* ── Dominant Panel ──────────────────────────────────────────── */}
      {dominantParticipation ? (
        <View style={styles.section}>
          <ActiveQuestPanel
            title={dominantParticipation.quest_id}  // quest title resolved by active screen
            questType="daily"                        // resolved from participation data
            availabilityState={participationToAvailabilityState(dominantParticipation.status)}
            participationStatus={dominantParticipation.status}
            pointsSnapshot={dominantParticipation.reward_snapshot_points ?? 0}
            onPress={() => handleNavigateToActiveQuest(dominantParticipation.id)}
          />
        </View>
      ) : dominantDaily ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Today's Quest
          </Text>
          <DailyQuestCard
            quest={dominantDaily}
            onPress={() => handleNavigateToQuestDetail(dominantDaily.id)}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <EmptyState
            icon="compass"
            title="No Active Quest"
            description="Choose a Quest to begin your next activity."
            action={{ label: 'Browse Quests', onPress: () => router.push('/quest/quests') }}
            fullHeight={false}
          />
        </View>
      )}

      {/* ── Daily Quest Summary ─────────────────────────────────────── */}
      {dominantDaily && !dominantParticipation && null /* already shown above */}
      {dominantDaily && dominantParticipation && (
        <View style={styles.section}>
          <SectionHeader
            title="Daily Quest"
            onMore={() => router.push('/quest/quests')}
          />
          <DailyQuestCard
            quest={dominantDaily}
            onPress={() => handleNavigateToQuestDetail(dominantDaily.id)}
          />
        </View>
      )}

      {/* ── Monthly Quest Drop ──────────────────────────────────────── */}
      {dominantMonthly && (
        <View style={styles.section}>
          <SectionHeader title="Monthly Quest Drop" />
          <MonthlyQuestCard
            quest={dominantMonthly}
            onPress={() => handleNavigateToQuestDetail(dominantMonthly.id)}
          />
        </View>
      )}

      {!dominantMonthly && !monthlyQuery.isLoading && (
        <View style={styles.section}>
          <SectionHeader title="Monthly Quest Drop" />
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
              The next Monthly Quest Drop is being prepared.
            </Text>
          </View>
        </View>
      )}

      {/* ── Geo-Quest Preview ────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          title="Geo-Quests"
          onMore={() => router.push('/quest/quests')}
        />
        {geoQuests.length > 0 ? (
          <View style={styles.geoList}>
            {geoQuests.map(q => (
              <GeoQuestPreviewCard
                key={q.id}
                quest={q}
                onPress={() => handleNavigateToQuestDetail(q.id)}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="map-pin" size={20} color={colors.mutedForeground} style={{ marginBottom: spacing[1] }} />
            <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
              Enable location to see nearby Geo-Quests.
            </Text>
          </View>
        )}
      </View>

      {/* ── Points Summary ───────────────────────────────────────────── */}
      {((profile as unknown as { total_points?: number })?.total_points ?? 0) > 0 && (
        <View style={styles.section}>
          <PointsSummaryBar totalPoints={(profile as unknown as { total_points?: number })?.total_points ?? 0} />
        </View>
      )}

      <View style={{ height: spacing[12] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  emptyCard: {
    padding: spacing[5],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: spacing[1],
  },
  emptyCardText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  geoList: {
    gap: spacing[2],
  },
});
