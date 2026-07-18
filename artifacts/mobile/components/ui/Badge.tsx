/**
 * Badge component — small label chips for status, categories, tags.
 *
 * Variants: default | primary | success | warning | destructive | outline
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const colors = useColors();

  const bg: Record<BadgeVariant, string> = {
    default: colors.secondary,
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    destructive: colors.destructive,
    outline: 'transparent',
  };

  const fg: Record<BadgeVariant, string> = {
    default: colors.secondaryForeground,
    primary: colors.primaryForeground,
    success: colors.successForeground,
    warning: colors.warningForeground,
    destructive: colors.destructiveForeground,
    outline: colors.foreground,
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg[variant],
          borderRadius: radius.full,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: variant === 'outline' ? colors.border : undefined,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: fg[variant] }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
  },
  text: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
