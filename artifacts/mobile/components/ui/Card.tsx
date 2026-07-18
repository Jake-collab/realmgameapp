/**
 * Card component.
 *
 * Variants: default | elevated | outlined
 * A pressable variant is available when onPress is provided.
 */

import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { shadows } from '@/constants/theme';
import { radius, spacing } from '@/constants/spacing';

type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  haptic?: boolean;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  contentStyle,
  haptic = true,
}: CardProps) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (!onPress) return;
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  }, [scale, onPress]);

  const handlePressOut = useCallback(() => {
    if (!onPress) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }, [scale, onPress]);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress, haptic]);

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: variant === 'outlined' ? 1 : 0,
    borderColor: variant === 'outlined' ? colors.border : undefined,
    ...(variant === 'elevated' ? shadows.md : {}),
  };

  const content = (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  if (onPress) {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={cardStyle}
        >
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={[cardStyle, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[4],
  },
});
