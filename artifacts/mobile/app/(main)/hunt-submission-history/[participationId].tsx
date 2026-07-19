/**
 * Hunt Submission History Screen — Worlds (Prompt 14)
 *
 * Owner-only proof submission history for a Hunt participation,
 * organized by stop. Shows status, type, and safe review explanation.
 *
 * Route: /hunt-submission-history/:participationId
 * Never shows reviewer identity, raw review_notes, or media URLs.
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

import { useHuntSubmissionHistory } from '@/features/hunts/hooks/useHuntSubmissionHistory';
import HuntProgressEmptyState       from '@/components/hunt-progress/HuntProgressEmptyState';
import { HuntCompletionDetailSkeleton } from '@/components/hunt-progress/HuntProgressSkeleton';

const HUNT_COLOR = '#059669';

function statusConfig(status: string, colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  switch (status) {
    case 'approved':             return { color: HUNT_COLOR,              icon: 'check-circle' as const };
    case 'rejected':             return { color: colors.destructive,      icon: 'x-circle' as const };
    case 'needs_resubmission':   return { color: colors.destructive,      icon: 'alert-circle' as const };
    case 'under_review':         return { color: colors.mutedForeground,  icon: 'clock' as const };
    case 'submitted':            return { color: colors.warning,          icon: 'upload' as const };
    default:                     return { color: colors.mutedForeground,  icon: 'circle' as const };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function HuntSubmissionHistoryScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();

  const history = useHuntSubmissionHistory(participationId ?? null);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/hunt/progress');
    }
  }

  // Group submissions by stop
  const byStop = (history.data ?? []).reduce<Record<string, typeof history.data & {}>>((acc, s) => {
    const key = s.huntStopId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const stopGroups = Object.entries(byStop);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          Submission History
        </Text>
      </View>

      {history.isLoading && (
        <ScrollView contentContainerStyle={styles.loadPad}>
          <HuntCompletionDetailSkeleton />
        </ScrollView>
      )}

      {!history.isLoading && history.isError && (
        <HuntProgressEmptyState
          icon="wifi-off"
          title="Could Not Load"
          body="Submission history could not be loaded."
          actionLabel="Retry"
          onAction={() => history.refetch()}
        />
      )}

      {!history.isLoading && !history.isError && stopGroups.length === 0 && (
        <HuntProgressEmptyState
          icon="file-text"
          title="No Submissions"
          body="No proof submissions have been made for this Hunt yet."
          actionLabel="Back"
          onAction={handleBack}
        />
      )}

      {!history.isLoading && !history.isError && stopGroups.length > 0 && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => history.refetch()} tintColor={HUNT_COLOR} />
          }
        >
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Proof submissions for each stop, oldest to newest.
          </Text>

          {stopGroups.map(([stopId, submissions]) => {
            const stopTitle = submissions[0]?.stopTitle ?? 'Stop';
            return (
              <View key={stopId} style={{ gap: spacing[3] }}>
                <Text style={[styles.stopHeading, { color: colors.foreground }]}>
                  {stopTitle}
                </Text>

                {submissions.map((sub, idx) => {
                  const sc = statusConfig(sub.status, colors);
                  return (
                    <View
                      key={sub.submissionId}
                      style={[
                        styles.subCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: sub.isLatest ? sc.color + '40' : colors.border,
                          borderLeftColor: sc.color,
                        },
                      ]}
                    >
                      {/* Status + number */}
                      <View style={styles.subHeader}>
                        <View style={[styles.statusPill, { backgroundColor: sc.color + '18' }]}>
                          <Feather name={sc.icon} size={12} color={sc.color} />
                          <Text style={[styles.statusText, { color: sc.color }]}>
                            {sub.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Text>
                        </View>
                        <Text style={[styles.subNumber, { color: colors.mutedForeground }]}>
                          #{idx + 1}{sub.isLatest ? ' · latest' : ''}
                        </Text>
                      </View>

                      {/* Submission type */}
                      <View style={styles.typeRow}>
                        {sub.hasTextResponse && (
                          <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
                            <Feather name="type" size={11} color={colors.mutedForeground} />
                            <Text style={[styles.typeText, { color: colors.mutedForeground }]}>Text</Text>
                          </View>
                        )}
                        {sub.hasImage && (
                          <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
                            <Feather name="image" size={11} color={colors.mutedForeground} />
                            <Text style={[styles.typeText, { color: colors.mutedForeground }]}>Image</Text>
                          </View>
                        )}
                        {sub.locationVerified && (
                          <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
                            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                            <Text style={[styles.typeText, { color: colors.mutedForeground }]}>Location</Text>
                          </View>
                        )}
                      </View>

                      {/* Safe review explanation */}
                      {sub.safeReviewExplanation && (
                        <View style={[styles.noteBox, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.noteText, { color: colors.foreground }]}>
                            {sub.safeReviewExplanation}
                          </Text>
                        </View>
                      )}

                      {sub.submittedAt && (
                        <Text style={[styles.date, { color: colors.mutedForeground }]}>
                          {formatDate(sub.submittedAt)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
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
  content: { padding: spacing[5], gap: spacing[6], paddingBottom: spacing[12] },
  intro: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  stopHeading: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  subCard: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4, padding: spacing[4], gap: spacing[2],
  },
  subHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  statusText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  subNumber: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  typeRow: { flexDirection: 'row', gap: spacing[2] },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full,
  },
  typeText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  noteBox: { borderRadius: radius.md, padding: spacing[3] },
  noteText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
