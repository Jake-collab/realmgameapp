/**
 * QuestTypeBadge
 *
 * Small pill showing quest type (Daily, Monthly, Geo-Quest).
 * Uses type-specific color from the design system.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { QuestType } from '@/lib/supabase/database.types';

interface Props {
  questType: QuestType;
  size?: 'sm' | 'md';
}

export default function QuestTypeBadge({ questType, size = 'md' }: Props) {
  const colors = useColors();

  const config = {
    daily: {
      label: 'Daily',
      color: colors.quest,
      icon: 'sun' as const,
    },
    monthly: {
      label: 'Monthly Drop',
      color: colors.primary,
      icon: 'star' as const,
    },
    geo: {
      label: 'Geo-Quest',
      color: colors.accent,
      icon: 'map-pin' as const,
    },
  }[questType] ?? {
    label: questType,
    color: colors.mutedForeground,
    icon: 'compass' as const,
  };

  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.color + '18',
          paddingHorizontal: isSm ? spacing[1.5] : spacing[2.5],
          paddingVertical: isSm ? spacing[0.5] : spacing[1],
          borderRadius: radius.full,
        },
      ]}
      accessibilityLabel={`Quest type: ${config.label}`}
    >
      <Feather
        name={config.icon}
        size={isSm ? 10 : 12}
        color={config.color}
      />
      <Text
        style={[
          styles.label,
          {
            color: config.color,
            fontSize: isSm ? fontSize.xs : fontSize.sm,
            fontFamily: fontFamily.semiBold,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

export function questTypeColor(questType: QuestType, colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  switch (questType) {
    case 'daily':   return colors.quest;
    case 'monthly': return colors.primary;
    case 'geo':     return colors.accent;
    default:        return colors.mutedForeground;
  }
}

export function questTypeLabel(questType: QuestType): string {
  switch (questType) {
    case 'daily':   return 'Daily';
    case 'monthly': return 'Monthly Drop';
    case 'geo':     return 'Geo-Quest';
    default:        return questType;
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
  },
  label: {},
});
