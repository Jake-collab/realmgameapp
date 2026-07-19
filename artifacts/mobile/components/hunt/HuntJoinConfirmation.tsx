/**
 * HuntJoinConfirmation — Worlds
 *
 * Modal shown before a user confirms joining a Hunt.
 * Ensures the user can see key participation terms before committing.
 *
 * Shows:
 * - Hunt title + mode + stops + duration
 * - Start timing + completion deadline
 * - Location requirement + proof requirement
 * - Points reward
 * - Safety acknowledgment (where meaningful)
 *
 * Buttons: Not Now | Join Hunt
 *
 * Must NOT award points. Must NOT optimistically claim capacity.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import PointsBadge from '@/components/ui/PointsBadge';
import type { HuntDetail } from '@/features/hunts/types/hunt.types';

interface HuntJoinConfirmationProps {
  visible: boolean;
  hunt: Pick<HuntDetail,
    | 'title'
    | 'participationMode'
    | 'stopCount'
    | 'estimatedDurationMinutes'
    | 'pointsReward'
    | 'startsAt'
    | 'endsAt'
    | 'safetyNote'
  > & {
    requiresLocation?: boolean;
    requiresProof?: boolean;
  };
  isLoading?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function HuntJoinConfirmation({
  visible,
  hunt,
  isLoading = false,
  onConfirm,
  onDismiss,
}: HuntJoinConfirmationProps) {
  const colors = useColors();

  const modeLabel = hunt.participationMode === 'solo'
    ? 'Solo'
    : hunt.participationMode === 'group'
      ? 'Group'
      : 'Solo or Group';

  const durationLabel = hunt.estimatedDurationMinutes
    ? hunt.estimatedDurationMinutes < 60
      ? `~${hunt.estimatedDurationMinutes} min`
      : `~${(hunt.estimatedDurationMinutes / 60).toFixed(1)} hrs`
    : null;

  const startLabel = hunt.startsAt
    ? new Date(hunt.startsAt) > new Date()
      ? `Starts ${new Date(hunt.startsAt).toLocaleDateString()}`
      : 'Available now'
    : 'Available now';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Title */}
            <Text style={[styles.huntTitle, { color: colors.foreground }]} numberOfLines={2}>
              {hunt.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Review details before joining
            </Text>

            {/* Detail rows */}
            <View style={[styles.details, { borderColor: colors.border }]}>
              <DetailRow icon="users" label="Mode" value={modeLabel} colors={colors} />
              <DetailRow icon="map-pin" label="Stops" value={`${hunt.stopCount}`} colors={colors} />
              {durationLabel && (
                <DetailRow icon="clock" label="Duration" value={durationLabel} colors={colors} />
              )}
              <DetailRow icon="calendar" label="Timing" value={startLabel} colors={colors} />
              {hunt.requiresLocation && (
                <DetailRow icon="navigation" label="Location" value="GPS required at some stops" colors={colors} />
              )}
              {hunt.requiresProof && (
                <DetailRow icon="camera" label="Proof" value="Photo or text required at some stops" colors={colors} />
              )}
            </View>

            {/* Points */}
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsLabel, { color: colors.mutedForeground }]}>
                Reward on completion
              </Text>
              <PointsBadge value={hunt.pointsReward} size="lg" />
            </View>

            {/* Safety reminder */}
            {(hunt.requiresLocation || hunt.safetyNote) && (
              <View style={[styles.safetyBox, { backgroundColor: '#FEF9C3', borderColor: '#FDE047' }]}>
                <Feather name="alert-triangle" size={13} color="#854D0E" />
                <Text style={styles.safetyText}>
                  {hunt.safetyNote ?? 'Stay in public areas. Do not use while driving. Follow all posted rules.'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="ghost"
              size="md"
              onPress={onDismiss}
              disabled={isLoading}
              style={styles.actionBtn}
            >
              Not Now
            </Button>
            <Button
              variant="primary"
              size="md"
              onPress={onConfirm}
              disabled={isLoading}
              loading={isLoading}
              style={styles.actionBtn}
            >
              {isLoading ? 'Joining…' : 'Join Hunt'}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({
  icon, label, value, colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <View style={styles.detailLeft}>
        <Feather name={icon as any} size={14} color={colors.mutedForeground} />
        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing[5],
    paddingTop: spacing[3],
    maxHeight: '90%',
    gap: spacing[4],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[1],
  },
  huntTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginBottom: spacing[4],
  },
  details: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  detailLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  detailValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    maxWidth: '55%',
    textAlign: 'right',
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  pointsLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  safetyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: '#854D0E',
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingTop: spacing[2],
  },
  actionBtn: { flex: 1 },
});
