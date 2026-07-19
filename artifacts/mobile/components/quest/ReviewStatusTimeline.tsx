/**
 * ReviewStatusTimeline — Compact proof lifecycle display.
 *
 * Shows only actual states — not future steps.
 * Uses text + icons, not color alone.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { SubmissionHistoryItem } from '@/features/quests/types/questProgress.types';
import type { ProofSubmissionStatus } from '@/lib/supabase/database.types';

interface Props {
  submissions: SubmissionHistoryItem[];
}

interface Step {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  date: string | null;
  status: 'completed' | 'current' | 'pending';
  isNegative?: boolean;
}

function stepsFromHistory(submissions: SubmissionHistoryItem[]): Step[] {
  const steps: Step[] = [];
  for (const sub of submissions) {
    steps.push({
      label: `Submission #${sub.submissionNumber}`,
      icon: 'upload',
      date: sub.submittedAt,
      status: 'completed',
    });

    if (sub.status === 'under_review') {
      steps.push({ label: 'Under Review', icon: 'clock', date: null, status: sub.isLatest ? 'current' : 'completed' });
    } else if (sub.status === 'approved') {
      steps.push({ label: 'Approved', icon: 'check-circle', date: null, status: 'completed' });
    } else if (sub.status === 'needs_resubmission') {
      steps.push({ label: 'Resubmission Requested', icon: 'alert-circle', date: null, status: sub.isLatest ? 'current' : 'completed', isNegative: true });
    } else if (sub.status === 'rejected') {
      steps.push({ label: 'Not Accepted', icon: 'x-circle', date: null, status: 'current', isNegative: true });
    }
  }
  return steps;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ReviewStatusTimeline({ submissions }: Props) {
  const colors = useColors();
  const steps = stepsFromHistory(submissions);

  if (steps.length === 0) return null;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Proof timeline: ${steps.map(s => s.label).join(', ')}`}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const dotColor = step.isNegative
          ? colors.destructive
          : step.status === 'completed'
          ? colors.success
          : step.status === 'current'
          ? colors.primary
          : colors.border;

        return (
          <View key={index} style={styles.step}>
            {/* Connector + dot */}
            <View style={styles.indicator}>
              {index > 0 && (
                <View style={[styles.line, { backgroundColor: colors.border }]} />
              )}
              <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                <Feather
                  name={step.icon}
                  size={10}
                  color="#fff"
                />
              </View>
              {!isLast && (
                <View style={[styles.lineBottom, { backgroundColor: colors.border }]} />
              )}
            </View>

            {/* Label + date */}
            <View style={styles.content}>
              <Text style={[styles.stepLabel, {
                color: step.status === 'pending' ? colors.mutedForeground : colors.foreground,
                fontFamily: step.status === 'current' ? fontFamily.semiBold : fontFamily.regular,
              }]}>
                {step.label}
              </Text>
              {step.date && (
                <Text style={[styles.date, { color: colors.mutedForeground }]}>
                  {formatDate(step.date)}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  step: {
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 40,
  },
  indicator: {
    alignItems: 'center',
    width: 24,
  },
  line: {
    width: 1.5,
    height: 8,
    marginBottom: 2,
  },
  lineBottom: {
    width: 1.5,
    flex: 1,
    marginTop: 2,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: spacing[3],
    gap: 2,
  },
  stepLabel: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
