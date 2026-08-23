/**
 * FilterBottomSheet — Completed section filter and sort sheet.
 * Uses a Modal with slide-from-bottom presentation.
 */

import React, { useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { CompletedFilter } from '@/features/quests/types/questProgress.types';
import type { QuestType } from '@/lib/supabase/database.types';

interface Props {
  visible: boolean;
  filter: CompletedFilter;
  onApply: (filter: CompletedFilter) => void;
  onDismiss: () => void;
}

const QUEST_TYPE_OPTIONS: { value: QuestType | 'all'; label: string }[] = [
  { value: 'all',     label: 'All Types' },
  { value: 'daily',   label: 'Daily Quests' },
  { value: 'monthly', label: 'Monthly Drops' },
  { value: 'geo',     label: 'Geo-Quests' },
];

const SORT_OPTIONS: { value: CompletedFilter['sortOrder']; label: string }[] = [
  { value: 'newest',        label: 'Most Recent' },
  { value: 'oldest',        label: 'Oldest First' },
  { value: 'highest_points', label: 'Highest Points' },
];

export default function FilterBottomSheet({ visible, filter, onApply, onDismiss }: Props) {
  const colors = useColors();
  const [draft, setDraft] = useState<CompletedFilter>(filter);

  function handleApply() {
    onApply(draft);
    onDismiss();
  }

  function handleReset() {
    const reset: CompletedFilter = { questType: 'all', sortOrder: 'newest' };
    setDraft(reset);
    onApply(reset);
    onDismiss();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Filter & Sort</Text>
            <Pressable onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Quest Type */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Quest Type</Text>
            <View style={styles.options}>
              {QUEST_TYPE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.option,
                    {
                      backgroundColor: draft.questType === opt.value ? colors.primary : colors.muted,
                      borderColor: draft.questType === opt.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setDraft(d => ({ ...d, questType: opt.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.questType === opt.value }}
                >
                  <Text style={[
                    styles.optionLabel,
                    { color: draft.questType === opt.value ? '#fff' : colors.foreground },
                  ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Sort Order */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Sort Order</Text>
            <View style={styles.options}>
              {SORT_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.option,
                    {
                      backgroundColor: draft.sortOrder === opt.value ? colors.primary : colors.muted,
                      borderColor: draft.sortOrder === opt.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setDraft(d => ({ ...d, sortOrder: opt.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.sortOrder === opt.value }}
                >
                  <Text style={[
                    styles.optionLabel,
                    { color: draft.sortOrder === opt.value ? '#fff' : colors.foreground },
                  ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable
              style={[styles.resetBtn, { borderColor: colors.border }]}
              onPress={handleReset}
              accessibilityRole="button"
            >
              <Text style={[styles.resetLabel, { color: colors.foreground }]}>Reset</Text>
            </Pressable>
            <Pressable
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={handleApply}
              accessibilityRole="button"
            >
              <Text style={styles.applyLabel}>Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '80%',
    padding: spacing[5],
    gap: spacing[4],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
  },
  sectionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginTop: spacing[2],
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  option: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[4],
  },
  resetBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  applyLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#fff',
  },
});
