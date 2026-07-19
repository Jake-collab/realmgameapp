/**
 * Hunt Other Activity Detail Screen — Worlds (Prompt 14)
 *
 * Detail view for a withdrawn/removed/cancelled/expired Hunt participation.
 * Shows safe status note, stop progress (stops completed before ending).
 *
 * Route: /hunt-other-activity/:participationId
 * Never shows internal removal reasons or reviewer identity.
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

import { useHuntOtherActivity } from '@/features/hunts/hooks/useHuntOtherActivity';
import { useHuntStopHistory }   from '@/features/hunts/hooks/useHuntStopHistory';
import HuntStopHistoryRow       from '@/components/hunt-progress/HuntStopHistoryRow';
import HuntProgressEmptyState   from '@/components/hunt-progress/HuntProgressEmptyState';
import { HuntCompletionDetailSkeleton } from '@/components/hunt-progress/HuntProgressSkeleton';

const HUNT_COLOR = '#059669';

function statusDisplay(status: string): string {
  switch (status) {
    case 'withdrawn': return 'Withdrew';
    case 'removed':   return 'Removed';
    case 'cancelled': return 'Cancelled';
    case 'expired':   return 'Expired';
    default:          return 'Ended';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function HuntOtherActivityScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();

  // Load list and find the matching item
  const allActivity = useHuntOtherActivity();
  const stops       = useHuntStopHistory(participationId ?? null);

  const item = allActivity.data?.pages
    .flatMap(p => p.items)
    .find(i => i.participationId === participationId);

  const isLoading = (allActivity.isLoading && !item) || stops.isLoading;
  const isError   = allActivity.isError;

  function handleRefresh() {
    allActivity.refetch();
    stops.refetch();
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/hunt/progress');
    }
  }

  const completedStops = (stops.data ?? []).filter(s => s.stopStatus === 'completed');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          Other Activity
        </Text>
      </View>

      {isLoading && (
        <ScrollView contentContainerStyle={styles.loadPad}>
          <HuntCompletionDetailSkeleton />
        </ScrollView>
      )}

      {!isLoading && isError && (
        <HuntProgressEmptyState
          icon="wifi-off"
          title="Could Not Load"
          body="This activity detail could not be loaded."
          actionLabel="Retry"
          onAction={handleRefresh}
        />
      )}

      {!isLoading && !isError && !item && (
        <HuntProgressEmptyState
          icon="archive"
          title="Not Found"
          body="This Hunt activity could not be found."
          actionLabel="Back"
          onAction={handleBack}
        />
      )}

      {!isLoading && !isError && item && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={HUNT_COLOR} />
          }
        >
          {/* Title */}
          <Text style={[styles.huntTitle, { color: colors.foreground }]}>
            {item.huntTitle}
          </Text>

          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={styles.bannerRow}>
              <View style={styles.bannerStat}>
                <Text style={[styles.bannerLabel, { color: colors.mutedForeground }]}>Status</Text>
                <Text style={[styles.bannerValue, { color: colors.foreground }]}>
                  {statusDisplay(item.status)}
                </Text>
              </View>
              <View style={styles.bannerDivider} />
              <View style={styles.bannerStat}>
                <Text style={[styles.bannerLabel, { color: colors.mutedForeground }]}>Stops</Text>
                <Text style={[styles.bannerValue, { color: colors.foreground }]}>
                  {item.stopsCompleted}/{item.stopsRequired}
                </Text>
              </View>
            </View>

            {/* Safe note */}
            <Text style={[styles.safeNote, { color: colors.mutedForeground }]}>
              {item.safeStatusNote}
            </Text>
          </View>

          {/* Dates */}
          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {item.joinedAt && (
              <View style={styles.metaRow}>
                <Feather name="log-in" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  Joined {formatDate(item.joinedAt)}
                </Text>
              </View>
            )}
            {item.startedAt && (
              <View style={styles.metaRow}>
                <Feather name="play" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  Started {formatDate(item.startedAt)}
                </Text>
              </View>
            )}
            {item.finalizedAt && (
              <View style={styles.metaRow}>
                <Feather name="x-circle" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  Ended {formatDate(item.finalizedAt)}
                </Text>
              </View>
            )}
          </View>

          {/* Stops completed before ending */}
          {completedStops.length > 0 && (
            <View style={{ gap: spacing[3] }}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                Stops Completed ({completedStops.length})
              </Text>
              <View style={[styles.stopList, { borderColor: colors.border }]}>
                {completedStops.map((entry, i) => (
                  <View key={entry.stopProgressId}>
                    <HuntStopHistoryRow entry={entry} />
                    {i < completedStops.length - 1 && (
                      <View style={[styles.stopSep, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {completedStops.length === 0 && !stops.isLoading && (
            <Text style={[styles.noStops, { color: colors.mutedForeground }]}>
              No stops were completed before this participation ended.
            </Text>
          )}
        </ScrollView>
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
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, flex: 1 },
  loadPad: { padding: spacing[5] },
  content: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[12] },
  huntTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  statusBanner: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4], gap: spacing[3],
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerStat: { flex: 1, alignItems: 'center', gap: 3 },
  bannerLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerValue: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  bannerDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: '#00000020' },
  safeNote: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },
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
  noStops: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing[4] },
});
