/**
 * AchievementIcon — Feather-icon badge for an achievement.
 * Hidden achievements render as "???" until unlocked.
 * Color-independent: uses icon + shape, not color alone.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { radius } from '@/constants/spacing';

const WORLDS_PURPLE = '#7C3AED'; // prestige color for achievements

interface Props {
  iconName: string;
  isHidden: boolean;
  isUnlocked: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { box: 36, icon: 16 },
  md: { box: 48, icon: 22 },
  lg: { box: 64, icon: 28 },
} as const;

export default function AchievementIcon({ iconName, isHidden, isUnlocked, size = 'md' }: Props) {
  const colors = useColors();
  const { box, icon } = SIZES[size];

  const showLocked = !isUnlocked;
  const showHidden = isUnlocked && isHidden; // unlocked hidden = reveal normally

  const bgColor  = showLocked ? colors.muted : WORLDS_PURPLE + '18';
  const iconColor = showLocked ? colors.mutedForeground : WORLDS_PURPLE;
  const featherName = showLocked ? 'lock' : (iconName as any);

  return (
    <View
      style={[
        styles.box,
        {
          width: box,
          height: box,
          borderRadius: radius.lg,
          backgroundColor: bgColor,
          borderColor: showLocked ? colors.border : WORLDS_PURPLE + '35',
          borderWidth: 1,
        },
      ]}
      accessibilityElementsHidden
    >
      <Feather name={featherName} size={icon} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
