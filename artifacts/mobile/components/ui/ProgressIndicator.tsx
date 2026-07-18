/**
 * ProgressIndicator
 *
 * Displays progress through a multi-step quest or hunt.
 * Use only for genuinely multi-step experiences — not single-step quests.
 *
 * Variants:
 *   bar    — horizontal progress bar (continuous)
 *   steps  — discrete step dots (1 of 5)
 *   ring   — circular arc (future; placeholder returns bar)
 *
 * Usage:
 *   <ProgressIndicator value={2} total={5} />
 *   <ProgressIndicator value={60} total={100} variant="bar" label="60% complete" />
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface Props {
  /** Current step or value (0-based accepted). */
  value: number;
  total: number;
  variant?: 'bar' | 'steps';
  label?: string;
  /** Override the fill color. Defaults to colors.primary. */
  color?: string;
  height?: number;
}

export default function ProgressIndicator({
  value,
  total,
  variant = 'bar',
  label,
  color,
  height = 6,
}: Props) {
  const colors = useColors();
  const tint = color ?? colors.primary;
  const fraction = Math.min(1, Math.max(0, value / total));

  if (variant === 'steps') {
    return (
      <View style={styles.stepsRoot}>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < value ? tint : colors.border,
                  width: i < value ? 20 : 8,
                  borderRadius: radius.full,
                },
              ]}
            />
          ))}
        </View>
        {label && (
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {label}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.barRoot}>
      <View
        style={[
          styles.track,
          { backgroundColor: colors.border, height, borderRadius: height / 2 },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: tint,
              width: `${fraction * 100}%`,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
      {label && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barRoot: {
    gap: spacing[1.5],
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  stepsRoot: {
    gap: spacing[2],
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  dot: {
    height: 8,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
