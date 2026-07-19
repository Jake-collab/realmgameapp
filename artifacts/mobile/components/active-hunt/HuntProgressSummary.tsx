/**
 * HuntProgressSummary — Worlds (Prompt 13)
 *
 * Displays meaningful hunt progress:
 *   - Required stops completed / total required
 *   - Progress bar (only when denominator > 1)
 *   - Optional stops completed (separate, labeled)
 *
 * Rules:
 * - Never counts optional stops as required
 * - Never calculates progress from client assumptions
 * - Uses authoritative stop data from ActiveHunt query
 * - No misleading percentages
 */

import React from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ActiveHuntStop } from '@/features/hunts/types/hunt.types';

interface HuntProgressSummaryProps {
  completedRequired: number;
  totalRequired: number;
  currentStops: ActiveHuntStop[];
  isOrdered: boolean;
  compact?: boolean;
}

export function HuntProgressSummary({
  completedRequired,
  totalRequired,
  currentStops,
  isOrdered,
  compact = false,
}: HuntProgressSummaryProps) {
  const colors = useColors();

  const completedOptional = currentStops.filter(
    s => !s.isRequired && s.progressStatus === 'completed'
  ).length;

  const progress = totalRequired > 0 ? completedRequired / totalRequired : 0;
  const showBar = totalRequired > 1;

  const progressLabel = totalRequired > 0
    ? `${completedRequired} of ${totalRequired} required stop${totalRequired !== 1 ? 's' : ''} completed`
    : 'No required stops';

  if (compact) {
    return (
      <View style={styles.compactRow} accessibilityLabel={progressLabel}>
        <Text style={[styles.compactText, { color: colors.mutedForeground }]}>
          {completedRequired} / {totalRequired}
        </Text>
        {showBar && (
          <View style={[styles.compactBar, { backgroundColor: colors.border }]}>
            <View style={[styles.compactFill, {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: colors.hunt,
            }]} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessible
      accessibilityLabel={progressLabel}
    >
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Progress
        </Text>
        <Text style={[styles.count, { color: colors.foreground }]}>
          {completedRequired}
          <Text style={[styles.countDivider, { color: colors.mutedForeground }]}>
            {' '}/ {totalRequired}
          </Text>
        </Text>
      </View>

      {showBar && (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: totalRequired, now: completedRequired }}
        >
          <View style={[styles.progressFill, {
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: colors.hunt,
          }]} />
        </View>
      )}

      {/* Human-readable label */}
      <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
        {completedRequired === totalRequired && totalRequired > 0
          ? '✓ All required stops completed'
          : `${Math.max(0, totalRequired - completedRequired)} required stop${
              (totalRequired - completedRequired) !== 1 ? 's' : ''
            } remaining`}
      </Text>

      {completedOptional > 0 && (
        <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>
          + {completedOptional} optional stop{completedOptional !== 1 ? 's' : ''} completed
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth:  1,
    padding:      spacing[4],
    gap:          spacing[2],
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize:   fontSize.sm,
  },
  count: {
    fontFamily: fontFamily.bold,
    fontSize:   fontSize.lg,
  },
  countDivider: {
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.base,
  },
  progressTrack: {
    height:       6,
    borderRadius: radius.full,
    overflow:     'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: radius.full,
  },
  progressText: {
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.sm,
  },
  optionalText: {
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.xs,
  },
  // Compact variant
  compactRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
  },
  compactText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.sm,
  },
  compactBar: {
    flex:         1,
    height:       4,
    borderRadius: radius.full,
    overflow:     'hidden',
  },
  compactFill: {
    height:       '100%',
    borderRadius: radius.full,
  },
});
