/**
 * SafetyNotice
 *
 * Displayed only when a quest has meaningful safety notes.
 * Do NOT show on every harmless quest — check for actual content first.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface Props {
  notes: string;
}

export default function SafetyNotice({ notes }: Props) {
  const colors = useColors();

  if (!notes.trim()) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.warning + '12',
          borderColor: colors.warning + '40',
          borderRadius: radius.lg,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Safety notice: ${notes}`}
    >
      <View style={styles.header}>
        <Feather name="alert-triangle" size={15} color={colors.warning} />
        <Text style={[styles.title, { color: colors.warning, fontFamily: fontFamily.semiBold }]}>
          Safety Notice
        </Text>
      </View>
      <Text style={[styles.notes, { color: colors.foreground, fontFamily: fontFamily.regular }]}>
        {notes}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    gap: spacing[2],
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontSize: fontSize.sm,
  },
  notes: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.55,
  },
});
