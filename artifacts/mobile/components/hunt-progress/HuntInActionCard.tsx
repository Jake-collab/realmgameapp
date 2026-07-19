/**
 * HuntInActionCard — In Action card for an active/paused Hunt participation.
 *
 * Shows hunt title, stop progress, pending stop status, deadline warning.
 * Routes to the active hunt screen on CTA tap.
 * Never shows locked clue content or private geometry.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntInActionItem } from '@/features/hunts/types/huntProgress.types';

const HUNT_COLOR = '#059669';

interface Props {
  item: HuntInActionItem;
}

function stopStatusConfig(
  stopStatus: string | null | undefined,
  colors: ReturnType<typeof useColors>,
) {
  switch (stopStatus) {
    case 'needs_resubmission':
      return { color: colors.destructive, icon: 'alert-circle' as const, label: 'Needs Resubmission' };
    case 'awaiting_proof':
      return { color: colors.warning, icon: 'upload' as const, label: 'Ready to Submit Proof' };
    case 'in_progress':
      return { color: HUNT_COLOR, icon: 'navigation' as const, label: 'Stop In Progress' };
    case 'under_review':
      return { color: colors.mutedForeground, icon: 'clock' as const, label: 'Proof Under Review' };
    case 'rejected':
      return { color: colors.destructive, icon: 'x-circle' as const, label: 'Proof Rejected' };
    default:
      return { color: HUNT_COLOR, icon: 'play-circle' as const, label: 'Active Hunt' };
  }
}

function deadlineWarning(deadline: string | null): string | null {
  if (!deadline) return null;
  const dl  = new Date(deadline);
  const now = new Date();
  const diffMs = dl.getTime() - now.getTime();
  if (diffMs <= 0) return 'Deadline passed';
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 24) return `${diffH}h remaining`;
  const diffD = Math.floor(diffH / 24);
  if (diffD <= 3) return `${diffD}d remaining`;
  return null;
}

function progressPercent(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export default function HuntInActionCard({ item }: Props) {
  const colors = useColors();
  const stopStatus = item.pendingStop?.stopStatus ?? null;
  const sc = stopStatusConfig(stopStatus, colors);
  const warning = deadlineWarning(item.completionDeadline);

  const isUrgent =
    stopStatus === 'needs_resubmission' ||
    stopStatus === 'awaiting_proof' ||
    stopStatus === 'rejected';

  const pct = progressPercent(item.stopsCompleted, item.stopsRequired);

  function handlePress() {
    router.push(`/hunt-active/${item.participationId}`);
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isUrgent ? sc.color + '44' : colors.border,
          borderLeftColor: sc.color,
        },
      ]}
    >
      {/* Status + deadline */}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: sc.color + '18' }]}>
          <Feather name={sc.icon} size={12} color={sc.color} />
          <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
        </View>
        {warning && (
          <View style={[styles.warningPill, { backgroundColor: colors.warning + '20' }]}>
            <Feather name="clock" size={11} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>{warning}</Text>
          </View>
        )}
      </View>

      {/* Hunt title */}
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {item.huntTitle}
      </Text>

      {/* Stop progress */}
      {item.stopsRequired > 0 && (
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: HUNT_COLOR, width: `${pct}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {item.stopsCompleted}/{item.stopsRequired} stops
          </Text>
        </View>
      )}

      {/* Pending stop name */}
      {item.pendingStop?.stopTitle && (
        <Text style={[styles.pendingStop, { color: colors.mutedForeground }]} numberOfLines={1}>
          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
          {'  '}{item.pendingStop.stopTitle}
        </Text>
      )}

      {/* Safe review note */}
      {item.pendingStop?.safeReviewNote && (
        <View style={[styles.noteBox, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '30' }]}>
          <Text style={[styles.noteText, { color: colors.foreground }]}>
            {item.pendingStop.safeReviewNote}
          </Text>
        </View>
      )}

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaBtn,
          { backgroundColor: isUrgent ? sc.color : HUNT_COLOR, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Continue ${item.huntTitle}`}
      >
        <Text style={styles.ctaLabel}>
          {isUrgent ? 'Address Issue' : 'Continue Hunt'}
        </Text>
        <Feather name="arrow-right" size={14} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4, padding: spacing[4], gap: spacing[3],
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[2], flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  statusLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  warningPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  warningText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base, lineHeight: fontSize.base * 1.35 },
  progressRow: { gap: spacing[1] },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  pendingStop: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  noteBox: { padding: spacing[3], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  noteText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.xl,
  },
  ctaLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: '#fff' },
});
