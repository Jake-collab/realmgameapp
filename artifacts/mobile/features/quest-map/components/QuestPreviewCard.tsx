/**
 * QuestPreviewCard — Worlds
 *
 * Bottom sheet preview card for a selected Geo-Quest marker.
 * Shown in the map bottom sheet when a marker is tapped.
 *
 * Rules:
 * - Never exposes validation geometry or private quest config.
 * - Uses resolveQuestAction from Prompt 7 for consistent button logic.
 * - Primary action is "View Quest" by default — direct start is not offered here.
 * - Distances are labeled as approximate (straight-line only).
 * - Safety note is shown before any location-required action.
 */

import React, { memo, useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { resolveQuestAction } from '@/features/quests/utils/questActionResolver';
import { getMediaFallbackMessage } from '@/services/media/media.service';
import { formatDistance } from '../../maps/utils/geoUtils';
import type { PublicGeoQuestMapItem } from '../types/questMap.types';
import type { DistanceUnit } from '../../maps/config/mapConfig';

interface QuestPreviewCardProps {
  quest: PublicGeoQuestMapItem;
  distanceUnit?: DistanceUnit;
  onClose?: () => void;
  onMediaUnavailable?: () => void;
}

function QuestPreviewCardComponent({
  quest,
  distanceUnit = 'miles',
  onClose,
  onMediaUnavailable,
}: QuestPreviewCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [quest.thumbnailUrl]);

  const action = resolveQuestAction({
    availabilityState: quest.availabilityState as any,
    participationStatus: quest.participationState as any,
    proofStatus: null,
  });

  const handlePrimaryAction = () => {
    // Always navigate to Quest Detail — never start directly from preview
    router.push({
      pathname: '/quest-detail/[questId]',
      params: {
        questId: quest.questId,
        source: 'map',
        occurrenceId: quest.occurrenceId ?? '',
      },
    });
  };

  const difficultyLabel = quest.difficulty
    ? quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)
    : null;

  const distanceLabel = quest.approximateDistanceMeters !== null
    ? formatDistance(quest.approximateDistanceMeters, distanceUnit)
    : null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        {quest.thumbnailUrl && !imageError ? (
          <Image
            source={{ uri: quest.thumbnailUrl }}
            style={[styles.thumbnail, { borderColor: colors.border }]}
            accessibilityLabel={`${quest.title} thumbnail`}
            onError={() => {
              setImageError(true);
              onMediaUnavailable?.();
            }}
          />
        ) : (
          <View
            style={[
              styles.thumbnailPlaceholder,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
            accessibilityLabel={
              imageError
                ? `${quest.title} ${getMediaFallbackMessage('thumbnail')}`
                : undefined
            }
          >
            <Feather name="map-pin" size={20} color={colors.accent} />
            {imageError && (
              <Text style={[styles.thumbnailFallback, { color: colors.mutedForeground }]}>
                {getMediaFallbackMessage('thumbnail')}
              </Text>
            )}
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {quest.title}
            {quest.isFeatured ? (
              <Text style={{ color: colors.accent }}> ★</Text>
            ) : null}
          </Text>
          {quest.publicLocationName ? (
            <Text
              style={[styles.locationName, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              {' '}{quest.publicLocationName}
            </Text>
          ) : null}
        </View>

        {onClose ? (
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Close preview"
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Short objective */}
      <Text
        style={[styles.objective, { color: colors.mutedForeground }]}
        numberOfLines={2}
      >
        {quest.shortObjective}
      </Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <MetaBadge icon="zap" value={`${quest.pointsReward} pts`} colors={colors} />
        {quest.estimatedDurationMinutes ? (
          <MetaBadge icon="clock" value={`~${quest.estimatedDurationMinutes}m`} colors={colors} />
        ) : null}
        {difficultyLabel ? (
          <MetaBadge icon="bar-chart-2" value={difficultyLabel} colors={colors} />
        ) : null}
        {distanceLabel ? (
          <MetaBadge icon="navigation" value={`≈ ${distanceLabel}`} colors={colors} isApproximate />
        ) : null}
      </View>

      {/* Location requirement note */}
      {(quest.requiresStartLocation || quest.requiresCompletionLocation) ? (
        <View style={[styles.locationNote, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="navigation" size={12} color={colors.accent} />
          <Text style={[styles.locationNoteText, { color: colors.mutedForeground }]}>
            {quest.requiresStartLocation && quest.requiresCompletionLocation
              ? 'Location required to start and complete'
              : quest.requiresStartLocation
              ? 'Location required to start'
              : 'Location required to complete'}
          </Text>
        </View>
      ) : null}

      {/* Venue hours */}
      {quest.publicVenueHoursNote ? (
        <Text style={[styles.hoursNote, { color: colors.mutedForeground }]}>
          <Feather name="clock" size={11} /> {quest.publicVenueHoursNote}
        </Text>
      ) : null}

      {/* Primary action */}
      <TouchableOpacity
        onPress={handlePrimaryAction}
        style={[
          styles.actionButton,
          { backgroundColor: colors.primary },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`View ${quest.title}`}
      >
        <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>
          View Quest
        </Text>
        <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
      </TouchableOpacity>

      {/* Safety reminder — shown before location-required action */}
      <Text style={[styles.safetyNote, { color: colors.mutedForeground }]}>
        Do not interact with this app while driving.
      </Text>
    </View>
  );
}

export const QuestPreviewCard = memo(QuestPreviewCardComponent);

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetaBadgeProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  colors: ReturnType<typeof useColors>;
  isApproximate?: boolean;
}

function MetaBadge({ icon, value, colors, isApproximate }: MetaBadgeProps) {
  return (
    <View style={[styles.metaBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Feather name={icon} size={11} color={colors.mutedForeground} />
      <Text style={[styles.metaBadgeText, { color: colors.mutedForeground }]}>
        {value}
        {isApproximate ? <Text style={{ fontSize: 9 }}> approx</Text> : null}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnailPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailFallback: {
    fontFamily: fontFamily.regular,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },
  headerInfo: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.4,
  },
  locationName: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  objective: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaBadgeText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  locationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locationNoteText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    flex: 1,
  },
  hoursNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
  actionButtonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  safetyNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
