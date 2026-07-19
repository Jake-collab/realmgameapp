/**
 * TitleCard — A single unlocked title. Active title highlighted in purple.
 * Tapping selects it as the active title via onSelect.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { UserTitle } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

interface Props {
  title: UserTitle;
  onSelect: (titleId: string) => void;
  isSelectingId?: string | null;
}

export default function TitleCard({ title, onSelect, isSelectingId }: Props) {
  const colors    = useColors();
  const isActive  = title.isActive;
  const isLoading = isSelectingId === title.titleId;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isActive ? WORLDS_PURPLE + '12' : colors.card,
          borderColor: isActive ? WORLDS_PURPLE + '40' : colors.border,
          opacity: pressed || isLoading ? 0.82 : 1,
        },
      ]}
      onPress={() => { if (!isActive && !isLoading) onSelect(title.titleId); }}
      disabled={isActive}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive, disabled: isActive }}
      accessibilityLabel={`${title.name}${isActive ? ' — your active title' : ''}. ${title.description}`}
    >
      <View style={styles.left}>
        <View style={[styles.iconBox, { backgroundColor: WORLDS_PURPLE + '18' }]}>
          <Feather name="tag" size={16} color={WORLDS_PURPLE} />
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.name, { color: colors.foreground }]}>{title.name}</Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
            {title.description}
          </Text>
        </View>
      </View>

      {isActive && (
        <View style={[styles.activePill, { backgroundColor: WORLDS_PURPLE + '20' }]}>
          <Text style={[styles.activePillLabel, { color: WORLDS_PURPLE }]}>Active</Text>
        </View>
      )}
      {!isActive && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  iconBox: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  desc: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  activePill: {
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  activePillLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
});
