import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { formatDistance } from '@/features/maps/utils/geoUtils';
import type {
  ActiveHunt,
  ActiveHuntStop,
  HuntStopPublicLocation,
} from '@/features/hunts/types/hunt.types';
import {
  buildHuntMapProgress,
  getObjectiveDirection,
} from '../utils/huntMapGameplay';

export function HuntMapHud({
  activeHunt,
  selectedStop,
  selectedLocation,
  playerLocation,
  onOpenHunt,
  onToggleTrail,
  showTrail,
  isLoading,
  isError,
}: {
  activeHunt: ActiveHunt | null | undefined;
  selectedStop: ActiveHuntStop | null;
  selectedLocation: HuntStopPublicLocation | null;
  playerLocation: { latitude: number; longitude: number } | null;
  onOpenHunt: () => void;
  onToggleTrail: () => void;
  showTrail: boolean;
  isLoading: boolean;
  isError: boolean;
}) {
  const colors = useColors();
  if (!activeHunt && !isLoading) return null;

  if (!activeHunt) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="refresh-cw" size={16} color={colors.hunt} />
        <Text style={[styles.syncText, { color: colors.mutedForeground }]}>
          Syncing Hunt progress…
        </Text>
      </View>
    );
  }

  const progress = buildHuntMapProgress(activeHunt);
  const direction = getObjectiveDirection(playerLocation, selectedLocation);
  const points = activeHunt.rewardSnapshot?.pointsReward;
  const deadline = activeHunt.completionDeadline
    ? new Date(activeHunt.completionDeadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const activeZone = activeHunt.zones?.find(zone => zone.status === 'active' || zone.status === 'available');
  const advanced = Boolean(
    activeHunt.advancedConfig?.fogOfWarEnabled
    || activeHunt.zones?.length
    || activeHunt.discoveredStopCount !== undefined,
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityLabel={`${activeHunt.huntTitle}, ${progress.completed} of ${progress.required} required objectives complete`}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.hunt + '18' }]}>
          <Feather name="flag" size={16} color={colors.hunt} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {activeHunt.huntTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {activeHunt.participationStatus === 'paused'
              ? 'Paused'
              : activeHunt.participationStatus === 'completed'
                ? 'Completed on another screen'
                : 'In action'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onOpenHunt}
          style={[styles.iconButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Open active Hunt"
        >
          <Feather name="arrow-up-right" size={15} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressHeading}>
        <Text style={[styles.progressTitle, { color: colors.foreground }]}>
          {progress.required > 0 ? `${progress.completed} / ${progress.required} found` : 'Progress syncing'}
        </Text>
        <Text style={[styles.remaining, { color: colors.mutedForeground }]}>
          {progress.required > 0 ? `${progress.remaining} remaining` : 'No measurable total'}
        </Text>
      </View>
      {progress.percent !== null && (
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${progress.percent}%`, backgroundColor: colors.hunt }]} />
        </View>
      )}

      <View style={styles.metaRow}>
        {points !== undefined && (
          <Meta icon="award" value={`${points.toLocaleString()} pts`} colors={colors} />
        )}
        {deadline && <Meta icon="clock" value={`Until ${deadline}`} colors={colors} />}
        {advanced && activeHunt.discoveredStopCount !== undefined && (
          <Meta icon="eye" value={`${activeHunt.discoveredStopCount} discovered`} colors={colors} />
        )}
        <TouchableOpacity
          onPress={onToggleTrail}
          style={[styles.trailToggle, { borderColor: showTrail ? colors.hunt : colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={showTrail ? 'Hide activity trail' : 'Show activity trail'}
        >
          <Feather name="activity" size={13} color={showTrail ? colors.hunt : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {advanced && activeZone && (
        <View style={[styles.zoneRow, { borderTopColor: colors.border }]}>
          <Feather name="map" size={14} color={colors.hunt} />
          <Text style={[styles.zoneText, { color: colors.foreground }]} numberOfLines={1}>
            {activeZone.name}
          </Text>
          <Text style={[styles.zoneProgress, { color: colors.mutedForeground }]}>
            {activeZone.required > 0 && activeZone.percent !== null
              ? `${activeZone.completed}/${activeZone.required}`
              : 'Area active'}
          </Text>
        </View>
      )}

      {selectedStop && (
        <View style={[styles.objective, { borderTopColor: colors.border }]}>
          <Feather name="map-pin" size={14} color={colors.hunt} />
          <View style={styles.objectiveCopy}>
            <Text style={[styles.objectiveLabel, { color: colors.mutedForeground }]}>Selected objective</Text>
            <Text style={[styles.objectiveTitle, { color: colors.foreground }]} numberOfLines={1}>
              {selectedStop.title}
            </Text>
          </View>
          {direction && (
            <View style={styles.direction}>
              <Text style={[styles.distance, { color: colors.foreground }]}>
                {formatDistance(direction.distanceMeters, 'kilometers')}
              </Text>
              <Text style={[styles.bearing, { color: colors.hunt }]}>
                {direction.direction} {Math.round(direction.bearing)}°
              </Text>
            </View>
          )}
        </View>
      )}
      {isError && (
        <Text style={[styles.notice, { color: colors.warning }]}>
          Hunt state is temporarily unavailable. The server remains authoritative.
        </Text>
      )}
    </View>
  );
}

function Meta({ icon, value, colors }: { icon: keyof typeof Feather.glyphMap; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={13} color={colors.mutedForeground} />
      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 78,
    left: spacing[4],
    maxWidth: '88%',
    minWidth: 270,
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 8,
    gap: spacing[2],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  icon: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: 1 },
  iconButton: { width: 28, height: 28, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  remaining: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fontFamily.regular, fontSize: 10 },
  trailToggle: { marginLeft: 'auto', width: 26, height: 26, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  objective: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  zoneRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  zoneText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  zoneProgress: { fontFamily: fontFamily.regular, fontSize: 10 },
  objectiveCopy: { flex: 1, minWidth: 0 },
  objectiveLabel: { fontFamily: fontFamily.regular, fontSize: 10 },
  objectiveTitle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, marginTop: 1 },
  direction: { alignItems: 'flex-end' },
  distance: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
  bearing: { fontFamily: fontFamily.medium, fontSize: 10, marginTop: 1 },
  syncText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  notice: { fontFamily: fontFamily.regular, fontSize: 10, lineHeight: 15 },
});