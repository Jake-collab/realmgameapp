/**
 * QuestStepList
 *
 * Renders ordered objectives with step progress for a multi-step quest.
 * Shows required vs. optional steps and completion counts.
 * Only use for quests with 2+ objectives — suppress for single-step quests.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import QuestObjectiveView from './QuestObjectiveView';
import ProgressIndicator from '@/components/ui/ProgressIndicator';
import type { QuestObjective } from '@/features/quests/types/quest.types';
import type { QuestStepProgressRow } from '@/lib/supabase/database.types';

interface Props {
  objectives: QuestObjective[];
  stepProgress: QuestStepProgressRow[];
  currentStepId?: string | null;
}

export default function QuestStepList({ objectives, stepProgress, currentStepId }: Props) {
  const colors = useColors();

  const sorted = [...objectives].sort((a, b) => a.sort_order - b.sort_order);
  const required = sorted.filter(o => o.is_required);
  const completedRequired = required.filter(o =>
    stepProgress.find(p => p.quest_step_id === o.id)?.status === 'completed'
  );

  const progressText = required.length > 1
    ? `${completedRequired.length} of ${required.length} required steps completed`
    : null;

  return (
    <View style={styles.root}>
      {progressText && (
        <View style={styles.progressHeader}>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {progressText}
          </Text>
          <ProgressIndicator
            value={completedRequired.length}
            total={required.length}
            color={colors.quest}
            height={5}
          />
        </View>
      )}

      <View style={styles.steps}>
        {sorted.map((obj, idx) => {
          const progress = stepProgress.find(p => p.quest_step_id === obj.id) ?? null;
          const isCurrentStep = obj.id === currentStepId;
          return (
            <QuestObjectiveView
              key={obj.id}
              objective={obj}
              stepProgress={progress}
              stepNumber={idx + 1}
              isCurrentStep={isCurrentStep}
              isFocused={isCurrentStep}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[4],
  },
  progressHeader: {
    gap: spacing[2],
  },
  progressText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  steps: {
    gap: spacing[2],
  },
});
