/**
 * DifficultyBadge
 *
 * Visual indicator for quest difficulty (easy, medium, hard, expert).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { Difficulty } from '@/lib/supabase/database.types';

interface Props {
  difficulty: Difficulty;
  size?: 'sm' | 'md';
  /** When true, show dots instead of text label */
  dotsOnly?: boolean;
}

const DIFFICULTY_DOTS: Record<Difficulty, number> = {
  very_easy: 1,
  easy:      2,
  medium:    3,
  hard:      4,
  epic:      5,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  very_easy: 'Very Easy',
  easy:      'Easy',
  medium:    'Medium',
  hard:      'Hard',
  epic:      'Epic',
};

function getDifficultyColor(difficulty: Difficulty, colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  switch (difficulty) {
    case 'very_easy': return colors.success;
    case 'easy':      return colors.success;
    case 'medium':    return colors.warning;
    case 'hard':      return '#EF4444'; // red-500
    case 'epic':      return '#7C3AED'; // violet-600
    default:          return colors.mutedForeground;
  }
}

export default function DifficultyBadge({ difficulty, size = 'md', dotsOnly = false }: Props) {
  const colors = useColors();
  const color = getDifficultyColor(difficulty, colors);
  const dots = DIFFICULTY_DOTS[difficulty] ?? 1;
  const label = DIFFICULTY_LABELS[difficulty] ?? difficulty;

  if (dotsOnly) {
    return (
      <View style={styles.dotsRow} accessibilityLabel={`Difficulty: ${label}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i < dots ? color : colors.border },
            ]}
          />
        ))}
      </View>
    );
  }

  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '15',
          paddingHorizontal: isSm ? spacing[1.5] : spacing[2],
          paddingVertical: isSm ? spacing[0.5] : spacing[1],
          borderRadius: radius.full,
        },
      ]}
      accessibilityLabel={`Difficulty: ${label}`}
    >
      <Text
        style={{
          color,
          fontSize: isSm ? fontSize.xs : fontSize.sm,
          fontFamily: fontFamily.medium,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
