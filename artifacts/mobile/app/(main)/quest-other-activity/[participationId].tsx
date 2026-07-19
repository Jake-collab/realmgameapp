/**
 * Quest Other Activity Detail — Worlds
 *
 * Detail view for an abandoned, expired, or finally-rejected participation.
 * Does NOT label these as completed. Does NOT show a celebration animation.
 * Does NOT reveal internal moderation records.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchOtherActivityParticipations } from '@/features/quests/repositories/questProgress.repository';
import { progressKeys } from '@/features/quests/queries/progressKeys';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import ProgressEmptyState from '@/components/quest/ProgressEmptyState';
import type { OtherActivityItem } from '@/features/quests/types/questProgress.types';
import type { ParticipationStatus } from '@/lib/supabase/database.types';

function statusLabel(status: ParticipationStatus): string {
  switch (status) {
    case 'abandoned': return 'Abandoned';
    case 'expired':   return 'Expired';
    case 'rejected':  return 'Rejected';
    default:          return status;
  }
}

function noPointsReason(status: ParticipationStatus): string {
  switch (status) {
    case 'abandoned': return 'This quest was abandoned before completion. No points are awarded for abandoned participations.';
    case 'expired':   return 'This participation expired before completion. No points are awarded for expired participations.';
    case 'rejected':  return 'The submitted proof was not accepted and there are no further resubmission opportunities. No points have been awarded.';
    default:          return 'Points are not awarded for this participation.';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function QuestOtherActivityScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  // Fetch the matching item from other activity list
  const { data: allItems, isLoading, isError } = useQuery<{ items: OtherActivityItem[]; hasMore: boolean }>({
    queryKey: progressKeys.otherActivity(userId),
    queryFn: () => fetchOtherActivityParticipations(userId, 1, 100),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 10 * 60 * 1000,
  });

  const item = allItems?.items.find(i => i.participationId === participationId) ?? null;

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/quest/progress');
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Activity</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingBox}>
          <Feather name="loader" size={24} color={colors.mutedForeground} />
        </View>
      </View>
    );
  }

  if (!item || isError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Activity</Text>
          <View style={{ width: 22 }} />
        </View>
        <ProgressEmptyState
          icon="alert-circle"
          title="Not Available"
          body="This activity record could not be found."
          actionLabel="Back to Progress"
          onAction={() => router.replace('/quest/progress')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {statusLabel(item.status)}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
          <Feather
            name={item.status === 'abandoned' ? 'minus-circle' : item.status === 'expired' ? 'clock' : 'x-circle'}
            size={18}
            color={colors.mutedForeground}
          />
          <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>
            {statusLabel(item.status)}
          </Text>
        </View>

        {/* Quest title */}
        <Text style={[styles.questTitle, { color: colors.foreground }]}>
          {item.quest?.title ?? 'Quest'}
        </Text>

        {item.quest?.quest_type && (
          <View style={{ alignSelf: 'flex-start' }}>
            <QuestTypeBadge questType={item.quest.quest_type} />
          </View>
        )}

        {/* Dates */}
        <View style={[styles.dateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Started</Text>
            <Text style={[styles.dateValue, { color: colors.foreground }]}>{formatDate(item.startedAt)}</Text>
          </View>
          {item.finalizedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                {item.status === 'abandoned' ? 'Abandoned' : item.status === 'expired' ? 'Expired' : 'Finalized'}
              </Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>{formatDate(item.finalizedAt)}</Text>
            </View>
          )}
        </View>

        {/* Points explanation */}
        <View style={[styles.explanationBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.explanationText, { color: colors.mutedForeground }]}>
            {noPointsReason(item.status)}
          </Text>
        </View>

        {/* Restart eligibility */}
        {item.canRestart && (
          <View style={[styles.restartBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Feather name="refresh-cw" size={16} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.restartTitle, { color: colors.primary }]}>Quest Restartable</Text>
              <Text style={[styles.restartBody, { color: colors.mutedForeground }]}>
                This quest can be started again. Find it in the Quests list.
              </Text>
            </View>
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
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    alignSelf: 'flex-start', paddingHorizontal: spacing[3],
    paddingVertical: spacing[2], borderRadius: radius.full,
  },
  statusLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  questTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.25 },
  dateCard: {
    padding: spacing[4], borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, gap: spacing[3],
  },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  dateValue: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, flex: 1, textAlign: 'right' },
  explanationBox: {
    flexDirection: 'row', gap: spacing[3], padding: spacing[4],
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  explanationText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.55, flex: 1 },
  restartBox: {
    flexDirection: 'row', gap: spacing[3], padding: spacing[4],
    borderRadius: radius.xl, borderWidth: 1, alignItems: 'flex-start',
  },
  restartTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  restartBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 },
});
