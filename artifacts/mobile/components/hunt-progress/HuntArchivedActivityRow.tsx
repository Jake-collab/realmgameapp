/**
 * HuntArchivedActivityRow — Withdrawn/removed/cancelled/expired Hunt.
 * Never labels these as "Completed". Taps to Other Activity Detail screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntOtherActivityItem } from '@/features/hunts/types/huntProgress.types';
import type { ParticipantStatus } from '@/features/hunts/types/hunt.types';

interface Props {
  item: HuntOtherActivityItem;
}

function statusDisplay(status: ParticipantStatus): {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
} {
  switch (status) {
    case 'withdrawn':  return { label: 'Withdrew',   icon: 'log-out' };
    case 'removed':    return { label: 'Removed',    icon: 'user-x' };
    case 'cancelled':  return { label: 'Cancelled',  icon: 'x-circle' };
    case 'expired':    return { label: 'Expired',    icon: 'clock' };
    default:           return { label: String(status), icon: 'circle' };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HuntArchivedActivityRow({ item }: Props) {
  const colors = useColors();
  const sd = statusDisplay(item.status);

  function handlePress() {
    router.push(`/hunt-other-activity/${item.participationId}`);
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.huntTitle} — ${sd.label}${item.finalizedAt ? ` on ${formatDate(item.finalizedAt)}` : ''}`}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name={sd.icon} size={18} color={colors.mutedForeground} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {item.huntTitle}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.status, { color: colors.mutedForeground }]}>{sd.label}</Text>
          {item.finalizedAt && (
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {formatDate(item.finalizedAt)}
            </Text>
          )}
          {item.stopsRequired > 0 && (
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {item.stopsCompleted}/{item.stopsRequired} stops
            </Text>
          )}
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 38, height: 38, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing[1] },
  title: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.35 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  status: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
