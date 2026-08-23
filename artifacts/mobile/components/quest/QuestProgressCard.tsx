/**
 * QuestProgressCard — Reusable In Action card for all participation states.
 *
 * Variants: active | awaiting_proof | under_review | needs_resubmission | rejected | expiring
 * Uses resolveQuestAction for button label/type determination.
 */

import React from 'react';
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import QuestTypeBadge from './QuestTypeBadge';
import DifficultyBadge from './DifficultyBadge';
import { resolveQuestAction } from '@/features/quests/utils/questActionResolver';
import type { InActionItem } from '@/features/quests/types/questProgress.types';
import type { QuestAvailabilityState } from '@/features/quests/types/quest.types';

interface Props {
  item: InActionItem;
}

// Maps participation status to availability state for the action resolver
function statusToAvailability(status: string): QuestAvailabilityState {
  switch (status) {
    case 'started':
    case 'in_progress':       return 'active';
    case 'awaiting_proof':    return 'awaiting_proof';
    case 'under_review':      return 'under_review';
    case 'needs_resubmission':return 'needs_resubmission';
    case 'rejected':          return 'expired'; // final rejection
    default:                  return 'active';
  }
}

function statusConfig(status: string, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'needs_resubmission':
      return { color: colors.destructive,     icon: 'alert-circle' as const, label: 'Needs Resubmission' };
    case 'awaiting_proof':
      return { color: colors.warning,          icon: 'upload'        as const, label: 'Ready to Submit Proof' };
    case 'in_progress':
    case 'started':
      return { color: colors.primary,          icon: 'play-circle'   as const, label: 'In Progress' };
    case 'under_review':
      return { color: colors.mutedForeground,  icon: 'clock'         as const, label: 'Under Review' };
    case 'rejected':
      return { color: colors.destructive,      icon: 'x-circle'      as const, label: 'Rejected' };
    default:
      return { color: colors.primary,          icon: 'circle'        as const, label: status };
  }
}

function formatPoints(points: number | null): string {
  if (!points) return '';
  return `${points.toLocaleString()} pts`;
}

function deadlineWarning(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `Expires in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 3) return `Expires in ${diffDays}d`;
  return null;
}

export default function QuestProgressCard({ item }: Props) {
  const colors = useColors();
  const sc = statusConfig(item.status, colors);

  const action = resolveQuestAction({
    availabilityState: statusToAvailability(item.status),
    participationStatus: item.status as any,
  });

  const warning = deadlineWarning(item.expiresAt);

  function handleAction() {
    if (!action.enabled) return;
    switch (action.actionType) {
      case 'continue':
        router.push(`/quest-active/${item.participationId}`);
        break;
      case 'submit_proof':
      case 'resubmit':
      case 'view_submission':
        router.push(`/quest-proof/${item.participationId}`);
        break;
      default:
        router.push(`/quest-active/${item.participationId}`);
    }
  }

  const isUrgent = item.status === 'needs_resubmission' || item.status === 'awaiting_proof';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isUrgent ? sc.color + '44' : colors.border,
          borderLeftColor: sc.color,
        },
      ]}
      accessible
      accessibilityRole="none"
    >
      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: sc.color + '18' }]}>
          <Feather name={sc.icon} size={12} color={sc.color} />
          <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
        </View>
        {warning && (
          <View style={[styles.warningPill, { backgroundColor: colors.warning + '20' }]}>
            <Feather name="clock" size={11} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>{warning}</Text>
          </View>
        )}
      </View>

      {/* Quest title + type */}
      <Text
        style={[styles.title, { color: colors.foreground }]}
        numberOfLines={2}
        accessibilityLabel={`Quest: ${item.quest?.title ?? 'Unknown Quest'}`}
      >
        {item.quest?.title ?? 'Quest'}
      </Text>

      {/* Metadata row */}
      <View style={styles.metaRow}>
        {item.quest?.quest_type && (
          <QuestTypeBadge questType={item.quest.quest_type} compact />
        )}
        {item.quest?.difficulty && (
          <DifficultyBadge difficulty={item.quest.difficulty} compact />
        )}
        {item.rewardSnapshotPoints != null && (
          <View style={[styles.pointsPill, { backgroundColor: colors.muted }]}>
            <Feather name="star" size={11} color={colors.primary} />
            <Text style={[styles.pointsText, { color: colors.mutedForeground }]}>
              {formatPoints(item.rewardSnapshotPoints)}
            </Text>
          </View>
        )}
      </View>

      {/* Safe review note (needs_resubmission only) */}
      {item.safeReviewNote && (
        <View style={[styles.noteBox, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '30' }]}>
          <Text style={[styles.noteText, { color: colors.foreground }]}>
            {item.safeReviewNote}
          </Text>
        </View>
      )}

      {/* Under review messaging */}
      {item.status === 'under_review' && (
        <Text style={[styles.reviewNote, { color: colors.mutedForeground }]}>
          Your proof is under review. Points will be awarded after approval.
        </Text>
      )}

      {/* Action button */}
      {action.enabled && action.actionType !== 'unavailable' && (
        <Pressable
          style={[styles.actionButton, { backgroundColor: isUrgent ? sc.color : colors.primary }]}
          onPress={handleAction}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
        >
          <Text style={[styles.actionLabel, { color: '#fff' }]}>{action.label}</Text>
          <Feather name="arrow-right" size={15} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    padding: spacing[4],
    gap: spacing[3],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  warningText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.35,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pointsText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  noteBox: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  reviewNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    fontStyle: 'italic',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
  actionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
});
