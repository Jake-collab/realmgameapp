/**
 * HuntSafetyNotice — Worlds
 *
 * Displays hunt-specific safety notes and general safety reminders.
 * Shown prominently before joining or starting location-sensitive hunts.
 * Do NOT repeat on every harmless screen.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

const GENERAL_SAFETY = [
  'Stay in public, permitted areas.',
  'Do not use this app while driving.',
  'Follow posted rules and operating hours.',
  'Leave the area if conditions feel unsafe.',
];

interface HuntSafetyNoticeProps {
  huntNote?: string | null;
  /** When true, shows the full general safety list */
  expanded?: boolean;
  /** When true, shows only the hunt-specific note (no general list) */
  compact?: boolean;
}

export function HuntSafetyNotice({
  huntNote,
  expanded = false,
  compact = false,
}: HuntSafetyNoticeProps) {
  const colors = useColors();
  const [showAll, setShowAll] = useState(expanded);

  const hasContent = !!huntNote || !compact;
  if (!hasContent) return null;

  return (
    <View style={[styles.container, { backgroundColor: '#FEF9C3', borderColor: '#FDE047' }]}>
      <View style={styles.header}>
        <Feather name="alert-triangle" size={15} color="#854D0E" />
        <Text style={styles.title}>Safety</Text>
        {!compact && !expanded && (
          <TouchableOpacity
            onPress={() => setShowAll(s => !s)}
            accessibilityLabel={showAll ? 'Hide safety details' : 'Show safety details'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={showAll ? 'chevron-up' : 'chevron-down'} size={15} color="#854D0E" />
          </TouchableOpacity>
        )}
      </View>

      {huntNote && (
        <Text style={styles.note}>{huntNote}</Text>
      )}

      {!compact && showAll && (
        <View style={styles.list}>
          {GENERAL_SAFETY.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Feather name="chevron-right" size={11} color="#A16207" />
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#854D0E',
    flex: 1,
  },
  note: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: '#713F12',
    lineHeight: 20,
  },
  list: { gap: spacing[1] },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  listText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: '#854D0E',
    flex: 1,
    lineHeight: 18,
  },
});
