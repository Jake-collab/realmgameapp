/**
 * NearbyResultsSheet — Worlds
 *
 * Bottom sheet for the Quest Map showing selected Quest preview,
 * nearby Quest results, and sort/filter controls.
 *
 * States:
 *   collapsed — drag handle + count summary
 *   medium    — selected quest preview or top few nearby results
 *   expanded  — full scrollable list with sort control
 *
 * Rules:
 * - Does not permanently cover the map.
 * - Distances are labeled as approximate (straight-line).
 * - No private geometry or hidden validation data exposed.
 * - Sort/filter state preserved while the user browses.
 */

import React, { memo, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { QuestPreviewCard } from './QuestPreviewCard';
import type {
  PublicGeoQuestMapItem,
  NearbySortOrder,
  BottomSheetState,
} from '../types/questMap.types';
import { NEARBY_SORT_LABELS } from '../types/questMap.types';
import type { DistanceUnit } from '../../maps/config/mapConfig';
import { formatDistance } from '../../maps/utils/geoUtils';

interface NearbyResultsSheetProps {
  sheetState: BottomSheetState;
  selectedQuest: PublicGeoQuestMapItem | null;
  nearbyQuests: PublicGeoQuestMapItem[];
  sortOrder: NearbySortOrder;
  distanceUnit: DistanceUnit;
  isLoadingNearby: boolean;
  activeFilterCount: number;
  onExpandSheet: () => void;
  onCollapseSheet: () => void;
  onSelectQuest: (quest: PublicGeoQuestMapItem) => void;
  onDeselectQuest: () => void;
  onSortChange: (sort: NearbySortOrder) => void;
  onOpenFilters: () => void;
}

function NearbyResultsSheetComponent({
  sheetState,
  selectedQuest,
  nearbyQuests,
  sortOrder,
  distanceUnit,
  isLoadingNearby,
  activeFilterCount,
  onExpandSheet,
  onCollapseSheet,
  onSelectQuest,
  onDeselectQuest,
  onSortChange,
  onOpenFilters,
}: NearbyResultsSheetProps) {
  const colors = useColors();

  const renderNearbyRow = useCallback(
    ({ item }: { item: PublicGeoQuestMapItem }) => (
      <NearbyQuestRow
        quest={item}
        distanceUnit={distanceUnit}
        onPress={() => onSelectQuest(item)}
        colors={colors}
      />
    ),
    [distanceUnit, onSelectQuest, colors]
  );

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: colors.card, borderColor: colors.border },
        sheetState === 'collapsed' && styles.sheetCollapsed,
        sheetState === 'medium'    && styles.sheetMedium,
        sheetState === 'expanded'  && styles.sheetExpanded,
      ]}
    >
      {/* Drag handle */}
      <TouchableOpacity
        onPress={sheetState === 'collapsed' ? onExpandSheet : onCollapseSheet}
        style={styles.handleArea}
        accessibilityRole="button"
        accessibilityLabel={sheetState === 'collapsed' ? 'Expand nearby quests' : 'Collapse nearby quests'}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </TouchableOpacity>

      {/* Collapsed: summary only */}
      {sheetState === 'collapsed' && (
        <View style={styles.summary}>
          <Feather name="map-pin" size={14} color={colors.mutedForeground} />
          <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
            {nearbyQuests.length > 0
              ? `${nearbyQuests.length} Geo-Quests nearby`
              : selectedQuest
              ? selectedQuest.title
              : 'Browse Geo-Quests'}
          </Text>
          <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
        </View>
      )}

      {/* Medium / Expanded */}
      {(sheetState === 'medium' || sheetState === 'expanded') && (
        <View style={styles.content}>
          {/* Selected Quest preview */}
          {selectedQuest && (
            <QuestPreviewCard
              quest={selectedQuest}
              distanceUnit={distanceUnit}
              onClose={onDeselectQuest}
            />
          )}

          {/* Nearby list header */}
          {(!selectedQuest || sheetState === 'expanded') && nearbyQuests.length > 0 && (
            <>
              <View style={styles.listHeader}>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>
                  Nearby
                </Text>
                <View style={styles.listControls}>
                  {/* Sort picker */}
                  <TouchableOpacity
                    onPress={() => {
                      const sorts = Object.keys(NEARBY_SORT_LABELS) as NearbySortOrder[];
                      const current = sorts.indexOf(sortOrder);
                      onSortChange(sorts[(current + 1) % sorts.length]);
                    }}
                    style={[styles.controlChip, { borderColor: colors.border }]}
                    accessibilityLabel={`Sort: ${NEARBY_SORT_LABELS[sortOrder]}`}
                  >
                    <Feather name="sliders" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.controlChipText, { color: colors.mutedForeground }]}>
                      {NEARBY_SORT_LABELS[sortOrder]}
                    </Text>
                  </TouchableOpacity>
                  {/* Filter */}
                  <TouchableOpacity
                    onPress={onOpenFilters}
                    style={[
                      styles.controlChip,
                      { borderColor: colors.border },
                      activeFilterCount > 0 && { borderColor: colors.accent },
                    ]}
                    accessibilityLabel={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
                  >
                    <Feather name="filter" size={12} color={activeFilterCount > 0 ? colors.accent : colors.mutedForeground} />
                    {activeFilterCount > 0 && (
                      <Text style={[styles.controlChipText, { color: colors.accent }]}>
                        {activeFilterCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {sheetState === 'expanded' ? (
                <FlatList
                  data={nearbyQuests}
                  renderItem={renderNearbyRow}
                  keyExtractor={item => `${item.questId}-${item.occurrenceId ?? 'none'}`}
                  ItemSeparatorComponent={() => (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={sheetState === 'expanded'}
                  style={styles.list}
                />
              ) : (
                // Medium: show just top 3
                nearbyQuests.slice(0, 3).map(quest => (
                  <NearbyQuestRow
                    key={`${quest.questId}-${quest.occurrenceId}`}
                    quest={quest}
                    distanceUnit={distanceUnit}
                    onPress={() => onSelectQuest(quest)}
                    colors={colors}
                  />
                ))
              )}

              {sheetState === 'medium' && nearbyQuests.length > 3 && (
                <TouchableOpacity onPress={onExpandSheet} style={styles.seeAllRow}>
                  <Text style={[styles.seeAllText, { color: colors.primary }]}>
                    See all {nearbyQuests.length} nearby Quests
                  </Text>
                  <Feather name="chevron-down" size={14} color={colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Empty state */}
          {nearbyQuests.length === 0 && !isLoadingNearby && !selectedQuest && (
            <View style={styles.emptyState}>
              <Feather name="map" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No Geo-Quests in this area yet.{'\n'}Move the map or search another area.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export const NearbyResultsSheet = memo(NearbyResultsSheetComponent);

// ─── Nearby Quest Row ─────────────────────────────────────────────────────────

interface NearbyQuestRowProps {
  quest: PublicGeoQuestMapItem;
  distanceUnit: DistanceUnit;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function NearbyQuestRow({ quest, distanceUnit, onPress, colors }: NearbyQuestRowProps) {
  const distanceLabel = quest.approximateDistanceMeters !== null
    ? `≈ ${formatDistance(quest.approximateDistanceMeters, distanceUnit)}`
    : null;

  const statusColor = (() => {
    switch (quest.availabilityState) {
      case 'active': return colors.accent;
      case 'completed': return colors.mutedForeground;
      case 'upcoming': return '#888';
      default: return colors.primary;
    }
  })();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${quest.title}. ${distanceLabel ?? ''}. ${quest.pointsReward} points.`}
    >
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
          {quest.title}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {[
            quest.publicLocationName,
            distanceLabel ? `${distanceLabel} approx` : null,
            `${quest.pointsReward} pts`,
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sheetCollapsed: { paddingBottom: 8 },
  sheetMedium:   { maxHeight: '45%' },
  sheetExpanded: { maxHeight: '80%' },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  summaryText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[3],
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  listControls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  controlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  controlChipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  list: { flex: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  rowMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
  },
  seeAllText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.6,
  },
});
