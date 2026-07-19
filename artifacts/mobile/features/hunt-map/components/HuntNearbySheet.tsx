/**
 * HuntNearbySheet — Worlds
 *
 * Bottom sheet for the Hunt Map showing selected Hunt preview and nearby list.
 * States: collapsed / medium / expanded
 *
 * Coordinates with map markers — selecting a list item highlights the marker
 * and vice-versa. State ownership: local UI (selection, sheet position).
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import PointsBadge from '@/components/ui/PointsBadge';
import { HuntTypeBadge } from '@/components/hunt/HuntTypeBadge';
import { CapacityIndicator } from '@/components/hunt/CapacityIndicator';
import { HuntTimingSummary } from '@/components/hunt/HuntTimingSummary';
import { HuntPrimaryAction } from '@/components/hunt/HuntPrimaryAction';
import { resolveHuntAction } from '@/features/hunts/services/huntActionResolver';
import { evaluateHuntAvailability } from '@/features/hunts/services/huntAvailability.service';
import type { HuntBottomSheetState, HuntNearbySortOrder, PublicHuntMapItem } from '../types/huntMap.types';
import type { HuntAction } from '@/features/hunts/types/hunt.types';

// ─── Sheet heights ─────────────────────────────────────────────────────────────

const SHEET_HEIGHTS: Record<HuntBottomSheetState, number> = {
  collapsed: 68,
  medium:    280,
  expanded:  520,
};

const SORT_OPTIONS: { value: HuntNearbySortOrder; label: string }[] = [
  { value: 'nearest',       label: 'Nearest' },
  { value: 'starting_soon', label: 'Starting Soon' },
  { value: 'featured',      label: 'Featured' },
  { value: 'highest_points', label: 'Top Points' },
  { value: 'shortest',      label: 'Shortest' },
  { value: 'easiest',       label: 'Easiest' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface HuntNearbySheetProps {
  sheetState: HuntBottomSheetState;
  selectedHunt: PublicHuntMapItem | null;
  nearbyHunts: PublicHuntMapItem[];
  sortOrder: HuntNearbySortOrder;
  isLoadingNearby: boolean;
  activeFilterCount: number;
  isAuthenticated: boolean;
  onExpandSheet: () => void;
  onCollapseSheet: () => void;
  onSelectHunt: (hunt: PublicHuntMapItem) => void;
  onDeselectHunt: () => void;
  onSortChange: (sort: HuntNearbySortOrder) => void;
  onOpenFilters: () => void;
  onJoinHunt: (hunt: PublicHuntMapItem) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HuntNearbySheet({
  sheetState,
  selectedHunt,
  nearbyHunts,
  sortOrder,
  isLoadingNearby,
  activeFilterCount,
  isAuthenticated,
  onExpandSheet,
  onCollapseSheet,
  onSelectHunt,
  onDeselectHunt,
  onSortChange,
  onOpenFilters,
  onJoinHunt,
}: HuntNearbySheetProps) {
  const colors = useColors();
  const height = SHEET_HEIGHTS[sheetState];

  const handleHuntPress = useCallback((hunt: PublicHuntMapItem) => {
    router.push(`/hunt-detail/${hunt.huntId}`);
  }, []);

  return (
    <View
      style={[
        styles.sheet,
        {
          height,
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Drag handle + collapse/expand */}
      <TouchableOpacity
        onPress={sheetState === 'expanded' ? onCollapseSheet : onExpandSheet}
        style={styles.handleArea}
        accessibilityLabel={sheetState === 'expanded' ? 'Collapse hunt list' : 'Expand hunt list'}
        accessibilityRole="button"
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.handleLabel, { color: colors.mutedForeground }]}>
          {selectedHunt
            ? selectedHunt.title
            : nearbyHunts.length > 0
              ? `${nearbyHunts.length} Hunt${nearbyHunts.length !== 1 ? 's' : ''} nearby`
              : 'Explore Hunts'}
        </Text>
        <Feather
          name={sheetState === 'expanded' ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* ── Medium / Expanded content ──────────────────────────────────────── */}
      {sheetState !== 'collapsed' && (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Selected hunt preview */}
          {selectedHunt && (
            <HuntPreviewCard
              hunt={selectedHunt}
              isAuthenticated={isAuthenticated}
              onView={() => handleHuntPress(selectedHunt)}
              onJoin={() => onJoinHunt(selectedHunt)}
              onDeselect={onDeselectHunt}
              colors={colors}
            />
          )}

          {/* Sort + filter controls (expanded only) */}
          {sheetState === 'expanded' && (
            <View style={styles.controls}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortRow}
              >
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onSortChange(opt.value)}
                    style={[
                      styles.sortChip,
                      {
                        backgroundColor: sortOrder === opt.value ? colors.hunt : colors.secondary,
                        borderColor: sortOrder === opt.value ? colors.hunt : colors.border,
                      },
                    ]}
                    accessibilityLabel={`Sort by ${opt.label}`}
                    accessibilityState={{ selected: sortOrder === opt.value }}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        { color: sortOrder === opt.value ? '#fff' : colors.foreground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={onOpenFilters}
                style={[styles.filterBtn, { borderColor: colors.border }]}
                accessibilityLabel={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
              >
                <Feather name="sliders" size={14} color={activeFilterCount > 0 ? colors.hunt : colors.mutedForeground} />
                {activeFilterCount > 0 && (
                  <Text style={[styles.filterCount, { color: colors.hunt }]}>{activeFilterCount}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Nearby list */}
          {isLoadingNearby ? (
            <ActivityIndicator color={colors.hunt} style={styles.loader} />
          ) : nearbyHunts.length === 0 ? (
            <EmptyNearbyState colors={colors} />
          ) : (
            nearbyHunts.map(hunt => (
              <NearbyHuntRow
                key={`${hunt.huntId}-${hunt.occurrenceId ?? 'none'}`}
                hunt={hunt}
                isSelected={selectedHunt?.huntId === hunt.huntId}
                onPress={() => onSelectHunt(hunt)}
                onView={() => handleHuntPress(hunt)}
                colors={colors}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Hunt Preview Card (selected hunt) ───────────────────────────────────────

function HuntPreviewCard({
  hunt,
  isAuthenticated,
  onView,
  onJoin,
  onDeselect,
  colors,
}: {
  hunt: PublicHuntMapItem;
  isAuthenticated: boolean;
  onView: () => void;
  onJoin: () => void;
  onDeselect: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const availResult = evaluateHuntAvailability({
    huntId: hunt.huntId,
    occurrenceId: hunt.occurrenceId,
    huntStatus: 'active', // only active hunts appear on map
    huntPrivacy: hunt.privacy,
    huntJoinPolicy: 'open',
    maxParticipants: hunt.maxParticipants,
    currentParticipantCount: hunt.currentParticipantCount,
    isAuthenticated,
    participationStatus: hunt.participationStatus ?? undefined,
    participationId: hunt.participationId ?? undefined,
    invitationId: hunt.invitationId ?? undefined,
    invitationStatus: hunt.invitationStatus ?? undefined,
  });

  const action = resolveHuntAction({
    state: availResult.state,
    canJoin: availResult.canJoin,
    canStart: availResult.canStart ?? false,
    reasonCode: availResult.reasonCode as any,
    participationId: hunt.participationId,
    invitationId: hunt.invitationId,
  });

  // Override join actions to go through the detail screen (full confirmation)
  const handleAction = () => {
    if (action.actionType === 'join_hunt' || action.actionType === 'view_hunt') {
      onView();
    } else if (action.actionType === 'accept_invitation') {
      onView();
    } else if (action.actionType === 'continue_hunt' || action.actionType === 'start_hunt') {
      onView();
    } else {
      onView();
    }
  };

  return (
    <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
      {/* Dismiss */}
      <TouchableOpacity
        onPress={onDeselect}
        style={styles.dismissBtn}
        accessibilityLabel="Dismiss hunt preview"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Type badge */}
      <HuntTypeBadge huntType={hunt.huntType} privacy={hunt.privacy} />

      {/* Title */}
      <Text style={[styles.previewTitle, { color: colors.foreground }]} numberOfLines={2}>
        {hunt.title}
      </Text>

      {/* Summary */}
      <Text style={[styles.previewSummary, { color: colors.mutedForeground }]} numberOfLines={2}>
        {hunt.summary}
      </Text>

      {/* Meta chips */}
      <View style={styles.metaRow}>
        {hunt.estimatedDurationMinutes && (
          <MetaChip icon="clock" label={`~${formatDuration(hunt.estimatedDurationMinutes)}`} colors={colors} />
        )}
        {hunt.stopCount > 0 && (
          <MetaChip icon="map-pin" label={`${hunt.stopCount} stops`} colors={colors} />
        )}
        <CapacityIndicator
          current={hunt.currentParticipantCount}
          max={hunt.maxParticipants}
          isFull={hunt.isFull}
          size="sm"
        />
      </View>

      {/* Points + action */}
      <View style={styles.previewFooter}>
        <PointsBadge value={hunt.pointsReward} size="md" />
        <HuntPrimaryAction
          action={action}
          onPress={handleAction}
          size="sm"
          fullWidth={false}
        />
        <TouchableOpacity
          onPress={onView}
          style={[styles.viewBtn, { borderColor: colors.border }]}
          accessibilityLabel="View hunt details"
        >
          <Text style={[styles.viewBtnText, { color: colors.foreground }]}>Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Nearby Hunt Row ──────────────────────────────────────────────────────────

function NearbyHuntRow({
  hunt,
  isSelected,
  onPress,
  onView,
  colors,
}: {
  hunt: PublicHuntMapItem;
  isSelected: boolean;
  onPress: () => void;
  onView: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onView}
      style={[
        styles.nearbyRow,
        { borderColor: isSelected ? colors.hunt : colors.border },
        isSelected && { backgroundColor: colors.hunt + '08' },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${hunt.title}, ${hunt.pointsReward} points${hunt.isFull ? ', Full' : ''}`}
    >
      <View style={styles.nearbyMain}>
        <Text style={[styles.nearbyTitle, { color: colors.foreground }]} numberOfLines={1}>
          {hunt.title}
        </Text>
        <View style={styles.nearbyMeta}>
          {hunt.estimatedDurationMinutes && (
            <Text style={[styles.nearbyMetaText, { color: colors.mutedForeground }]}>
              ~{formatDuration(hunt.estimatedDurationMinutes)}
            </Text>
          )}
          {hunt.approximateDistanceMeters !== null && (
            <Text style={[styles.nearbyMetaText, { color: colors.mutedForeground }]}>
              · ~{formatDistance(hunt.approximateDistanceMeters)}
            </Text>
          )}
          {hunt.isFull && (
            <Text style={[styles.nearbyMetaText, { color: colors.destructive }]}> · Full</Text>
          )}
        </View>
      </View>
      <PointsBadge value={hunt.pointsReward} size="sm" />
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyNearbyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.empty}>
      <Feather name="map" size={32} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Hunts in this area</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        Try searching another area or clearing your filters.
      </Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return `${Math.floor(min / 60)}h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  handleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    position: 'absolute',
    top: spacing[2],
    left: '50%',
    marginLeft: -18,
  },
  handleLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    flex: 1,
    marginTop: 2,
    textAlign: 'center',
  },
  scrollArea: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingTop: 0, gap: spacing[3] },

  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  dismissBtn: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    zIndex: 1,
  },
  previewTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    paddingRight: 32,
  },
  previewSummary: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    alignItems: 'center',
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  viewBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  viewBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  sortRow: { gap: spacing[2], paddingRight: spacing[2] },
  sortChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  sortChipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  filterCount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
  },

  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  nearbyMain: { flex: 1, gap: 2 },
  nearbyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
  nearbyMeta: { flexDirection: 'row', flexWrap: 'wrap' },
  nearbyMetaText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
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

  loader: { marginTop: spacing[6] },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[3],
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
