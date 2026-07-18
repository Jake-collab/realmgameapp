/**
 * MapFloatingButton
 *
 * A floating action button designed for use on top of maps.
 * Maintains safe distance from the bottom navigation bar.
 *
 * Used for: Create Hunt, Re-center map, Open search, etc.
 * Keep the map visually dominant — limit to 1-3 buttons per map screen.
 *
 * Usage:
 *   <MapFloatingButton
 *     icon="plus"
 *     label="Create"
 *     onPress={openCreateFlow}
 *     position="bottom-right"
 *   />
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';

type Position =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'bottom-center';

interface Props {
  icon: React.ComponentProps<typeof Feather>['name'];
  label?: string;
  onPress: () => void;
  position?: Position;
  /** Extra bottom offset — useful when stacking multiple floating buttons */
  extraBottom?: number;
  accessibilityLabel?: string;
  /** Override background color. Defaults to colors.primary. */
  color?: string;
  variant?: 'primary' | 'surface';
}

const TAB_BAR_HEIGHT = 80;

export default function MapFloatingButton({
  icon,
  label,
  onPress,
  position = 'bottom-right',
  extraBottom = 0,
  accessibilityLabel,
  color,
  variant = 'primary',
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const bg =
    variant === 'surface'
      ? colors.card
      : (color ?? colors.primary);
  const iconColor =
    variant === 'surface' ? colors.foreground : '#FFFFFF';

  const positionStyle: Record<Position, object> = {
    'bottom-right': {
      bottom: insets.bottom + TAB_BAR_HEIGHT + spacing[4] + extraBottom,
      right: spacing[5],
    },
    'bottom-left': {
      bottom: insets.bottom + TAB_BAR_HEIGHT + spacing[4] + extraBottom,
      left: spacing[5],
    },
    'bottom-center': {
      bottom: insets.bottom + TAB_BAR_HEIGHT + spacing[4] + extraBottom,
      alignSelf: 'center',
    },
    'top-right': { top: insets.top + spacing[4], right: spacing[5] },
    'top-left': { top: insets.top + spacing[4], left: spacing[5] },
  };

  const hasLabel = Boolean(label);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label ?? icon}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.root,
        positionStyle[position],
        {
          backgroundColor: bg,
          borderRadius: hasLabel ? radius.full : radius.full,
          paddingHorizontal: hasLabel ? spacing[5] : spacing[4],
          paddingVertical: hasLabel ? spacing[3] : spacing[4],
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          ...shadows.lg,
        },
      ]}
    >
      <Feather name={icon} size={20} color={iconColor} />
      {hasLabel && (
        <Text style={[styles.label, { color: iconColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    zIndex: 100,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
});
