/**
 * Quest Completion Detail — Worlds
 *
 * Full detail view for a successfully completed quest.
 * Owner-only. Points shown only after server confirmation.
 *
 * Does NOT expose:
 * - Internal review notes
 * - Reviewer identity
 * - Protected geofence geometry
 * - Raw proof storage paths
 * - Other users' activity
 */

import React from 'react';
import {
  Pressable,
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
import { useCompletionDetail } from '@/features/quests/hooks/useCompletionDetail';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import DifficultyBadge from '@/components/quest/DifficultyBadge';
import { CompletionDetailSkeleton } from '@/components/quest/ProgressSkeleton';
import ProgressEmptyState from '@/components/quest/ProgressEmptyState';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function QuestCompletionDetailScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();

  const { data: detail, isLoading, isError, refetch } = useCompletionDetail(
    typeof participationId === 'string' ? participationId : null
  );

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/quest/progress');
  }

  function handleViewProof() {
    router.push(`/quest-submission/${participationId}`);
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Completion</Text>
          <View style={{ width: 22 }} />
        </View>
        <CompletionDetailSkeleton />
      </View>
    );
  }

  if (isError || !detail) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Completion</Text>
          <View style={{ width: 22 }} />
        </View>
        <ProgressEmptyState
          icon="alert-circle"
          title="Not Available"
          body="This completion detail is not available or does not belong to your account."
          actionLabel="Back to Progress"
          onAction={() => router.replace('/quest/progress')}
        />
      </View>
    );
  }

  const { quest, completedAt, awardedPoints, rewardSnapshotPoints, completedSteps, proofSummary, hasReversal, occurrenceKey } = detail;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Completion</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Success badge */}
        <View style={styles.heroBadge}>
          <View style={[styles.heroIcon, { backgroundColor: colors.success + '18' }]}>
            <Feather name="check-circle" size={36} color={colors.success} />
          </View>
          <Text style={[styles.heroLabel, { color: colors.success }]}>Quest Completed</Text>
        </View>

        {/* Quest title + type */}
        <View style={styles.questHeader}>
          <Text style={[styles.questTitle, { color: colors.foreground }]}>
            {quest?.title ?? 'Quest'}
          </Text>
          <View style={styles.badgeRow}>
            {quest?.quest_type && <QuestTypeBadge questType={quest.quest_type} />}
            {quest?.difficulty && <DifficultyBadge difficulty={quest.difficulty} />}
          </View>
        </View>

        {/* Points card */}
        <View style={[styles.card, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          {hasReversal ? (
            <View style={{ gap: spacing[2] }}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Points Adjusted</Text>
              <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
                The points from this quest have been adjusted. See Quest Point History for details.
              </Text>
            </View>
          ) : awardedPoints != null ? (
            <>
              <Text style={[styles.cardLabel, { color: colors.primary }]}>Points Awarded</Text>
              <Text style={[styles.pointsValue, { color: colors.foreground }]}>
                +{awardedPoints.toLocaleString()}
              </Text>
              <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
                Confirmed and added to your balance.
              </Text>
            </>
          ) : rewardSnapshotPoints != null ? (
            <>
              <Text style={[styles.cardLabel, { color: colors.primary }]}>Reward</Text>
              <Text style={[styles.pointsValue, { color: colors.foreground }]}>
                {rewardSnapshotPoints.toLocaleString()} pts
              </Text>
              <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
                Points are awaiting final confirmation.
              </Text>
            </>
          ) : (
            <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
              Point award details are not available.
            </Text>
          )}
        </View>

        {/* Completion time */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Completed</Text>
          <Text style={[styles.dateValue, { color: colors.foreground }]}>{formatDate(completedAt)}</Text>
          <Text style={[styles.timeValue, { color: colors.mutedForeground }]}>{formatTime(completedAt)}</Text>
        </View>

        {/* Occurrence info */}
        {occurrenceKey && (
          <View style={[styles.infoRow, { borderColor: colors.border }]}>
            <Feather name="repeat" size={15} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {occurrenceKey.startsWith('daily:')
                ? `Daily Quest — ${occurrenceKey.split(':')[2] ?? ''}`
                : occurrenceKey.startsWith('monthly:')
                ? `Monthly Drop — ${occurrenceKey.split(':')[2] ?? ''}`
                : occurrenceKey}
            </Text>
          </View>
        )}

        {/* Completed steps */}
        {completedSteps.length > 0 && (
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Completed Steps
            </Text>
            <View style={{ gap: spacing[3] }}>
              {completedSteps.map((step, i) => (
                <View key={step.stepId} style={styles.stepRow}>
                  <View style={[styles.stepCheck, { backgroundColor: colors.success + '18' }]}>
                    <Feather name="check" size={13} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                    {!step.isRequired && (
                      <Text style={[styles.stepOptional, { color: colors.mutedForeground }]}>Optional</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Proof summary */}
        {proofSummary && (
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Submission</Text>
            <View style={[styles.proofCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={styles.proofRow}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <Text style={[styles.proofStatus, { color: colors.foreground }]}>Proof approved</Text>
              </View>
              {proofSummary.textResponse && (
                <Text style={[styles.proofText, { color: colors.mutedForeground }]} numberOfLines={4}>
                  "{proofSummary.textResponse}"
                </Text>
              )}
              {proofSummary.locationVerified && (
                <View style={styles.proofRow}>
                  <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.proofMeta, { color: colors.mutedForeground }]}>
                    Location requirement verified
                  </Text>
                </View>
              )}
              {proofSummary.hasImage && (
                <View style={styles.proofRow}>
                  <Feather name="image" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.proofMeta, { color: colors.mutedForeground }]}>
                    Photo submitted
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              style={[styles.proofLink, { borderColor: colors.border }]}
              onPress={handleViewProof}
              accessibilityRole="button"
              accessibilityLabel="View submission history"
            >
              <Text style={[styles.proofLinkLabel, { color: colors.primary }]}>View submission history</Text>
              <Feather name="arrow-right" size={14} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {/* View quest link */}
        {quest?.slug && (
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Pressable
              style={[styles.viewQuestBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => { /* quest detail route from slug — not yet wired for archived quests */ }}
              accessibilityRole="button"
            >
              <Feather name="compass" size={16} color={colors.mutedForeground} />
              <Text style={[styles.viewQuestLabel, { color: colors.mutedForeground }]}>
                View Quest Details
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  content: {
    padding: spacing[5],
    gap: spacing[4],
    paddingBottom: spacing[12],
  },
  heroBadge: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  questHeader: {
    gap: spacing[2],
  },
  questTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.25,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  card: {
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[1],
  },
  cardLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pointsValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
  },
  cardNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  dateValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  timeValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  section: {
    gap: spacing[3],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  stepCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  stepOptional: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  proofCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  proofStatus: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  proofText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.55,
    fontStyle: 'italic',
  },
  proofMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  proofLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  proofLinkLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  viewQuestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewQuestLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    flex: 1,
  },
});
