/**
 * CapacityIndicator — Worlds
 *
 * Displays Hunt capacity information: participant count, available slots, full state.
 * Never exposes individual participant identities.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface CapacityIndicatorProps {
  current: number;
  max: number | null; // null = unlimited
  isFull?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function CapacityIndicator({
  current,
  max,
  isFull = false,
  showLabel = true,
  size = 'sm',
}: CapacityIndicatorProps) {
  const colors = useColors();
  const textSize = size === 'sm' ? fontSize.xs : fontSize.sm;

  const iconColor = isFull
    ? colors.destructive
    : current > 0
      ? colors.hunt
      : colors.mutedForeground;

  const label = isFull
    ? 'Full'
    : max === null
      ? `${current} joined`
      : `${current} / ${max}`;

  const sublabel = isFull
    ? 'No spots available'
    : max !== null
      ? `${Math.max(0, max - current)} spot${max - current !== 1 ? 's' : ''} left`
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Feather
          name={isFull ? 'users' : 'user'}
          size={size === 'sm' ? 13 : 15}
          color={iconColor}
        />
        {showLabel && (
          <Text
            style={[
              styles.label,
              { color: isFull ? colors.destructive : colors.foreground, fontSize: textSize },
            ]}
            accessibilityLabel={`${label}${sublabel ? '. ' + sublabel : ''}`}
          >
            {label}
          </Text>
        )}
      </View>
      {sublabel && showLabel && size === 'md' && (
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>{sublabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  label: {
    fontFamily: fontFamily.semiBold,
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginLeft: 18,
  },
});
