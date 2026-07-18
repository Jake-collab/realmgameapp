/**
 * Input component.
 *
 * Features:
 *  - Animated focus border
 *  - Error state with message
 *  - Label support
 *  - Left/right icon slots
 *  - Secure text entry toggle (for passwords)
 */

import React, { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** When true, adds a visibility toggle for password inputs */
  secure?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    containerStyle,
    leftIcon,
    rightIcon,
    secure = false,
    secureTextEntry,
    style,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const borderColor = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      Animated.timing(borderColor, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }).start();
      onFocus?.(e);
    },
    [borderColor, onFocus]
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      Animated.timing(borderColor, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
      onBlur?.(e);
    },
    [borderColor, onBlur]
  );

  const animatedBorderColor = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.destructive : colors.border,
      error ? colors.destructive : colors.primary,
    ],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: isFocused ? colors.primary : colors.mutedForeground },
          ]}
        >
          {label}
        </Text>
      )}

      <Animated.View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.input,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: animatedBorderColor,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: fontFamily.regular,
              fontSize: fontSize.base,
              flex: 1,
            },
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secure ? !isSecureVisible : secureTextEntry}
          {...props}
        />

        {secure ? (
          <TouchableOpacity
            onPress={() => setIsSecureVisible((v) => !v)}
            style={styles.iconRight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={isSecureVisible ? 'eye-off' : 'eye'}
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        ) : (
          rightIcon && <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </Animated.View>

      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing[1.5],
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  input: {
    paddingVertical: spacing[3],
  },
  iconLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
