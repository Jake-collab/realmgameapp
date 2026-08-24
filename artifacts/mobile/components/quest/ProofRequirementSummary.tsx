/**
 * ProofRequirementSummary
 *
 * Compact summary of what proof a quest requires.
 * Shown in Quest Detail and Active Quest screens.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ProofType, QuestCompletionMode } from '@/lib/supabase/database.types';

interface Props {
  proofType: ProofType;
  completionMode: QuestCompletionMode;
}

interface ProofInfo {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  description: string;
}

// Actual ProofType values: 'photo' | 'video' | 'text' | 'location' | 'qr_code' | 'none'
const PROOF_INFO: Record<ProofType, ProofInfo> = {
  none: {
    icon: 'check-circle',
    label: 'No Proof Required',
    description: 'This quest completes automatically.',
  },
  text: {
    icon: 'file-text',
    label: 'Text Response',
    description: 'Write a text response describing your completion.',
  },
  photo: {
    icon: 'camera',
    label: 'Live Photo Required',
    description: 'Take a new photo with your camera as evidence of completion.',
  },
  video: {
    icon: 'video',
    label: 'Live Video Required',
    description: 'Record a new video with your camera as evidence of completion.',
  },
  location: {
    icon: 'map-pin',
    label: 'Location Check-In',
    description: 'Visit the designated location to check in.',
  },
  qr_code: {
    icon: 'maximize',
    label: 'QR Code Scan',
    description: 'Scan the QR code at the location to complete.',
  },
};

export default function ProofRequirementSummary({ proofType, completionMode }: Props) {
  const colors = useColors();
  const info = PROOF_INFO[proofType] ?? PROOF_INFO.none;
  const requiresReview = completionMode === 'manual_review';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.secondary,
          borderRadius: radius.lg,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Feather name={info.icon} size={16} color={colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {info.label}
          </Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            {info.description}
          </Text>
        </View>
      </View>

      {requiresReview && proofType !== ('none' as ProofType) && (
        <View style={[styles.reviewNote, { borderTopColor: colors.border }]}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>
            Points are awarded after reviewer approval.
          </Text>
        </View>
      )}

      {!requiresReview && proofType === ('none' as ProofType) && (
        <View style={[styles.reviewNote, { borderTopColor: colors.border }]}>
          <Feather name="zap" size={12} color={colors.success} />
          <Text style={[styles.reviewText, { color: colors.success }]}>
            Points awarded immediately on completion.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing[0.5],
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
  desc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  reviewNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    flex: 1,
  },
});
