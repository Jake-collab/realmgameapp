/**
 * HuntSubmissionStatus — Worlds (Prompt 13)
 *
 * Shows the current proof submission status for a stop.
 * Handles: under_review, needs_resubmission, rejected, approved.
 *
 * Rules:
 * - Never shows reviewer identity
 * - Never shows raw moderation scores or internal notes
 * - reviewExplanation is a user-safe string set by the reviewer
 * - "Resubmit" action links previous_submission_id to the new submission
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntProofSubmissionDetail } from '@/features/active-hunt/types/activeHunt.types';

interface HuntSubmissionStatusProps {
  submission:     HuntProofSubmissionDetail;
  stopTitle:      string;
  onResubmit:     () => void;
  onViewDetails?: () => void;
}

export function HuntSubmissionStatus({
  submission,
  stopTitle,
  onResubmit,
  onViewDetails,
}: HuntSubmissionStatusProps) {
  const colors = useColors();

  const STATUS_CONFIG = {
    draft:            { icon: 'edit-3',      color: colors.mutedForeground, bg: colors.secondary, label: 'Draft',              border: colors.border },
    submitted:        { icon: 'send',        color: '#6B7280',              bg: '#F3F4F6',        label: 'Submitted',          border: '#E5E7EB' },
    under_review:     { icon: 'clock',       color: '#D97706',              bg: '#FEF3C7',        label: 'Under Review',       border: '#FDE68A' },
    needs_resubmission:{ icon: 'alert-circle',color: '#D97706',             bg: '#FEF3C7',        label: 'Needs Resubmission', border: '#FDE68A' },
    approved:         { icon: 'check-circle',color: '#10B981',              bg: '#D1FAE5',        label: 'Approved',           border: '#A7F3D0' },
    rejected:         { icon: 'x-circle',    color: '#EF4444',              bg: '#FEE2E2',        label: 'Rejected',           border: '#FECACA' },
  };

  const config = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG.submitted;
  const canResubmit = ['needs_resubmission', 'rejected'].includes(submission.status);
  const submittedDate = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={[styles.card, { backgroundColor: config.bg, borderColor: config.border }]}>
      {/* Status row */}
      <View style={styles.statusRow}>
        <Feather name={config.icon as any} size={18} color={config.color} />
        <View style={styles.statusInfo}>
          <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
          {submittedDate && (
            <Text style={[styles.submittedDate, { color: colors.mutedForeground }]}>
              Submitted {submittedDate}
            </Text>
          )}
        </View>
        {onViewDetails && (
          <TouchableOpacity onPress={onViewDetails} style={styles.viewBtn} accessibilityLabel="View submission details">
            <Text style={[styles.viewBtnText, { color: config.color }]}>View</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* User-safe review explanation */}
      {submission.reviewExplanation && (
        <View style={[styles.explanation, { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
          <Text style={[styles.explanationText, { color: colors.foreground }]}>
            {submission.reviewExplanation}
          </Text>
        </View>
      )}

      {/* Under review note for ordered hunts */}
      {submission.status === 'under_review' && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Your proof is being reviewed. For ordered hunts, progress may pause until approval.
        </Text>
      )}

      {/* Resubmit action */}
      {canResubmit && (
        <TouchableOpacity
          onPress={onResubmit}
          style={[styles.resubmitBtn, { backgroundColor: '#F59E0B' }]}
          accessibilityLabel="Resubmit proof"
        >
          <Feather name="refresh-cw" size={14} color="#fff" />
          <Text style={styles.resubmitBtnText}>Resubmit Proof</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3],
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  statusInfo: { flex: 1 },
  statusLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  submittedDate: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  viewBtn: { padding: spacing[1] },
  viewBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  explanation: {
    borderRadius: radius.md, padding: spacing[3],
  },
  explanationText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18 },
  resubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderRadius: radius.md, alignSelf: 'flex-start',
  },
  resubmitBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: '#fff' },
});
