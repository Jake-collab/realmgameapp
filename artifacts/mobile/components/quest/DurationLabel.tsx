/**
 * DurationLabel
 *
 * Displays estimated quest duration in a compact, human-readable format.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface Props {
  estimatedMinutes: number | null | undefined;
  size?: 'sm' | 'md';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${mins}m`;
}

export default function DurationLabel({ estimatedMinutes, size = 'md' }: Props) {
  const colors = useColors();

  if (!estimatedMinutes) return null;

  const isSm = size === 'sm';
  const label = formatDuration(estimatedMinutes);

  return (
    <View style={styles.row} accessibilityLabel={`Estimated duration: ${label}`}>
      <Feather
        name="clock"
        size={isSm ? 11 : 13}
        color={colors.mutedForeground}
      />
      <Text
        style={[
          styles.text,
          {
            color: colors.mutedForeground,
            fontSize: isSm ? fontSize.xs : fontSize.sm,
            fontFamily: fontFamily.regular,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  text: {},
});
