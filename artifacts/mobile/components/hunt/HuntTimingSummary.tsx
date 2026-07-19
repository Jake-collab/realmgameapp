/**
 * HuntTimingSummary — Worlds
 *
 * Displays Hunt timing info: start time, join window, deadline.
 * Uses local display time. Does NOT rely on device-clock countdowns.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';

interface HuntTimingSummaryProps {
  startsAt: string | null;
  endsAt: string | null;
  joinUntil?: string | null;
  estimatedMinutes?: number | null;
  compact?: boolean;
}

export function HuntTimingSummary({
  startsAt,
  endsAt,
  joinUntil,
  estimatedMinutes,
  compact = false,
}: HuntTimingSummaryProps) {
  const colors = useColors();

  const startLabel = startsAt ? formatDateTime(startsAt) : 'Available Now';
  const endLabel   = endsAt   ? formatDateTime(endsAt)   : null;
  const durationLabel = estimatedMinutes ? formatDuration(estimatedMinutes) : null;
  const isExpired = endsAt ? new Date(endsAt) < new Date() : false;

  return (
    <View style={styles.container}>
      {compact ? (
        <View style={styles.row}>
          {estimatedMinutes && (
            <TimingRow icon="clock" label={durationLabel!} color={colors.mutedForeground} />
          )}
          {startsAt && (
            <TimingRow
              icon="calendar"
              label={startLabel}
              color={isExpired ? colors.destructive : colors.mutedForeground}
            />
          )}
        </View>
      ) : (
        <>
          {startsAt && (
            <TimingRow
              icon="calendar"
              label={`Starts ${startLabel}`}
              color={isExpired ? colors.destructive : colors.foreground}
            />
          )}
          {endLabel && (
            <TimingRow
              icon="flag"
              label={isExpired ? `Ended ${endLabel}` : `Ends ${endLabel}`}
              color={isExpired ? colors.destructive : colors.mutedForeground}
            />
          )}
          {joinUntil && !isExpired && (
            <TimingRow
              icon="user-plus"
              label={`Join by ${formatDateTime(joinUntil)}`}
              color={colors.mutedForeground}
            />
          )}
          {durationLabel && (
            <TimingRow
              icon="clock"
              label={`~${durationLabel}`}
              color={colors.mutedForeground}
            />
          )}
        </>
      )}
    </View>
  );
}

function TimingRow({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.row}>
      <Feather name={icon as any} size={13} color={color} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 0) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Tomorrow ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === -1) return `Yesterday`;
    if (Math.abs(diffDays) < 7) {
      return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const styles = StyleSheet.create({
  container: { gap: spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flexWrap: 'wrap',
  },
  text: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
