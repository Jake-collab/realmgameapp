import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { radius } from '@/constants/spacing';
import type { HuntObjectiveMarkerStatus } from '../utils/huntMapGameplay';

export function HuntObjectiveMarker({
  title,
  status,
  isSelected,
  onPress,
}: {
  title: string;
  status: HuntObjectiveMarkerStatus;
  isSelected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const style = markerStyle(status, colors);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${status}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View
        style={[
          styles.marker,
          {
            width: isSelected ? 38 : 30,
            height: isSelected ? 38 : 30,
            borderRadius: isSelected ? radius.lg : radius.md,
            backgroundColor: style.background,
            borderColor: style.border,
            opacity: status === 'completed' ? 0.55 : 1,
          },
        ]}
      >
        <Feather name={style.icon} size={isSelected ? 17 : 14} color={style.iconColor} />
      </View>
    </TouchableOpacity>
  );
}

function markerStyle(
  status: HuntObjectiveMarkerStatus,
  colors: ReturnType<typeof useColors>,
) {
  switch (status) {
    case 'completed':
      return { background: colors.secondary, border: colors.border, icon: 'check' as const, iconColor: colors.mutedForeground };
    case 'active':
      return { background: colors.hunt, border: colors.hunt, icon: 'radio' as const, iconColor: '#fff' };
    case 'ready':
      return { background: colors.primary, border: colors.primary, icon: 'navigation' as const, iconColor: colors.primaryForeground };
    case 'discovered':
      return { background: colors.card, border: colors.hunt, icon: 'map-pin' as const, iconColor: colors.hunt };
    case 'locked':
      return { background: colors.secondary, border: colors.border, icon: 'lock' as const, iconColor: colors.mutedForeground };
    case 'hidden':
      return { background: colors.secondary, border: colors.border, icon: 'eye-off' as const, iconColor: colors.mutedForeground };
    default:
      return { background: colors.secondary, border: colors.border, icon: 'map-pin' as const, iconColor: colors.mutedForeground };
  }
}

const styles = StyleSheet.create({
  marker: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});