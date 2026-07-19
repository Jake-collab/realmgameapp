/**
 * HuntMarker — Worlds
 *
 * Map marker pin for Hunt map. Communicates state through both
 * color AND icon — never color alone (accessibility requirement).
 *
 * States:
 *   available  — primary (blue/hunt green) flag icon
 *   joined     — accent (purple), flag-filled
 *   active     — hunt green, play icon
 *   full       — muted, lock icon
 *   upcoming   — muted, clock icon
 *   completed  — muted/checkmark
 *   featured   — orange, star icon
 *   selected   — enlarged, full opacity
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { radius } from '@/constants/spacing';
import type { HuntMarkerStatus } from '@/features/hunt-map/types/huntMap.types';

interface HuntMarkerProps {
  title: string;
  status: HuntMarkerStatus;
  pointsReward: number;
  isSelected: boolean;
  onPress: () => void;
}

export function HuntMarker({ title, status, pointsReward, isSelected, onPress }: HuntMarkerProps) {
  const colors = useColors();
  const style = getMarkerStyle(status, colors);
  const iconName = getMarkerIcon(status);
  const size = isSelected ? 20 : 14;
  const containerSize = isSelected ? 44 : 32;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${statusLabel(status)} — ${pointsReward} points`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View
        style={[
          styles.pin,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: isSelected ? radius.lg : radius.md,
            backgroundColor: style.bg,
            borderColor: style.border,
            opacity: status === 'completed' && !isSelected ? 0.55 : 1,
          },
          isSelected && styles.pinSelected,
        ]}
      >
        <Feather name={iconName as any} size={size} color={style.icon} />
      </View>
      {/* Tail */}
      <View style={[styles.tail, { borderTopColor: style.bg }]} />
    </TouchableOpacity>
  );
}

// ─── Icon / color mapping ──────────────────────────────────────────────────────

function getMarkerIcon(status: HuntMarkerStatus): string {
  switch (status) {
    case 'active':    return 'play-circle';
    case 'joined':    return 'flag';
    case 'full':      return 'lock';
    case 'upcoming':  return 'clock';
    case 'completed': return 'check-circle';
    case 'featured':  return 'star';
    default:          return 'flag';
  }
}

function getMarkerStyle(status: HuntMarkerStatus, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'active':
      return { bg: colors.hunt, border: colors.hunt, icon: '#fff' };
    case 'joined':
      return { bg: '#7C3AED', border: '#7C3AED', icon: '#fff' };
    case 'featured':
      return { bg: '#F97316', border: '#F97316', icon: '#fff' };
    case 'full':
      return { bg: colors.secondary, border: colors.border, icon: colors.mutedForeground };
    case 'upcoming':
      return { bg: colors.secondary, border: colors.border, icon: colors.mutedForeground };
    case 'completed':
      return { bg: colors.secondary, border: colors.border, icon: colors.mutedForeground };
    default: // available
      return { bg: colors.hunt, border: colors.hunt, icon: '#fff' };
  }
}

function statusLabel(status: HuntMarkerStatus): string {
  switch (status) {
    case 'active':    return 'In progress';
    case 'joined':    return 'Joined';
    case 'full':      return 'Full';
    case 'upcoming':  return 'Upcoming';
    case 'completed': return 'Completed';
    case 'featured':  return 'Featured';
    default:          return 'Available';
  }
}

const styles = StyleSheet.create({
  pin: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  pinSelected: {
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  tail: {
    width: 0,
    height: 0,
    alignSelf: 'center',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
