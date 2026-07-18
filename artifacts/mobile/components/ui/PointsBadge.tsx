/**
 * PointsBadge
 *
 * Displays a point or XP value with a consistent visual treatment.
 * Used on quest cards, hunt preview sheets, leaderboards, and profiles.
 *
 * Usage:
 *   <PointsBadge value={250} />
 *   <PointsBadge value={1500} label="XP" size="lg" />
 *   <PointsBadge value={50} color="#F97316" />   // quest orange
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface Props {
  value: number;
  /** Label shown after the number. Defaults to 'pts'. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Override the badge color. Defaults to colors.primary. */
  color?: string;
  /** Show a star/coin icon. Default: true. */
  showIcon?: boolean;
}

const sizeMap = {
  sm: { text: fontSize.xs, icon: 11, pad: spacing[1.5], gap: spacing[1] },
  md: { text: fontSize.sm, icon: 13, pad: spacing[2], gap: spacing[1] },
  lg: { text: fontSize.base, icon: 15, pad: spacing[2.5], gap: spacing[1.5] },
};

export default function PointsBadge({
  value,
  label = 'pts',
  size = 'md',
  color,
  showIcon = true,
}: Props) {
  const colors = useColors();
  const tint = color ?? colors.primary;
  const { text, icon, pad, gap } = sizeMap[size];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: tint + '15',
          borderColor: tint + '30',
          paddingHorizontal: pad,
          paddingVertical: pad * 0.6,
          borderRadius: radius.full,
          gap,
        },
      ]}
    >
      {showIcon && <Feather name="star" size={icon} color={tint} />}
      <Text style={[styles.value, { color: tint, fontSize: text }]}>
        {value.toLocaleString()}
      </Text>
      <Text style={[styles.label, { color: tint + 'AA', fontSize: text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  value: {
    fontFamily: fontFamily.bold,
  },
  label: {
    fontFamily: fontFamily.medium,
  },
});
