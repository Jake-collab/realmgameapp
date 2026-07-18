/**
 * InterestBubble
 *
 * A small pill/chip used for interest tags, category filters,
 * and topic labels. Supports selected and unselected states.
 *
 * Used for: quest categories, hunt types, profile interests.
 *
 * Usage:
 *   <InterestBubble label="Outdoors" selected onPress={toggle} />
 *   <InterestBubble label="History" />
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Override the selected color. Defaults to colors.primary. */
  color?: string;
  disabled?: boolean;
}

export default function InterestBubble({
  label,
  selected = false,
  onPress,
  color,
  disabled = false,
}: Props) {
  const colors = useColors();
  const tint = color ?? colors.primary;

  const bg = selected ? tint : colors.secondary;
  const textColor = selected ? '#FFFFFF' : colors.mutedForeground;
  const borderColor = selected ? tint : colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: radius.full,
          opacity: pressed ? 0.8 : disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
