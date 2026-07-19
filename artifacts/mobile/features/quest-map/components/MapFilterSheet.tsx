/**
 * MapFilterSheet — Worlds
 *
 * Compact filter bottom sheet for the Quest Map.
 * Allows filtering by availability, type, difficulty, duration,
 * indoor/outdoor, and accessibility.
 *
 * Rules:
 * - Does not expose private validation fields.
 * - Does not expose hidden radius or geometry fields.
 * - Active filter count is shown on the trigger button.
 * - "Clear All" returns to DEFAULT_GEO_QUEST_FILTER.
 */

import React, { memo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { GeoQuestMapFilter } from '../types/questMap.types';
import { DEFAULT_GEO_QUEST_FILTER, countActiveFilters } from '../types/questMap.types';

interface MapFilterSheetProps {
  visible: boolean;
  filter: GeoQuestMapFilter;
  onApply: (filter: GeoQuestMapFilter) => void;
  onClose: () => void;
}

function MapFilterSheetComponent({
  visible,
  filter,
  onApply,
  onClose,
}: MapFilterSheetProps) {
  const colors = useColors();
  const [draft, setDraft] = useState<GeoQuestMapFilter>(filter);

  const handleOpen = () => setDraft(filter);
  const handleApply = () => { onApply(draft); onClose(); };
  const handleClear = () => setDraft(DEFAULT_GEO_QUEST_FILTER);

  const activeCount = countActiveFilters(draft);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Filter Quests</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close filters">
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {/* Availability */}
          <FilterSection label="Availability" colors={colors}>
            <ToggleChip
              label="Available now"
              active={draft.availableNow}
              onToggle={() => setDraft(d => ({ ...d, availableNow: !d.availableNow }))}
              colors={colors}
            />
            <ToggleChip
              label="Not completed"
              active={draft.notCompleted}
              onToggle={() => setDraft(d => ({ ...d, notCompleted: !d.notCompleted }))}
              colors={colors}
            />
            <ToggleChip
              label="In Action"
              active={draft.inAction}
              onToggle={() => setDraft(d => ({ ...d, inAction: !d.inAction }))}
              colors={colors}
            />
          </FilterSection>

          {/* Quest type */}
          <FilterSection label="Quest Type" colors={colors}>
            {(['all', 'daily', 'monthly'] as const).map(type => (
              <ToggleChip
                key={type}
                label={type === 'all' ? 'All types' : type.charAt(0).toUpperCase() + type.slice(1)}
                active={draft.questType === type}
                onToggle={() => setDraft(d => ({ ...d, questType: type }))}
                colors={colors}
              />
            ))}
          </FilterSection>

          {/* Difficulty */}
          <FilterSection label="Difficulty" colors={colors}>
            {(['beginner', 'intermediate', 'advanced'] as const).map(diff => (
              <ToggleChip
                key={diff}
                label={diff.charAt(0).toUpperCase() + diff.slice(1)}
                active={draft.difficulties.includes(diff)}
                onToggle={() =>
                  setDraft(d => ({
                    ...d,
                    difficulties: d.difficulties.includes(diff)
                      ? d.difficulties.filter(x => x !== diff)
                      : [...d.difficulties, diff],
                  }))
                }
                colors={colors}
              />
            ))}
          </FilterSection>

          {/* Indoor/Outdoor */}
          <FilterSection label="Setting" colors={colors}>
            {([
              { value: null, label: 'Any' },
              { value: 'indoor', label: 'Indoor' },
              { value: 'outdoor', label: 'Outdoor' },
              { value: 'both', label: 'Both' },
            ] as const).map(({ value, label }) => (
              <ToggleChip
                key={label}
                label={label}
                active={draft.indoorOutdoor === value}
                onToggle={() => setDraft(d => ({ ...d, indoorOutdoor: value }))}
                colors={colors}
              />
            ))}
          </FilterSection>

          {/* Accessibility */}
          <FilterSection label="Accessibility" colors={colors}>
            <ToggleChip
              label="Accessible only"
              active={draft.accessibleOnly}
              onToggle={() => setDraft(d => ({ ...d, accessibleOnly: !d.accessibleOnly }))}
              colors={colors}
            />
          </FilterSection>

          {/* Duration */}
          <FilterSection label="Duration" colors={colors}>
            {([
              { label: 'Any', value: null },
              { label: 'Under 30m', value: 30 },
              { label: 'Under 1h', value: 60 },
              { label: 'Under 2h', value: 120 },
            ] as const).map(({ label, value }) => (
              <ToggleChip
                key={label}
                label={label}
                active={draft.maxDurationMinutes === value}
                onToggle={() => setDraft(d => ({ ...d, maxDurationMinutes: value }))}
                colors={colors}
              />
            ))}
          </FilterSection>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleClear}
            style={[styles.clearButton, { borderColor: colors.border }]}
            disabled={activeCount === 0}
            accessibilityLabel="Clear all filters"
          >
            <Text style={[styles.clearText, { color: activeCount > 0 ? colors.primary : colors.mutedForeground }]}>
              Clear all
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApply}
            style={[styles.applyButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
          >
            <Text style={[styles.applyText, { color: colors.primaryForeground }]}>
              {activeCount > 0 ? `Apply (${activeCount})` : 'Apply'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export const MapFilterSheet = memo(MapFilterSheetComponent);

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSection({
  label, children, colors,
}: { label: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

interface ToggleChipProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}

function ToggleChip({ label, active, onToggle, colors }: ToggleChipProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.chip,
        { borderColor: active ? colors.accent : colors.border },
        active && { backgroundColor: colors.accent + '18' },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, { color: active ? colors.accent : colors.mutedForeground }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
  },
  scroll: { paddingHorizontal: spacing[4] },
  section: { gap: spacing[2], marginBottom: spacing[4] },
  sectionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  clearText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  applyText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
});
