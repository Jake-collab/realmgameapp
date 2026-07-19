/**
 * HuntFilterSheet — Worlds
 *
 * Compact filter bottom sheet for the Hunt Map.
 * Preserves filters while user remains on Hunt mode.
 * Does NOT expose: private geometry, validation radius, moderation state,
 * internal capacity fields, creator role IDs.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { DEFAULT_HUNT_MAP_FILTER } from '../types/huntMap.types';
import type { HuntMapFilter } from '../types/huntMap.types';
import type { Difficulty, ParticipationMode } from '@/features/hunts/types/hunt.types';

interface HuntFilterSheetProps {
  visible: boolean;
  filter: HuntMapFilter;
  onApply: (filter: HuntMapFilter) => void;
  onClose: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'very_easy', label: 'Very Easy' },
  { value: 'easy',      label: 'Easy' },
  { value: 'medium',    label: 'Medium' },
  { value: 'hard',      label: 'Hard' },
  { value: 'epic',      label: 'Epic' },
];

const DURATIONS: { value: number; label: string }[] = [
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hr' },
  { value: 120, label: '2 hrs' },
  { value: 240, label: '4 hrs' },
];

export function HuntFilterSheet({ visible, filter, onApply, onClose }: HuntFilterSheetProps) {
  const colors = useColors();
  const [draft, setDraft] = useState<HuntMapFilter>(filter);

  // Reset draft when sheet opens
  React.useEffect(() => {
    if (visible) setDraft(filter);
  }, [visible]);

  const toggle = <K extends keyof HuntMapFilter>(key: K, value: HuntMapFilter[K]) => {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key] === value ? (typeof value === 'boolean' ? false : null) : value,
    }));
  };

  const toggleDifficulty = (d: Difficulty) => {
    setDraft(prev => ({
      ...prev,
      difficulties: prev.difficulties.includes(d)
        ? prev.difficulties.filter(x => x !== d)
        : [...prev.difficulties, d],
    }));
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleClear = () => {
    setDraft(DEFAULT_HUNT_MAP_FILTER);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Filter Hunts</Text>
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearText, { color: colors.hunt }]}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Availability */}
            <FilterSection label="Availability">
              <ToggleRow
                label="Available Now"
                active={draft.availableNow}
                onPress={() => setDraft(prev => ({ ...prev, availableNow: !prev.availableNow }))}
                colors={colors}
              />
              <ToggleRow
                label="Starting Soon"
                active={draft.startingSoon}
                onPress={() => setDraft(prev => ({ ...prev, startingSoon: !prev.startingSoon }))}
                colors={colors}
              />
              <ToggleRow
                label="Has Space"
                active={draft.hasSpace}
                onPress={() => setDraft(prev => ({ ...prev, hasSpace: !prev.hasSpace }))}
                colors={colors}
              />
            </FilterSection>

            {/* Participation mode */}
            <FilterSection label="Participation">
              {(['solo', 'group', 'solo_or_group'] as ParticipationMode[]).map(mode => (
                <ToggleRow
                  key={mode}
                  label={mode === 'solo' ? 'Solo' : mode === 'group' ? 'Group' : 'Solo or Group'}
                  active={draft.participationMode === mode}
                  onPress={() => toggle('participationMode', mode)}
                  colors={colors}
                />
              ))}
            </FilterSection>

            {/* Difficulty */}
            <FilterSection label="Difficulty">
              <View style={styles.chipRow}>
                {DIFFICULTIES.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => toggleDifficulty(d.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: draft.difficulties.includes(d.value) ? colors.hunt : colors.secondary,
                        borderColor: draft.difficulties.includes(d.value) ? colors.hunt : colors.border,
                      },
                    ]}
                    accessibilityState={{ selected: draft.difficulties.includes(d.value) }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: draft.difficulties.includes(d.value) ? '#fff' : colors.foreground },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FilterSection>

            {/* Duration */}
            <FilterSection label="Duration">
              <View style={styles.chipRow}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => toggle('maxDurationMinutes', d.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: draft.maxDurationMinutes === d.value ? colors.hunt : colors.secondary,
                        borderColor: draft.maxDurationMinutes === d.value ? colors.hunt : colors.border,
                      },
                    ]}
                    accessibilityState={{ selected: draft.maxDurationMinutes === d.value }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: draft.maxDurationMinutes === d.value ? '#fff' : colors.foreground },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FilterSection>

            {/* Environment */}
            <FilterSection label="Environment">
              {(['indoor', 'outdoor', 'both'] as const).map(env => (
                <ToggleRow
                  key={env}
                  label={env.charAt(0).toUpperCase() + env.slice(1)}
                  active={draft.indoorOutdoor === env}
                  onPress={() => toggle('indoorOutdoor', env)}
                  colors={colors}
                />
              ))}
            </FilterSection>

            {/* Accessibility */}
            <FilterSection label="Accessibility">
              <ToggleRow
                label="Accessible"
                active={draft.accessibleOnly}
                onPress={() => setDraft(prev => ({ ...prev, accessibleOnly: !prev.accessibleOnly }))}
                colors={colors}
              />
            </FilterSection>

            {/* My hunts */}
            <FilterSection label="My Hunts">
              <ToggleRow
                label="In My Hunts"
                active={draft.inMyHunts}
                onPress={() => setDraft(prev => ({ ...prev, inMyHunts: !prev.inMyHunts, notJoined: false }))}
                colors={colors}
              />
              <ToggleRow
                label="Not Joined"
                active={draft.notJoined}
                onPress={() => setDraft(prev => ({ ...prev, notJoined: !prev.notJoined, inMyHunts: false }))}
                colors={colors}
              />
            </FilterSection>
          </ScrollView>

          {/* Apply */}
          <Button variant="primary" size="lg" onPress={handleApply} style={styles.applyBtn}>
            Apply Filters
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label, active, onPress, colors,
}: { label: string; active: boolean; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
    >
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[
        styles.toggle,
        { backgroundColor: active ? colors.hunt : colors.secondary, borderColor: active ? colors.hunt : colors.border },
      ]}>
        {active && <Feather name="check" size={11} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing[5],
    maxHeight: '85%',
    gap: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  clearText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  section: { marginBottom: spacing[4], gap: spacing[2] },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  toggleLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.base },
  toggle: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
  applyBtn: { marginTop: spacing[2] },
});
