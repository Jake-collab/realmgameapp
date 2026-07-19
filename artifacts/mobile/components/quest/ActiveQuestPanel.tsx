/**
 * ActiveQuestPanel
 *
 * The dominant quest panel on the Home screen when the user has an active
 * participation. Shows the current objective, status, reward, and one clear
 * primary action. Used ONLY for active, awaiting_proof, under_review, and
 * needs_resubmission states.
 *
 * Do NOT show Start Quest — that belongs on cards in the inactive state.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import PointsBadge from '@/components/ui/PointsBadge';
import AvailabilityNotice from './AvailabilityNotice';
import QuestTypeBadge from './QuestTypeBadge';
import { resolveQuestAction } from '@/features/quests/utils/questActionResolver';
import type { QuestAvailabilityState } from '@/features/quests/types/quest.types';
import type { QuestType, ParticipationStatus, ProofSubmissionStatus } from '@/lib/supabase/database.types';

interface Props {
  title: string;
  questType: QuestType;
  availabilityState: QuestAvailabilityState;
  participationStatus: ParticipationStatus;
  proofStatus?: ProofSubmissionStatus | null;
  currentObjective?: string | null;
  pointsSnapshot: number;
  availableUntil?: string | null;
  onPress: () => void;
}

export default function ActiveQuestPanel({
  title,
  questType,
  availabilityState,
  participationStatus,
  proofStatus,
  currentObjective,
  pointsSnapshot,
  availableUntil,
  onPress,
}: Props) {
  const colors = useColors();

  const action = resolveQuestAction({
    availabilityState,
    participationStatus,
    proofStatus,
  });

  const typeColors: Record<QuestType, string> = {
    daily:   colors.quest,
    monthly: colors.primary,
    geo:     colors.accent,
  };
  const accentColor = typeColors[questType] ?? colors.primary;

  const isUrgent = participationStatus === 'needs_resubmission';
  const borderColor = isUrgent ? colors.destructive + '50' : accentColor + '35';

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${action.label} — ${title}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor,
          borderRadius: radius.xl,
          opacity: pressed ? 0.94 : 1,
          ...shadows.md,
        },
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <QuestTypeBadge questType={questType} />
        <AvailabilityNotice
          state={availabilityState}
          availableUntil={availableUntil}
          compact
        />
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {title}
      </Text>

      {/* Current objective */}
      {currentObjective && (
        <View style={[styles.objectiveRow, { backgroundColor: accentColor + '08' }]}>
          <Feather name="target" size={13} color={accentColor} />
          <Text
            style={[styles.objective, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {currentObjective}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <PointsBadge value={pointsSnapshot} color={accentColor} />
        <View style={[styles.actionPill, { backgroundColor: isUrgent ? colors.destructive : accentColor }]}>
          <Text style={styles.actionText}>{action.label}</Text>
          <Feather name="arrow-right" size={13} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[5],
    gap: spacing[3],
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.25,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  objective: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  actionText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#FFFFFF',
  },
});
