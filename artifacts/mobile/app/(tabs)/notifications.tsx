/**
 * Notifications screen — placeholder.
 * Full implementation in a later Build step.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

export default function NotificationsScreen() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Feather name="bell" size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your alerts will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});
