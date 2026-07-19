/**
 * Active Quest Screen — Worlds
 *
 * Shown during an active participation. Displays current state, current
 * objective, step progress, and the primary action for the user's state.
 *
 * Rules:
 * - Never raw-read Supabase here — all data comes from domain hooks.
 * - Abandon requires explicit confirmation before calling.
 * - Points are NOT shown here — only shown after confirmed completion.
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  useQuestDetail,
  useQuestProgress,
  useAbandonQuest,
} from '@/features/quests/hooks';
import { useQuery } from '@tanstack/react-query';
import { questKeys } from '@/features/quests/queries/questKeys';
import { fetchParticipationById } from '@/features/quests/repositories/quest.repository';
import { resolveQuestAction } from '@/features/quests/utils/questActionResolver';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import AvailabilityNotice from '@/components/quest/AvailabilityNotice';
import QuestStepList from '@/components/quest/QuestStepList';
import QuestObjectiveView from '@/components/quest/QuestObjectiveView';
import ProofRequirementSummary from '@/components/quest/ProofRequirementSummary';
import SafetyNotice from '@/components/quest/SafetyNotice';
import PointsBadge from '@/components/ui/PointsBadge';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import type { QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import type { QuestAvailabilityState } from '@/features/quests/types/quest.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusToAvailabilityState(status: string): QuestAvailabilityState {
  switch (status) {
    case 'started':            return 'active';
    case 'in_progress':        return 'active';
    case 'awaiting_proof':     return 'awaiting_proof';
    case 'under_review':       return 'under_review';
    case 'needs_resubmission': return 'needs_resubmission';
    case 'completed':          return 'completed';
    default:                   return 'active';
  }
}

function deadline(until: string | null | undefined) {
  if (!until) return null;
  const d = new Date(until);
  const hoursLeft = (d.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 0) return 'Expired';
  if (hoursLeft < 1) return `${Math.round(hoursLeft * 60)} min left`;
  if (hoursLeft < 24) return `${Math.round(hoursLeft)} hours left`;
  const days = Math.ceil(hoursLeft / 24);
  return `${days} day${days === 1 ? '' : 's'} left`;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function ActiveHeader({
  onBack,
  onAbandon,
}: {
  onBack: () => void;
  onAbandon: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[hStyles.row, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onBack}
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>

      <Text style={[hStyles.title, { color: colors.foreground }]}>Active Quest</Text>

      <Pressable
        onPress={onAbandon}
        accessibilityLabel="Abandon quest"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Feather name="more-horizontal" size={22} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const hStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ActiveQuestScreen() {
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();

  const [showAbandonModal, setShowAbandonModal] = useState(false);

  // Load participation
  const participationQuery = useQuery<QuestParticipationRowExtended | null>({
    queryKey: questKeys.participation(participationId ?? ''),
    queryFn: () => fetchParticipationById(participationId!),
    enabled: !!participationId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const participation = participationQuery.data;

  // Load quest detail using quest_id from participation
  const questId = participation?.quest_id;
  const detailQuery = useQuestDetail(questId);
  const progressQuery = useQuestProgress(participationId);

  const quest = detailQuery.data;
  const stepProgress = progressQuery.data ?? [];

  const abandonMutation = useAbandonQuest(questId ?? '', {
    onSuccess: result => {
      if (result.success) {
        router.replace('/quest');
      } else {
        Alert.alert('Could not abandon', result.error?.message ?? 'Please try again.');
      }
    },
    onError: () => Alert.alert('Error', 'Could not abandon quest.'),
  });

  const handleAbandon = useCallback(() => {
    setShowAbandonModal(false);
    abandonMutation.mutate(participationId!);
  }, [abandonMutation, participationId]);

  const handleAction = useCallback(() => {
    if (!participation || !quest) return;
    switch (participation.status) {
      case 'awaiting_proof':
      case 'needs_resubmission':
        router.push(`/quest-proof/${participationId}`);
        break;
      case 'under_review':
        router.push(`/quest-proof/${participationId}`);
        break;
      case 'completed':
        router.replace(`/quest-completion/${participationId}`);
        break;
    }
  }, [participation, quest, participationId, router]);

  const handleRefresh = useCallback(() => {
    void participationQuery.refetch();
    void detailQuery.refetch();
    void progressQuery.refetch();
  }, [participationQuery, detailQuery, progressQuery]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  const isLoading = participationQuery.isLoading || (!!questId && detailQuery.isLoading);

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActiveHeader onBack={() => router.back()} onAbandon={() => setShowAbandonModal(true)} />
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading quest…</Text>
        </View>
      </View>
    );
  }

  if (!participation || !quest) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActiveHeader onBack={() => router.back()} onAbandon={() => {}} />
        <View style={styles.loading}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
            Quest data unavailable.
          </Text>
          <TouchableOpacity
            onPress={() => void participationQuery.refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.semiBold }}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const availabilityState = statusToAvailabilityState(participation.status);
  const action = resolveQuestAction({
    availabilityState,
    participationStatus: participation.status,
  });

  const objectives = [...(quest.quest_objectives ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  // current_step_id is not in the DB schema; derive from step progress instead
  const firstIncompleteObjective = objectives.find(o => {
    const progress = stepProgress.find(p => p.quest_step_id === o.id);
    return !progress || progress.status !== 'completed';
  });
  const currentStepId = firstIncompleteObjective?.id ?? null;
  const currentObjective = (currentStepId ? objectives.find(o => o.id === currentStepId) : null) ?? objectives[0] ?? null;

  const typeColors = { daily: colors.quest, monthly: colors.primary, geo: colors.accent };
  const accentColor = typeColors[quest.quest_type] ?? colors.primary;

  const pointsSnapshot = participation.reward_snapshot_points ?? quest.points_reward;
  const deadlineText = deadline(participation.expires_at);

  const isTerminal = ['completed', 'abandoned', 'expired'].includes(participation.status);
  const showAction = !isTerminal && action.actionType !== 'view' && action.actionType !== 'unavailable';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ActiveHeader
        onBack={() => router.back()}
        onAbandon={() => setShowAbandonModal(true)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={participationQuery.isFetching}
            onRefresh={handleRefresh}
            tintColor={accentColor}
          />
        }
      >
        {/* ── Status banner ──────────────────────────────────────── */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: accentColor + '10', borderColor: accentColor + '30' },
          ]}
        >
          <View style={styles.statusLeft}>
            <QuestTypeBadge questType={quest.quest_type} size="sm" />
            <AvailabilityNotice state={availabilityState} compact />
          </View>
          {deadlineText && (
            <View style={styles.deadlineRow}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={[styles.deadlineText, { color: colors.mutedForeground }]}>
                {deadlineText}
              </Text>
            </View>
          )}
        </View>

        {/* ── Quest title ────────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.foreground }]}>{quest.title}</Text>
          <PointsBadge value={pointsSnapshot} color={accentColor} />
        </View>

        {/* ── Current objective ──────────────────────────────────── */}
        {currentObjective && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {objectives.length > 1 ? 'Current Step' : 'Your Objective'}
            </Text>
            <QuestObjectiveView
              objective={currentObjective}
              stepProgress={stepProgress.find(p => p.quest_step_id === currentObjective.id) ?? null}
              stepNumber={objectives.length > 1 ? objectives.indexOf(currentObjective) + 1 : undefined}
              isCurrentStep
              isFocused
            />
          </View>
        )}

        {/* ── Multi-step progress ─────────────────────────────────── */}
        {objectives.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              All Steps
            </Text>
            <QuestStepList
              objectives={objectives}
              stepProgress={stepProgress}
              currentStepId={currentStepId}
            />
          </View>
        )}

        {/* ── Proof requirement ──────────────────────────────────── */}
        {quest.proof_type !== 'none' && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Proof Required
            </Text>
            <ProofRequirementSummary
              proofType={quest.proof_type}
              completionMode={quest.completion_mode}
            />
          </View>
        )}

        {/* ── Safety ─────────────────────────────────────────────── */}
        {quest.safety_notes && (
          <View style={styles.section}>
            <SafetyNotice notes={quest.safety_notes} />
          </View>
        )}

        {/* ── Abandon link ───────────────────────────────────────── */}
        {!isTerminal && (
          <View style={styles.abandonRow}>
            <TouchableOpacity
              onPress={() => setShowAbandonModal(true)}
              disabled={abandonMutation.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.abandonText, { color: colors.mutedForeground }]}>
                Abandon this quest
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: showAction ? 100 : spacing[8] }} />
      </ScrollView>

      {/* ── Primary action ────────────────────────────────────────── */}
      {showAction && (
        <View
          style={[
            styles.actionBar,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            onPress={handleAction}
            disabled={!action.enabled}
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: action.enabled ? accentColor : colors.muted,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.actionLabel,
                { color: action.enabled ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {action.label}
            </Text>
            {action.enabled && (
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>
      )}

      {/* ── Abandon confirmation ──────────────────────────────────── */}
      <ConfirmationModal
        visible={showAbandonModal}
        title="Abandon Quest?"
        description="Your progress will be saved but this participation will be marked as abandoned. You may be able to start again later depending on the quest's settings."
        confirmLabel="Yes, Abandon"
        cancelLabel="Keep Going"
        onConfirm={handleAbandon}
        onCancel={() => setShowAbandonModal(false)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[4] },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    padding: spacing[8],
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  deadlineText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  titleSection: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * 1.2,
  },
  section: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  abandonRow: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  abandonText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
  actionBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
  },
  actionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
});
