/**
 * SubmissionStatus
 *
 * Clear status display for a proof submission.
 * Uses both text and icon — never color alone.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ProofSubmissionStatus } from '@/lib/supabase/database.types';

interface Props {
  status: ProofSubmissionStatus;
  submittedAt?: string | null;
  reviewNotes?: string | null; // safe reviewer-approved message only
}

interface StatusConfig {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  colorKey: 'success' | 'primary' | 'warning' | 'destructive' | 'mutedForeground';
  message: string;
}

const STATUS_CONFIG: Record<ProofSubmissionStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    icon: 'edit-2',
    colorKey: 'mutedForeground',
    message: 'Your proof is saved as a draft.',
  },
  uploading: {
    label: 'Uploading',
    icon: 'upload',
    colorKey: 'primary',
    message: 'Uploading your evidence…',
  },
  submitted: {
    label: 'Submitted',
    icon: 'check-circle',
    colorKey: 'success',
    message: 'Your proof was submitted successfully.',
  },
  under_review: {
    label: 'Under Review',
    icon: 'clock',
    colorKey: 'primary',
    message: "Your proof is under review. You'll be notified when a decision is available.",
  },
  approved: {
    label: 'Approved',
    icon: 'check-circle',
    colorKey: 'success',
    message: 'Your proof was approved and points have been awarded.',
  },
  needs_resubmission: {
    label: 'Resubmission Required',
    icon: 'alert-circle',
    colorKey: 'destructive',
    message: 'Your proof needs correction. Please review and resubmit.',
  },
  rejected: {
    label: 'Proof Rejected',
    icon: 'x-circle',
    colorKey: 'destructive',
    message: 'Your proof was not accepted.',
  },
};

export default function SubmissionStatus({ status, submittedAt, reviewNotes }: Props) {
  const colors = useColors();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  const colorMap = {
    success: colors.success,
    primary: colors.primary,
    warning: colors.warning,
    destructive: colors.destructive,
    mutedForeground: colors.mutedForeground,
  };
  const color = colorMap[config.colorKey];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: color + '12',
          borderColor: color + '30',
          borderRadius: radius.lg,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Submission status: ${config.label}. ${config.message}`}
    >
      <View style={styles.header}>
        <Feather name={config.icon} size={18} color={color} />
        <Text style={[styles.label, { color, fontFamily: fontFamily.semiBold }]}>
          {config.label}
        </Text>
      </View>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {config.message}
      </Text>
      {submittedAt && (
        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          Submitted {new Date(submittedAt).toLocaleString()}
        </Text>
      )}
      {/* Only show safe reviewer note — never expose internal moderation details */}
      {reviewNotes && status === 'needs_resubmission' && (
        <View style={[styles.noteBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.noteLabel, { color: colors.foreground }]}>
            Reviewer feedback:
          </Text>
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            {reviewNotes}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    gap: spacing[2],
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  label: {
    fontSize: fontSize.base,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.55,
  },
  timestamp: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  noteBox: {
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[1],
    marginTop: spacing[1],
  },
  noteLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
  noteText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
});
