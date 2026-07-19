/**
 * ReadyHuntCard — Worlds
 *
 * Displays a Hunt that the user has joined and is ready to start.
 * Shows readiness reason, start model, timing, and the primary action.
 *
 * Does NOT show:
 * - Locked clue content
 * - Future stop locations
 * - Other participants' identity
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import PointsBadge from '@/components/ui/PointsBadge';
import { Button } from '@/components/ui/Button';
import type { HuntSummary, HuntStartModel } from '@/features/hunts/types/hunt.types';

interface ReadyHuntCardProps {
  hunt: HuntSummary;
  startModel: HuntStartModel;
  minParticipants?: number;
  currentParticipants?: number;
  onStartHunt?: () => void;
  onViewHunt: () => void;
  isStarting?: boolean;
}

export function ReadyHuntCard({
  hunt,
  startModel,
  minParticipants,
  currentParticipants,
  onStartHunt,
  onViewHunt,
  isStarting = false,
}: ReadyHuntCardProps) {
  const colors = useColors();

  const { readinessLabel, readinessDetail, canIndividuallyStart } =
    resolveReadiness(startModel, minParticipants, currentParticipants, hunt.startsAt);

  return (
    <TouchableOpacity
      onPress={onViewHunt}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${hunt.title}. ${readinessLabel}. Tap to view.`}
    >
      {/* Status strip */}
      <View style={[styles.statusStrip, { backgroundColor: colors.hunt + '18' }]}>
        <Feather name="check-circle" size={13} color={colors.hunt} />
        <Text style={[styles.statusText, { color: colors.hunt }]}>Joined — {readinessLabel}</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {hunt.title}
      </Text>

      {/* Readiness detail */}
      <Text style={[styles.detail, { color: colors.mutedForeground }]}>{readinessDetail}</Text>

      {/* Meta */}
      <View style={styles.meta}>
        {hunt.estimatedDurationMinutes && (
          <MetaChip icon="clock" label={`~${formatDuration(hunt.estimatedDurationMinutes)}`} colors={colors} />
        )}
        {hunt.stopCount > 0 && (
          <MetaChip icon="map-pin" label={`${hunt.stopCount} stops`} colors={colors} />
        )}
        {minParticipants && currentParticipants !== undefined && (
          <MetaChip
            icon="users"
            label={`${currentParticipants} / ${minParticipants} ready`}
            colors={colors}
          />
        )}
        {hunt.pointsReward > 0 && (
          <PointsBadge value={hunt.pointsReward} size="sm" />
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button variant="outline" size="sm" onPress={onViewHunt} style={styles.viewBtn}>
          View Hunt
        </Button>
        {canIndividuallyStart && onStartHunt && (
          <Button
            variant="primary"
            size="sm"
            onPress={onStartHunt}
            disabled={isStarting}
            loading={isStarting}
            style={styles.startBtn}
          >
            {isStarting ? 'Starting…' : 'Start Hunt'}
          </Button>
        )}
        {!canIndividuallyStart && (
          <View style={[styles.waitBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.waitText, { color: colors.mutedForeground }]}>
              {startModel === 'host_controlled' ? 'Waiting for Host' : 'Starts Automatically'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function resolveReadiness(
  startModel: HuntStartModel,
  minParticipants?: number,
  currentParticipants?: number,
  startsAt?: string | null,
): { readinessLabel: string; readinessDetail: string; canIndividuallyStart: boolean } {
  if (startModel === 'host_controlled') {
    return {
      readinessLabel: 'Waiting for Host',
      readinessDetail: 'The host will start this hunt when everyone is ready.',
      canIndividuallyStart: false,
    };
  }

  if (startModel === 'scheduled') {
    const startLabel = startsAt
      ? new Date(startsAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      : 'the scheduled time';
    return {
      readinessLabel: 'Ready',
      readinessDetail: `This hunt starts automatically at ${startLabel}.`,
      canIndividuallyStart: false,
    };
  }

  // Individual start
  const needsMoreParticipants =
    minParticipants !== undefined &&
    currentParticipants !== undefined &&
    currentParticipants < minParticipants;

  if (needsMoreParticipants) {
    return {
      readinessLabel: 'Waiting for Participants',
      readinessDetail: `${currentParticipants} of ${minParticipants} participants are ready.`,
      canIndividuallyStart: false,
    };
  }

  return {
    readinessLabel: 'Ready to Start',
    readinessDetail: 'Start whenever you arrive at the meeting point.',
    canIndividuallyStart: true,
  };
}

function MetaChip({ icon, label, colors }: { icon: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
      <Feather name={icon as any} size={11} color={colors.mutedForeground} />
      <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    gap: spacing[3],
    padding: spacing[4],
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  detail: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
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
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  viewBtn: { flex: 1 },
  startBtn: { flex: 1 },
  waitBadge: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  waitText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
});
