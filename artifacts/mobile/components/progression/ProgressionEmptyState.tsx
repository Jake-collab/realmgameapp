/**
 * ProgressionEmptyState — Reusable empty/error state for Progression sections.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface Props {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

const WORLDS_PURPLE = '#7C3AED';

export default function ProgressionEmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={28} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
      {actionLabel && onAction && (
        <Pressable
          style={[styles.btn, { backgroundColor: WORLDS_PURPLE }]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.btnLabel}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center', paddingVertical: spacing[10],
    paddingHorizontal: spacing[6], gap: spacing[3],
  },
  iconBox: {
    width: 64, height: 64, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1],
  },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, textAlign: 'center' },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.55, textAlign: 'center' },
  btn: {
    marginTop: spacing[2], paddingHorizontal: spacing[6],
    paddingVertical: spacing[3], borderRadius: radius.xl,
  },
  btnLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: '#fff' },
});
