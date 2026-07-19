/**
 * AvailabilityNotice
 *
 * Compact status chip showing quest availability state (Available, Active,
 * Completed, Upcoming, etc.). Used in cards and detail screens.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { QuestAvailabilityState } from '@/features/quests/types/quest.types';

interface Props {
  state: QuestAvailabilityState;
  availableFrom?: string | null;
  availableUntil?: string | null;
  compact?: boolean;
}

interface StateConfig {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  colorKey: 'success' | 'quest' | 'primary' | 'warning' | 'mutedForeground' | 'destructive';
}

const STATE_CONFIG: Record<QuestAvailabilityState, StateConfig> = {
  available:          { label: 'Available',       icon: 'circle',       colorKey: 'success' },
  active:             { label: 'In Progress',      icon: 'play-circle',  colorKey: 'quest' },
  awaiting_proof:     { label: 'Proof Required',   icon: 'camera',       colorKey: 'warning' },
  under_review:       { label: 'Under Review',     icon: 'clock',        colorKey: 'primary' },
  needs_resubmission: { label: 'Resubmit Proof',   icon: 'alert-circle', colorKey: 'destructive' },
  completed:          { label: 'Completed',         icon: 'check-circle', colorKey: 'success' },
  upcoming:           { label: 'Upcoming',          icon: 'calendar',     colorKey: 'mutedForeground' },
  expired:            { label: 'Expired',           icon: 'x-circle',     colorKey: 'destructive' },
  paused:             { label: 'Unavailable',       icon: 'pause-circle', colorKey: 'mutedForeground' },
  ineligible:         { label: 'Unavailable',       icon: 'lock',         colorKey: 'mutedForeground' },
};

export default function AvailabilityNotice({
  state,
  availableFrom,
  availableUntil,
  compact = false,
}: Props) {
  const colors = useColors();
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.ineligible;

  const colorMap = {
    success:         colors.success,
    quest:           colors.quest,
    primary:         colors.primary,
    warning:         colors.warning,
    mutedForeground: colors.mutedForeground,
    destructive:     colors.destructive,
  };
  const color = colorMap[config.colorKey];

  let subtext: string | null = null;
  if (state === 'upcoming' && availableFrom) {
    const d = new Date(availableFrom);
    subtext = `Available ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } else if ((state === 'available' || state === 'active') && availableUntil) {
    const d = new Date(availableUntil);
    const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    if (daysLeft <= 3 && daysLeft > 0) {
      subtext = `Ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: color + '15',
          borderRadius: radius.full,
          paddingHorizontal: compact ? spacing[2] : spacing[2.5],
          paddingVertical: compact ? spacing[0.5] : spacing[1],
        },
      ]}
      accessibilityLabel={`Quest status: ${config.label}${subtext ? '. ' + subtext : ''}`}
    >
      <Feather name={config.icon} size={12} color={color} />
      <Text
        style={[
          styles.label,
          {
            color,
            fontFamily: fontFamily.medium,
            fontSize: compact ? fontSize.xs : fontSize.sm,
          },
        ]}
      >
        {subtext ?? config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
  },
  label: {},
});
