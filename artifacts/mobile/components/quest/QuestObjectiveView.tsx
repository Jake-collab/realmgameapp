/**
 * QuestObjectiveView
 *
 * Displays a single quest objective (step) with its title, instructions,
 * proof requirement, and current completion status.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { QuestObjective } from '@/features/quests/types/quest.types';
import type { QuestStepProgressRow, StepStatus } from '@/lib/supabase/database.types';

interface Props {
  objective: QuestObjective;
  stepProgress?: QuestStepProgressRow | null;
  stepNumber?: number;
  isCurrentStep?: boolean;
  /** When true, highlight as the focus area */
  isFocused?: boolean;
}

// Actual ProofType values: 'photo' | 'video' | 'text' | 'location' | 'qr_code' | 'none'
const PROOF_TYPE_LABELS: Record<string, string> = {
  none:     '',
  text:     'Text response required',
  photo:    'Photo required',
  video:    'Video required',
  location: 'Location check-in required',
  qr_code:  'QR code scan required',
};

function stepStatusIcon(
  status: StepStatus | undefined,
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>
): { name: React.ComponentProps<typeof Feather>['name']; color: string } {
  switch (status) {
    case 'completed': return { name: 'check-circle', color: colors.success };
    case 'in_progress': return { name: 'play-circle', color: colors.quest };
    case 'skipped': return { name: 'minus-circle', color: colors.mutedForeground };
    default: return { name: 'circle', color: colors.border };
  }
}

export default function QuestObjectiveView({
  objective,
  stepProgress,
  stepNumber,
  isCurrentStep = false,
  isFocused = false,
}: Props) {
  const colors = useColors();
  const status = stepProgress?.status;
  const isCompleted = status === 'completed';
  const icon = stepStatusIcon(status, colors);
  const proofLabel = PROOF_TYPE_LABELS[objective.proof_type] ?? '';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isFocused ? colors.secondary : colors.card,
          borderColor: isCurrentStep ? colors.quest + '50' : colors.border,
          borderRadius: radius.lg,
          borderWidth: isCurrentStep ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
      accessibilityLabel={`Step ${stepNumber ? stepNumber + ': ' : ''}${objective.title}${isCompleted ? ', completed' : ''}`}
    >
      <View style={styles.header}>
        <Feather name={icon.name} size={20} color={icon.color} />
        <View style={styles.titleRow}>
          {stepNumber != null && (
            <Text style={[styles.stepNum, { color: colors.mutedForeground }]}>
              Step {stepNumber}
            </Text>
          )}
          <Text
            style={[
              styles.title,
              {
                color: isCompleted ? colors.mutedForeground : colors.foreground,
                fontFamily: fontFamily.semiBold,
                textDecorationLine: isCompleted ? 'line-through' : 'none',
              },
            ]}
          >
            {objective.title}
          </Text>
        </View>
        {!objective.is_required && (
          <View style={[styles.optionalBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>Optional</Text>
          </View>
        )}
      </View>

      {objective.instructions && (
        <Text style={[styles.instructions, { color: colors.mutedForeground }]}>
          {objective.instructions}
        </Text>
      )}

      {proofLabel && objective.proof_type !== ('none' as string) && (
        <View style={styles.proofRow}>
          <Feather name="camera" size={12} color={colors.primary} />
          <Text style={[styles.proofLabel, { color: colors.primary }]}>{proofLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  titleRow: {
    flex: 1,
    gap: spacing[0.5],
  },
  stepNum: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  title: {
    fontSize: fontSize.base,
  },
  optionalBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  optionalText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  instructions: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.55,
    marginLeft: spacing[8],
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginLeft: spacing[8],
  },
  proofLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
});
