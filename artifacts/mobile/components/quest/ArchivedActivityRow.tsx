/**
 * ArchivedActivityRow — A single entry in Other Activity (abandoned/expired/rejected).
 * Never labels these as "Completed".
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import QuestTypeBadge from './QuestTypeBadge';
import type { OtherActivityItem } from '@/features/quests/types/questProgress.types';
import type { ParticipationStatus } from '@/lib/supabase/database.types';

interface Props {
  item: OtherActivityItem;
}

function statusDisplay(status: ParticipationStatus): { label: string; icon: React.ComponentProps<typeof Feather>['name'] } {
  switch (status) {
    case 'abandoned': return { label: 'Abandoned', icon: 'minus-circle' };
    case 'expired':   return { label: 'Expired',   icon: 'clock' };
    case 'rejected':  return { label: 'Rejected',  icon: 'x-circle' };
    default:          return { label: status,       icon: 'circle' };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ArchivedActivityRow({ item }: Props) {
  const colors = useColors();
  const sd = statusDisplay(item.status);

  function handlePress() {
    router.push(`/quest-other-activity/${item.participationId}`);
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.quest?.title ?? 'Quest'} — ${sd.label}${item.finalizedAt ? ` on ${formatDate(item.finalizedAt)}` : ''}`}
    >
      {/* Icon */}
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name={sd.icon} size={18} color={colors.mutedForeground} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {item.quest?.title ?? 'Quest'}
        </Text>
        <View style={styles.metaRow}>
          {item.quest?.quest_type && (
            <QuestTypeBadge questType={item.quest.quest_type} compact />
          )}
          <Text style={[styles.status, { color: colors.mutedForeground }]}>{sd.label}</Text>
          {item.finalizedAt && (
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {formatDate(item.finalizedAt)}
            </Text>
          )}
        </View>
        {item.canRestart && (
          <View style={[styles.restartBadge, { backgroundColor: colors.primary + '15' }]}>
            <Feather name="refresh-cw" size={10} color={colors.primary} />
            <Text style={[styles.restartText, { color: colors.primary }]}>Restartable</Text>
          </View>
        )}
      </View>

      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.35,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  status: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  restartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  restartText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
});
