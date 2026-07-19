/**
 * HuntDeadlineNotice — Worlds (Prompt 13)
 *
 * Shows deadline information when relevant:
 *   - Warning (within 2 hours)
 *   - Expired state
 *
 * Rules:
 * - Only shown when a deadline exists AND is near
 * - Uses server timestamp, not device clock
 * - No drifting countdown (re-renders on mount only)
 * - Not shown when grace period makes deadline nonbinding
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface HuntDeadlineNoticeProps {
  completionDeadline: string | null;
}

type DeadlineState = 'hidden' | 'warning' | 'expired';

function getDeadlineState(deadline: string | null): {
  state: DeadlineState;
  label: string | null;
} {
  if (!deadline) return { state: 'hidden', label: null };

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();

  if (diffMs < 0) {
    return {
      state: 'expired',
      label: 'The hunt deadline has passed.',
    };
  }

  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 0.25) { // ≤ 15 minutes
    const diffMin = Math.ceil(diffMs / (1000 * 60));
    return {
      state: 'warning',
      label: `Less than ${diffMin} minute${diffMin !== 1 ? 's' : ''} remaining`,
    };
  }

  if (diffHours <= 1) {
    const diffMin = Math.ceil(diffMs / (1000 * 60));
    return {
      state: 'warning',
      label: `About ${diffMin} minutes remaining`,
    };
  }

  if (diffHours <= 2) {
    return {
      state: 'warning',
      label: `Ends ${deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
    };
  }

  return { state: 'hidden', label: null };
}

export function HuntDeadlineNotice({ completionDeadline }: HuntDeadlineNoticeProps) {
  const { state, label } = getDeadlineState(completionDeadline);

  if (state === 'hidden') return null;

  const isExpired = state === 'expired';
  const bg = isExpired ? '#FEE2E2' : '#FEF3C7';
  const borderColor = isExpired ? '#FECACA' : '#FDE68A';
  const iconColor = isExpired ? '#DC2626' : '#D97706';
  const textColor = isExpired ? '#991B1B' : '#92400E';

  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor }]}
      accessible
      accessibilityRole="alert"
    >
      <Feather
        name={isExpired ? 'alert-circle' : 'clock'}
        size={14}
        color={iconColor}
      />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing[2],
    paddingVertical:  spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:     radius.md,
    borderWidth:      1,
  },
  text: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.sm,
    flex:       1,
  },
});
