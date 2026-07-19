/**
 * UnorderedStopSelector — Worlds (Prompt 13)
 *
 * Stop list for unordered hunts. Allows user to choose any authorized stop.
 * Shows status, distance, required/optional label, and primary action.
 *
 * Rules:
 * - Only shows authorized (non-locked) stops
 * - Optional stops clearly labeled
 * - Required progress excludes optional stops
 * - No exact protected coordinates shown
 * - No hidden clues for non-authorized stops
 */

import React from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ActiveHuntStop } from '@/features/hunts/types/hunt.types';
import type { StopActionResult } from '@/features/active-hunt/types/activeHunt.types';

export interface StopRowData {
  stop:   ActiveHuntStop;
  action: StopActionResult;
  distanceLabel?: string;
}

interface UnorderedStopSelectorProps {
  availableStops:  StopRowData[];
  completedStops:  StopRowData[];
  onStopSelect:    (stop: ActiveHuntStop) => void;
  selectedStopId?: string | null;
}

export function UnorderedStopSelector({
  availableStops,
  completedStops,
  onStopSelect,
  selectedStopId,
}: UnorderedStopSelectorProps) {
  const colors = useColors();

  const sections = [
    ...(availableStops.length > 0 ? [{ title: 'Available', data: availableStops }] : []),
    ...(completedStops.length > 0 ? [{ title: 'Completed', data: completedStops }] : []),
  ];

  if (sections.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.foreground }]}>Stops</Text>
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {section.title}
          </Text>
          {section.data.map(row => (
            <StopRow
              key={row.stop.id}
              row={row}
              isSelected={row.stop.id === selectedStopId}
              onPress={() => onStopSelect(row.stop)}
              colors={colors}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function StopRow({
  row, isSelected, onPress, colors,
}: {
  row: StopRowData;
  isSelected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { stop, action, distanceLabel } = row;
  const isCompleted   = stop.progressStatus === 'completed';
  const isUnderReview = ['under_review', 'awaiting_proof'].includes(stop.progressStatus);
  const isResubmit    = ['needs_resubmission', 'rejected'].includes(stop.progressStatus);

  const statusColor = isCompleted    ? '#10B981' :
                      isUnderReview  ? '#F59E0B' :
                      isResubmit     ? '#EF4444' :
                      colors.hunt;

  const statusIcon: string =
    isCompleted    ? 'check-circle' :
    isUnderReview  ? 'clock'        :
    isResubmit     ? 'alert-circle' :
    stop.progressStatus === 'locked' ? 'lock' :
    'map-pin';

  const borderColor = isSelected ? colors.hunt : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={action.actionType === 'locked' || action.actionType === 'expired'}
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor },
        isSelected && styles.rowSelected,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${stop.title}. ${action.label}.`}
      accessibilityState={{ selected: isSelected, disabled: !action.isEnabled }}
    >
      {/* Status icon */}
      <View style={[styles.iconWrap, { backgroundColor: statusColor + '18' }]}>
        <Feather name={statusIcon as any} size={18} color={statusColor} />
      </View>

      {/* Stop info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.stopTitle, { color: colors.foreground }]} numberOfLines={1}>
            {stop.title}
          </Text>
          {!stop.isRequired && (
            <View style={[styles.optionalTag, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>Optional</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {distanceLabel && (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{distanceLabel}</Text>
          )}
          {stop.estimatedDurationMinutes && (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              ~{stop.estimatedDurationMinutes}m
            </Text>
          )}
        </View>
      </View>

      {/* Action badge */}
      <View style={[styles.actionBadge, {
        backgroundColor: action.isEnabled ? colors.hunt + '18' : colors.secondary,
      }]}>
        <Text style={[styles.actionText, {
          color: action.isEnabled ? colors.hunt : colors.mutedForeground,
        }]} numberOfLines={1}>
          {action.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:     { gap: spacing[2] },
  sectionHeader: { fontFamily: fontFamily.bold, fontSize: fontSize.base, marginBottom: spacing[1] },
  section:       { gap: spacing[2] },
  sectionLabel:  { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    borderRadius:  radius.lg,
    borderWidth:   1,
    padding:       spacing[4],
  },
  rowSelected: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  info:    { flex: 1, gap: spacing[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  stopTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, flex: 1 },
  metaRow:   { flexDirection: 'row', gap: spacing[3] },
  meta:      { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  optionalTag: {
    paddingHorizontal: spacing[2],
    paddingVertical:   2,
    borderRadius:      radius.sm,
  },
  optionalText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  actionBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical:   spacing[1],
    borderRadius:      radius.md,
    maxWidth:          100,
    alignItems:        'center',
  },
  actionText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, textAlign: 'center' },
});
