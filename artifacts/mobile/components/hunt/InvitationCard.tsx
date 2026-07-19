/**
 * InvitationCard — Worlds
 *
 * Displays a Hunt invitation row in My Hunts > Invitations.
 * Shows: hunt title, inviter identity, timing, capacity, status.
 * Primary action: View Invitation.
 * Does NOT expose other invitees or private inviter details.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import PointsBadge from '@/components/ui/PointsBadge';
import type { HuntInvitation } from '@/features/hunts/types/hunt.types';

interface InvitationCardProps {
  invitation: HuntInvitation;
  onView: () => void;
}

export function InvitationCard({ invitation, onView }: InvitationCardProps) {
  const colors = useColors();
  const hunt = invitation.huntSummary;
  const isExpired = invitation.expiresAt ? new Date(invitation.expiresAt) < new Date() : false;

  const statusColor = isExpired
    ? colors.mutedForeground
    : invitation.status === 'pending'
      ? colors.hunt
      : colors.mutedForeground;

  const statusLabel = isExpired
    ? 'Expired'
    : invitation.status === 'pending'
      ? 'Awaiting response'
      : invitation.status;

  return (
    <TouchableOpacity
      onPress={onView}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`Invitation to ${hunt?.title ?? 'a hunt'}. ${statusLabel}. Tap to view.`}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="mail" size={14} color={statusColor} />
          <Text style={[styles.statusPill, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={[styles.expiry, { color: colors.mutedForeground }]}>
          {invitation.expiresAt
            ? isExpired
              ? `Expired ${formatDate(invitation.expiresAt)}`
              : `Expires ${formatDate(invitation.expiresAt)}`
            : ''}
        </Text>
      </View>

      {/* Hunt title */}
      <Text style={[styles.huntTitle, { color: colors.foreground }]} numberOfLines={2}>
        {hunt?.title ?? 'Hunt invitation'}
      </Text>

      {/* Inviter */}
      <Text style={[styles.inviter, { color: colors.mutedForeground }]}>
        From: <Text style={{ fontFamily: fontFamily.semiBold }}>
          {/* Safe: only public display name — no email/private fields */}
          {invitation.inviterUserId ? 'A fellow adventurer' : 'Worlds Team'}
        </Text>
      </Text>

      {/* Meta */}
      {hunt && (
        <View style={styles.meta}>
          {hunt.estimatedDurationMinutes && (
            <MetaChip icon="clock" label={formatDuration(hunt.estimatedDurationMinutes)} colors={colors} />
          )}
          {hunt.stopCount > 0 && (
            <MetaChip icon="map-pin" label={`${hunt.stopCount} stops`} colors={colors} />
          )}
          <MetaChip
            icon="users"
            label={hunt.capacityState?.isFull ? 'Full' : `${hunt.capacityState?.currentCount ?? 0} joined`}
            colors={colors}
          />
          {hunt.pointsReward > 0 && (
            <PointsBadge value={hunt.pointsReward} size="sm" />
          )}
        </View>
      )}

      {/* View action */}
      <View style={[styles.action, { borderTopColor: colors.border }]}>
        <Text style={[styles.actionText, { color: isExpired ? colors.mutedForeground : colors.hunt }]}>
          {isExpired ? 'View Details' : 'View Invitation'}
        </Text>
        <Feather name="chevron-right" size={16} color={isExpired ? colors.mutedForeground : colors.hunt} />
      </View>
    </TouchableOpacity>
  );
}

function MetaChip({
  icon, label, colors,
}: { icon: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
      <Feather name={icon as any} size={11} color={colors.mutedForeground} />
      <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    gap: spacing[2],
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  statusPill: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'capitalize',
  },
  expiry: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  huntTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  inviter: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  chipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  action: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    marginTop: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
});
