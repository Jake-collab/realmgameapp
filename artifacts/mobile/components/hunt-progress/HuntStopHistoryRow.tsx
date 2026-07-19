/**
 * HuntStopHistoryRow — A single stop entry in the completion detail stop list.
 * Never exposes locked clue content or private geometry.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntStopHistoryEntry } from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

interface Props {
  entry: HuntStopHistoryEntry;
}

function stopStatusConfig(
  status: string,
  colors: ReturnType<typeof useColors>,
) {
  switch (status) {
    case 'completed':         return { color: HUNT_COLOR,              icon: 'check-circle' as const };
    case 'awaiting_proof':    return { color: colors.warning,          icon: 'upload' as const };
    case 'under_review':      return { color: colors.mutedForeground,  icon: 'clock' as const };
    case 'needs_resubmission':return { color: colors.destructive,      icon: 'alert-circle' as const };
    case 'in_progress':       return { color: HUNT_COLOR,              icon: 'navigation' as const };
    default:                  return { color: colors.mutedForeground,  icon: 'circle' as const };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
}

export default function HuntStopHistoryRow({ entry }: Props) {
  const colors = useColors();
  const sc = stopStatusConfig(entry.stopStatus, colors);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Stop ${entry.stopNumber != null ? entry.stopNumber : ''}: ${entry.stopTitle}. Status: ${entry.stopStatus}${entry.completedAt ? '. Completed ' + formatDate(entry.completedAt) : ''}`}
    >
      <View style={[styles.iconBox, { backgroundColor: sc.color + '18' }]}>
        <Feather name={sc.icon} size={16} color={sc.color} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {entry.stopNumber != null && (
            <Text style={[styles.stopNum, { color: colors.mutedForeground }]}>
              {entry.stopNumber}.{'  '}
            </Text>
          )}
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {entry.stopTitle}
          </Text>
          {!entry.isRequired && (
            <View style={[styles.optBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.optText, { color: colors.mutedForeground }]}>optional</Text>
            </View>
          )}
        </View>

        {/* Proof summary — never shows URL or raw media */}
        {entry.proofStatus && entry.proofStatus !== 'none' && (
          <View style={styles.proofRow}>
            {entry.hasImage && (
              <View style={[styles.proofBadge, { backgroundColor: colors.muted }]}>
                <Feather name="image" size={10} color={colors.mutedForeground} />
              </View>
            )}
            {entry.hasTextResponse && (
              <View style={[styles.proofBadge, { backgroundColor: colors.muted }]}>
                <Feather name="type" size={10} color={colors.mutedForeground} />
              </View>
            )}
            {entry.locationVerified && (
              <View style={[styles.proofBadge, { backgroundColor: colors.muted }]}>
                <Feather name="map-pin" size={10} color={colors.mutedForeground} />
              </View>
            )}
            <Text style={[styles.proofStatus, { color: colors.mutedForeground }]}>
              {entry.proofStatus === 'approved' ? 'Approved' : entry.proofStatus}
            </Text>
          </View>
        )}

        {entry.completedAt && (
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(entry.completedAt)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: spacing[3], paddingVertical: spacing[2],
  },
  iconBox: {
    width: 30, height: 30, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  stopNum: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  title: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, flex: 1 },
  optBadge: {
    paddingHorizontal: spacing[1], paddingVertical: 1,
    borderRadius: radius.sm,
  },
  optText: { fontFamily: fontFamily.regular, fontSize: 10 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  proofBadge: {
    width: 18, height: 18, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  proofStatus: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
