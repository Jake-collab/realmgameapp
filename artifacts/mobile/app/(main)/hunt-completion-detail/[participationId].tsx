/**
 * Hunt Completion Detail Screen — Worlds (Prompt 14)
 *
 * Full view of a single completed Hunt participation.
 * Shows: completion stats, points, stop history, proof summary, group info.
 *
 * Route: /hunt-completion-detail/:participationId
 * Never shows locked clue content, private geometry, or reviewer identity.
 */

import React from 'react';
import {
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

import { useHuntCompletionDetail } from '@/features/hunts/hooks/useHuntCompletionDetail';
import { useHuntStopHistory }       from '@/features/hunts/hooks/useHuntStopHistory';
import HuntStopHistoryRow           from '@/components/hunt-progress/HuntStopHistoryRow';
import { HuntCompletionDetailSkeleton } from '@/components/hunt-progress/HuntProgressSkeleton';
import HuntProgressEmptyState       from '@/components/hunt-progress/HuntProgressEmptyState';

const HUNT_COLOR = '#059669';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function HuntCompletionDetailScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();

  const detail = useHuntCompletionDetail(participationId ?? null);
  const stops  = useHuntStopHistory(participationId ?? null);

  const isLoading = detail.isLoading || stops.isLoading;
  const isError   = detail.isError;

  function handleRefresh() {
    detail.refetch();
    stops.refetch();
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          Hunt Completion
        </Text>
      </View>

      {isLoading && (
        <ScrollView contentContainerStyle={styles.loadingPad}>
          <HuntCompletionDetailSkeleton />
        </ScrollView>
      )}

      {!isLoading && isError && (
        <HuntProgressEmptyState
          icon="wifi-off"
          title="Could Not Load Detail"
          body="This completion detail could not be loaded."
          actionLabel="Retry"
          onAction={handleRefresh}
        />
      )}

      {!isLoading && !isError && !detail.data && (
        <HuntProgressEmptyState
          icon="flag"
          title="Not Found"
          body="This Hunt completion could not be found."
          actionLabel="Back to Progress"
          onAction={() => router.replace('/hunt/progress')}
        />
      )}

      {!isLoading && !isError && detail.data && (() => {
        const d = detail.data;
        const stopList = stops.data ?? [];
        const required = stopList.filter(s => s.isRequired);
        const optional = stopList.filter(s => !s.isRequired && s.stopStatus === 'completed');

        return (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={HUNT_COLOR} />
            }
          >
            {/* Hunt title */}
            <Text style={[styles.huntTitle, { color: colors.foreground }]}>
              {d.huntTitle}
            </Text>
            {d.huntSummary && (
              <Text style={[styles.huntSummary, { color: colors.mutedForeground }]}>
                {d.huntSummary}
              </Text>
            )}

            {/* Completion banner */}
            <View style={[styles.completionBanner, { backgroundColor: HUNT_COLOR + '12', borderColor: HUNT_COLOR + '30' }]}>
              <View style={styles.bannerRow}>
                <View style={styles.bannerStat}>
                  <Text style={[styles.bannerLabel, { color: HUNT_COLOR }]}>Points Earned</Text>
                  <Text style={[styles.bannerValue, { color: colors.foreground }]}>
                    {d.awardedPoints != null ? d.awardedPoints.toLocaleString() : '—'}
                  </Text>
                </View>

                <View style={styles.bannerDivider} />

                <View style={styles.bannerStat}>
                  <Text style={[styles.bannerLabel, { color: HUNT_COLOR }]}>Stops</Text>
                  <Text style={[styles.bannerValue, { color: colors.foreground }]}>
                    {d.stopsCompleted}/{d.stopsRequired}
                  </Text>
                </View>

                {d.isGroup && (
                  <>
                    <View style={styles.bannerDivider} />
                    <View style={styles.bannerStat}>
                      <Text style={[styles.bannerLabel, { color: HUNT_COLOR }]}>Hunters</Text>
                      <Text style={[styles.bannerValue, { color: colors.foreground }]}>
                        {d.groupMemberCount}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {d.hasReversal && (
                <View style={[styles.reversalNotice, { backgroundColor: colors.warning + '18' }]}>
                  <Feather name="alert-triangle" size={14} color={colors.warning} />
                  <Text style={[styles.reversalText, { color: colors.warning }]}>
                    An adjustment was made to this reward. Check Point History for details.
                  </Text>
                </View>
              )}
            </View>

            {/* Meta */}
            <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.metaRow}>
                <Feather name="calendar" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  Completed {formatDate(d.completedAt)}
                </Text>
              </View>
              {d.startedAt && (
                <View style={styles.metaRow}>
                  <Feather name="clock" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.foreground }]}>
                    Started {formatDate(d.startedAt)}
                  </Text>
                </View>
              )}
              {d.isGroup && (
                <View style={styles.metaRow}>
                  <Feather name="users" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.foreground }]}>
                    Group hunt · {d.participationMode}
                  </Text>
                </View>
              )}
              <View style={styles.metaRow}>
                <Feather name="list" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {d.stopOrdering === 'ordered' ? 'Ordered stops' : 'Free-roam stops'}
                </Text>
              </View>
              {d.occurrenceLabel && (
                <View style={styles.metaRow}>
                  <Feather name="tag" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.foreground }]}>
                    {d.occurrenceLabel}
                  </Text>
                </View>
              )}
            </View>

            {/* Stop history */}
            {required.length > 0 && (
              <View style={{ gap: spacing[3] }}>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                  Required Stops ({d.stopsCompleted}/{d.stopsRequired})
                </Text>
                <View style={[styles.stopList, { borderColor: colors.border }]}>
                  {required.map((entry, i) => (
                    <View key={entry.stopProgressId}>
                      <HuntStopHistoryRow entry={entry} />
                      {i < required.length - 1 && (
                        <View style={[styles.stopSep, { backgroundColor: colors.border }]} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {optional.length > 0 && (
              <View style={{ gap: spacing[3] }}>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                  Bonus Stops ({optional.length})
                </Text>
                <View style={[styles.stopList, { borderColor: colors.border }]}>
                  {optional.map((entry, i) => (
                    <View key={entry.stopProgressId}>
                      <HuntStopHistoryRow entry={entry} />
                      {i < optional.length - 1 && (
                        <View style={[styles.stopSep, { backgroundColor: colors.border }]} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Submission history link */}
            <Pressable
              style={[styles.linkRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => router.push(`/hunt-submission-history/${participationId}`)}
              accessibilityRole="button"
              accessibilityLabel="View submission history for this Hunt"
            >
              <Feather name="file-text" size={16} color={HUNT_COLOR} />
              <Text style={[styles.linkLabel, { color: colors.foreground }]}>
                Proof Submission History
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Point history link */}
            <Pressable
              style={[styles.linkRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => router.push('/hunt-point-history')}
              accessibilityRole="button"
              accessibilityLabel="View Hunt point history"
            >
              <Feather name="list" size={16} color={HUNT_COLOR} />
              <Text style={[styles.linkLabel, { color: colors.foreground }]}>
                Hunt Point History
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          </ScrollView>
        );
      })()}
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
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, flex: 1 },
  loadingPad: { padding: spacing[5] },
  content: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[12] },
  huntTitle: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], lineHeight: fontSize['2xl'] * 1.25 },
  huntSummary: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.55 },
  completionBanner: {
    borderRadius: radius.xl, borderWidth: 1, padding: spacing[4], gap: spacing[3],
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerStat: { flex: 1, alignItems: 'center', gap: 3 },
  bannerLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  bannerValue: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'] },
  bannerDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: '#00000020' },
  reversalNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.md,
  },
  reversalText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, flex: 1 },
  metaCard: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4], gap: spacing[3],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  metaText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  sectionLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  stopList: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  stopSep: { height: StyleSheet.hairlineWidth, marginVertical: spacing[1] },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  linkLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
