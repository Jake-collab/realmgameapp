/**
 * Quest Completion Screen — Worlds
 *
 * Shown after a quest is fully completed and points are confirmed.
 *
 * Rules:
 * - Points are shown ONLY when QuestCompletionResult.success === true.
 * - Do NOT show points speculatively or from participation snapshot alone.
 * - No optimistic awarding — wait for confirmed server result.
 * - This screen is reached from: Active Quest button, notification deep link.
 */

import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuestDetail } from '@/features/quests/hooks';
import { questKeys } from '@/features/quests/queries/questKeys';
import { fetchParticipationById } from '@/features/quests/repositories/quest.repository';
import { useCompleteQuest } from '@/features/quests/hooks/useCompleteQuest';
import PointsBadge from '@/components/ui/PointsBadge';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import type { QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import type { QuestCompletionResult } from '@/features/quests/types/quest.types';

// ─── Point award section ──────────────────────────────────────────────────────

function PointsAward({ points, color }: { points: number; color: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        ptStyles.container,
        { backgroundColor: color + '15', borderColor: color + '30', borderRadius: radius.xl },
      ]}
      accessibilityLabel={`Points awarded: ${points.toLocaleString()}`}
    >
      <Feather name="award" size={28} color={color} />
      <Text style={[ptStyles.points, { color }]}>
        +{points.toLocaleString()}
      </Text>
      <Text style={[ptStyles.label, { color: colors.mutedForeground }]}>Points Awarded</Text>
    </View>
  );
}
const ptStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[6],
    borderWidth: 1,
  },
  points: {
    fontFamily: fontFamily.bold,
    fontSize: 48,
    lineHeight: 56,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function QuestCompletionScreen() {
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();

  // Load participation
  const participationQuery = useQuery<QuestParticipationRowExtended | null>({
    queryKey: questKeys.participation(participationId ?? ''),
    queryFn: () => fetchParticipationById(participationId!),
    enabled: !!participationId,
    staleTime: 5 * 60 * 1000,
  });

  const participation = participationQuery.data;
  const questId = participation?.quest_id ?? '';
  const detailQuery = useQuestDetail(questId || null);
  const quest = detailQuery.data;

  // If participation is 'completed' status but we still need server confirmation for points,
  // call completeQuest to get the authoritative result (idempotent)
  const [completionResult, setCompletionResult] = React.useState<QuestCompletionResult | null>(null);
  const completeMutation = useCompleteQuest({
    questId: questId ?? '',
    onSuccess: result => {
      setCompletionResult(result);
    },
  });

  useEffect(() => {
    if (
      participation?.status === 'completed' &&
      questId &&
      user?.id &&
      !completionResult &&
      !completeMutation.isPending
    ) {
      completeMutation.mutate(participationId!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participation?.status, questId, user?.id]);

  const typeColors = { daily: colors.quest, monthly: colors.primary, geo: colors.accent };
  const accentColor = quest ? (typeColors[quest.quest_type] ?? colors.primary) : colors.primary;

  const isLoading = participationQuery.isLoading || (!!questId && detailQuery.isLoading);
  const isConfirmingPoints = completeMutation.isPending;

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.loadingState}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading completion…
          </Text>
        </View>
      </View>
    );
  }

  // ── Under review — not yet awarded ──────────────────────────────────────────

  const underReview = participation?.status === 'under_review';
  const needsResubmission = participation?.status === 'needs_resubmission';

  if (underReview) {
    return (
      <UnderReviewView
        questTitle={quest?.title ?? 'Quest'}
        questType={quest?.quest_type ?? 'daily'}
        onDone={() => router.replace('/quest')}
      />
    );
  }

  if (needsResubmission) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Proof Needs Resubmission
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Please go back and resubmit your proof.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace(`/quest-proof/${participationId}`)}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.semiBold }}>
              Resubmit Proof
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────

  const isComplete = participation?.status === 'completed';
  const pointsFromResult = completionResult?.awardedPoints;
  const snapshotPoints = participation?.reward_snapshot_points ?? quest?.points_reward ?? 0;

  // Show points only if server confirmed the award
  const confirmedPoints = completionResult?.success ? pointsFromResult : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Back button — top left only */}
      <View style={styles.backRow}>
        <Pressable
          onPress={() => router.replace('/quest')}
          accessibilityLabel="Back to quests"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero ──────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: accentColor + '15' },
            ]}
          >
            <Feather
              name={isComplete ? 'check-circle' : 'clock'}
              size={60}
              color={accentColor}
            />
          </View>

          {quest && <QuestTypeBadge questType={quest.quest_type} />}

          <Text style={[styles.heading, { color: colors.foreground }]}>
            {isComplete ? 'Quest Complete!' : 'Proof Submitted'}
          </Text>

          {quest && (
            <Text style={[styles.questTitle, { color: colors.mutedForeground }]}>
              {quest.title}
            </Text>
          )}
        </View>

        {/* ── Points ─────────────────────────────────────────────── */}
        {isConfirmingPoints && (
          <View style={styles.section}>
            <View
              style={[
                styles.confirmingCard,
                { backgroundColor: colors.secondary, borderRadius: radius.xl },
              ]}
            >
              <Feather name="loader" size={20} color={colors.mutedForeground} />
              <Text style={[styles.confirmingText, { color: colors.mutedForeground }]}>
                Confirming points…
              </Text>
            </View>
          </View>
        )}

        {confirmedPoints != null && !isConfirmingPoints && (
          <View style={styles.section}>
            <PointsAward points={confirmedPoints} color={accentColor} />
          </View>
        )}

        {/* Points pending review */}
        {!confirmedPoints && !isConfirmingPoints && quest?.completion_mode === 'manual_review' && (
          <View style={styles.section}>
            <View
              style={[
                styles.pendingCard,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="clock" size={18} color={colors.primary} />
              <Text style={[styles.pendingText, { color: colors.mutedForeground }]}>
                Points will be awarded after reviewer approval.
              </Text>
            </View>
          </View>
        )}

        {/* ── Completion message ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {isComplete
              ? "Excellent work! Your quest has been completed and recorded."
              : "Your quest completion has been submitted for review."}
          </Text>
        </View>

        {/* ── Actions ───────────────────────────────────────────── */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.replace('/quest')}
            style={[styles.primaryBtn, { backgroundColor: accentColor }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Back to Quests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/quest/progress')}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              View Progress
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing[12] }} />
      </ScrollView>
    </View>
  );
}

// ─── Under Review View ────────────────────────────────────────────────────────

function UnderReviewView({
  questTitle,
  questType,
  onDone,
}: {
  questTitle: string;
  questType: string;
  onDone: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.backRow}>
        <Pressable
          onPress={onDone}
          accessibilityLabel="Done"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary + '15' }]}>
          <Feather name="clock" size={60} color={colors.primary} />
        </View>

        <Text style={[styles.heading, { color: colors.foreground }]}>Under Review</Text>
        <Text style={[styles.questTitle, { color: colors.mutedForeground }]}>{questTitle}</Text>

        <Text style={[styles.body, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Your proof is under review. You'll be notified when a decision is available.
          Points will be awarded if approved.
        </Text>

        <TouchableOpacity
          onPress={onDone}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backRow: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    alignItems: 'flex-end',
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: spacing[1],
  },
  hero: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
  heroIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
  },
  questTitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
  },
  section: {
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  confirmingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
  },
  confirmingText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.55,
  },
  actions: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  primaryBtn: {
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  secondaryBtn: {
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[4],
  },
});
