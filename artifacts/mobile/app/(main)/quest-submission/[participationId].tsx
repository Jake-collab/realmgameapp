/**
 * Quest Submission History — Worlds
 *
 * Private proof submission history for a participation.
 * Owner-only. Shows all submissions in chronological order.
 *
 * Does NOT expose:
 * - reviewer_id or reviewer identity
 * - raw moderation metadata
 * - automated risk scores
 * - other users' submissions
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useSubmissionHistory } from '@/features/quests/hooks/useSubmissionHistory';
import ReviewStatusTimeline from '@/components/quest/ReviewStatusTimeline';
import ProgressEmptyState from '@/components/quest/ProgressEmptyState';
import type { SubmissionHistoryItem } from '@/features/quests/types/questProgress.types';
import type { ProofSubmissionStatus, ProofType } from '@/lib/supabase/database.types';

function statusLabel(status: ProofSubmissionStatus): string {
  switch (status) {
    case 'draft':              return 'Draft';
    case 'uploading':          return 'Uploading';
    case 'submitted':          return 'Submitted';
    case 'under_review':       return 'Under Review';
    case 'approved':           return 'Approved';
    case 'rejected':           return 'Not Accepted';
    case 'needs_resubmission': return 'Resubmission Requested';
    default:                   return status;
  }
}

function statusColor(status: ProofSubmissionStatus, colors: ReturnType<typeof useColors>): string {
  switch (status) {
    case 'approved':           return colors.success;
    case 'needs_resubmission': return colors.warning;
    case 'rejected':           return colors.destructive;
    case 'under_review':       return colors.primary;
    default:                   return colors.mutedForeground;
  }
}

function proofTypeLabel(type: ProofType): string {
  switch (type) {
    case 'photo':    return 'Photo';
    case 'video':    return 'Video';
    case 'text':     return 'Text response';
    case 'location': return 'Location check-in';
    case 'qr_code':  return 'QR code';
    case 'none':     return 'Confirmation';
    default:         return type;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SubmissionCard({ sub }: { sub: SubmissionHistoryItem }) {
  const colors = useColors();
  const sc = statusColor(sub.status, colors);

  return (
    <View
      style={[
        styles.submissionCard,
        {
          backgroundColor: colors.card,
          borderColor: sub.isLatest ? sc + '44' : colors.border,
          borderLeftColor: sc,
        },
      ]}
    >
      {/* Header row */}
      <View style={styles.subHeader}>
        <Text style={[styles.subNumber, { color: colors.mutedForeground }]}>
          Submission #{sub.submissionNumber}
          {sub.isLatest ? ' (Latest)' : ''}
        </Text>
        <View style={[styles.subStatusPill, { backgroundColor: sc + '18' }]}>
          <Text style={[styles.subStatusLabel, { color: sc }]}>{statusLabel(sub.status)}</Text>
        </View>
      </View>

      {/* Proof type + date */}
      <View style={styles.subMeta}>
        <Feather name="file-text" size={13} color={colors.mutedForeground} />
        <Text style={[styles.subMetaText, { color: colors.mutedForeground }]}>
          {proofTypeLabel(sub.submissionType)}
        </Text>
        {sub.submittedAt && (
          <>
            <Text style={[styles.subMetaSep, { color: colors.border }]}>·</Text>
            <Text style={[styles.subMetaText, { color: colors.mutedForeground }]}>
              {formatDate(sub.submittedAt)}
            </Text>
          </>
        )}
      </View>

      {/* Text proof (user's own content — safe to display) */}
      {sub.textResponse && (
        <View style={[styles.textProofBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.textProofContent, { color: colors.foreground }]} numberOfLines={6}>
            {sub.textResponse}
          </Text>
        </View>
      )}

      {/* Image indicator */}
      {sub.hasImage && (
        <View style={styles.subMeta}>
          <Feather name="image" size={13} color={colors.mutedForeground} />
          <Text style={[styles.subMetaText, { color: colors.mutedForeground }]}>
            Photo submitted
          </Text>
        </View>
      )}

      {/* Location indicator */}
      {sub.locationVerified && (
        <View style={styles.subMeta}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.subMetaText, { color: colors.mutedForeground }]}>
            Location check-in provided
          </Text>
        </View>
      )}

      {/* Safe decision note (needs_resubmission only) */}
      {sub.safeDecisionNote && (
        <View style={[styles.decisionBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}>
          <Feather name="message-square" size={14} color={colors.warning} />
          <Text style={[styles.decisionText, { color: colors.foreground }]}>
            {sub.safeDecisionNote}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function QuestSubmissionScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();

  const { data: submissions = [], isLoading, isError, refetch } = useSubmissionHistory(
    typeof participationId === 'string' ? participationId : null
  );

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/quest/progress');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Submission History</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <Feather name="loader" size={24} color={colors.mutedForeground} />
        </View>
      ) : isError ? (
        <ProgressEmptyState
          icon="wifi-off"
          title="Could Not Load Submissions"
          body="Your submission history could not be retrieved."
          actionLabel="Retry"
          onAction={refetch}
        />
      ) : submissions.length === 0 ? (
        <ProgressEmptyState
          icon="upload"
          title="No Submissions"
          body="No proof submissions found for this participation."
          actionLabel="Back"
          onAction={handleBack}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Timeline */}
          <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Review Timeline</Text>
            <ReviewStatusTimeline submissions={submissions} />
          </View>

          {/* Individual submission cards */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Submissions ({submissions.length})
          </Text>
          {[...submissions].reverse().map(sub => (
            <SubmissionCard key={sub.submissionId} sub={sub} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
  timelineCard: {
    padding: spacing[4], borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, gap: spacing[3],
  },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  submissionCard: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4, padding: spacing[4], gap: spacing[3],
  },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subNumber: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  subStatusPill: {
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  subStatusLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  subMetaText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  subMetaSep: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginHorizontal: 2 },
  textProofBox: { padding: spacing[3], borderRadius: radius.md },
  textProofContent: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.55 },
  decisionBox: {
    flexDirection: 'row', gap: spacing[2], padding: spacing[3],
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
  },
  decisionText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5, flex: 1 },
});
