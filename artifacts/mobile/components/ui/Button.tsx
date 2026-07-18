/**
 * Button component.
 *
 * Variants: primary | secondary | ghost | destructive | outline
 * Sizes: sm | md | lg
 *
 * Features:
 *  - Press opacity feedback via Animated
 *  - Disabled state with reduced opacity
 *  - Loading spinner overlay
 *  - Haptic feedback on press
 */

import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [disabled, loading, onPress]);

  const bgColor: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    ghost: 'transparent',
    destructive: colors.destructive,
    outline: 'transparent',
  };

  const textColor: Record<Variant, string> = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    ghost: colors.primary,
    destructive: colors.destructiveForeground,
    outline: colors.primary,
  };

  const padding: Record<Size, { paddingVertical: number; paddingHorizontal: number }> = {
    sm: { paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
    md: { paddingVertical: spacing[3], paddingHorizontal: spacing[5] },
    lg: { paddingVertical: spacing[4], paddingHorizontal: spacing[7] },
  };

  const textSize: Record<Size, number> = {
    sm: fontSize.sm,
    md: fontSize.base,
    lg: fontSize.md,
  };

  const isOutline = variant === 'outline';

  return (
    <Animated.View style={{ transform: [{ scale }], width: fullWidth ? '100%' : undefined }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.base,
          {
            backgroundColor: bgColor[variant],
            borderWidth: isOutline ? 1 : 0,
            borderColor: isOutline ? colors.primary : undefined,
            borderRadius: radius.md,
            opacity: disabled ? 0.5 : 1,
            ...padding[size],
          },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor[variant]} />
        ) : (
          <Text
            style={[
              styles.text,
              {
                color: textColor[variant],
                fontSize: textSize[size],
                fontFamily: fontFamily.semiBold,
              },
            ]}
          >
            {children}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    textAlign: 'center',
  },
});
