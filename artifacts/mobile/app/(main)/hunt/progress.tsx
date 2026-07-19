/**
 * Hunt Progress Screen — Worlds
 *
 * Controlled placeholder for Hunt Progress, leaderboards, and completion history.
 * Full implementation in Prompt 14.
 *
 * Prompt 14 will add:
 * - Personal Hunt stats and streaks
 * - Hunt completion history with proof status
 * - Hunt leaderboards per occurrence
 * - Stop-level proof status view
 * - Points earned from hunts
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

export default function HuntProgressScreen() {
  const colors = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Feather name="bar-chart-2" size={48} color={colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.foreground }]}>Hunt Progress</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Your Hunt stats, leaderboards, and completion history will be available in a future update.
        </Text>
        <View style={[styles.pill, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.pillText, { color: colors.mutedForeground }]}>Coming in Prompt 14</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing[8], gap: spacing[4],
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  body: {
    fontFamily: fontFamily.regular, fontSize: fontSize.base,
    lineHeight: 24, textAlign: 'center', maxWidth: 300,
  },
  pill: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  pillText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
});
