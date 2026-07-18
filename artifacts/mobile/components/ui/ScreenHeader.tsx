/**
 * ScreenHeader
 *
 * Consistent in-screen header for gameplay screens that do not use
 * the navigation stack header. Provides a title, optional subtitle,
 * optional left action (back/close), and optional right action.
 *
 * Gameplay screens should use this instead of the Expo Router header
 * so layout remains predictable across game modes.
 *
 * Usage:
 *   <ScreenHeader
 *     title="Daily Quest"
 *     subtitle="3 of 5 completed"
 *     leftAction={{ icon: 'arrow-left', onPress: router.back }}
 *     rightAction={{ icon: 'more-vertical', onPress: openMenu }}
 *   />
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface HeaderAction {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  leftAction?: HeaderAction;
  rightAction?: HeaderAction;
  /** When true, the title is centered. Default: left-aligned. */
  centered?: boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  centered = false,
}: Props) {
  const colors = useColors();

  return (
    <View style={[styles.root, { borderBottomColor: colors.border }]}>
      {/* Left slot */}
      <View style={styles.slot}>
        {leftAction && (
          <Pressable
            onPress={leftAction.onPress}
            accessibilityLabel={leftAction.accessibilityLabel ?? 'Go back'}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name={leftAction.icon} size={22} color={colors.foreground} />
          </Pressable>
        )}
      </View>

      {/* Title */}
      <View style={[styles.center, centered && styles.absoluteCenter]}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right slot */}
      <View style={[styles.slot, styles.slotRight]}>
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            accessibilityLabel={rightAction.accessibilityLabel ?? 'More options'}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name={rightAction.icon} size={22} color={colors.foreground} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slot: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  slotRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    paddingHorizontal: spacing[2],
  },
  absoluteCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
});
