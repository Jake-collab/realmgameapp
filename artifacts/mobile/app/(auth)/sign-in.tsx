/**
 * Sign In screen — placeholder.
 * Full implementation arrives in Build 2 (Authentication step).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing[6],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Sign In</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Authentication UI coming in Build 2.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
});
