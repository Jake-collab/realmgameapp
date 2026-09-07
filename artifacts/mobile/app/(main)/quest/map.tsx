/**
 * Quest Map Screen — Worlds
 *
 * Full Geo-Quest map experience. Supports:
 * - Mapbox map with Quest markers and clusters
 * - Search this area + debounced viewport queries
 * - Bottom sheet: collapsed / medium / expanded
 * - Permission-aware location controls
 * - Map filters and sort
 * - Place search
 * - Safe Mapbox-disconnected fallback (dev + production)
 *
 * Architecture:
 * - Screen owns local UI state (camera, sheet state, selected marker, search).
 * - React Query owns server state (viewport quests, nearby quests).
 * - MapProvider (parent layout or here) initializes the Mapbox SDK.
 * - Private validation geometry NEVER passes through this screen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';

// Map foundation
import { MapProvider, useMapContext, getMapboxGL } from '@/features/maps/MapProvider';
import { useLocationPermission } from '@/features/maps/hooks/useLocationPermission';
import { MapDisconnectedState } from '@/features/maps/components/MapDisconnectedState';
import { MapPermissionBanner } from '@/features/maps/components/MapPermissionState';
import {
  DEFAULT_MAP_REGION,
  USER_LOCATION_ZOOM,
  VIEWPORT_DEBOUNCE_MS,
  DEFAULT_DISTANCE_UNIT,
  MAP_STYLES,
} from '@/features/maps/config/mapConfig';
import {
  areBBoxesMeaningfullyDifferent,
  bboxFromCenterRadius,
  cacheRoundLatLng,
} from '@/features/maps/utils/geoUtils';
import type { BoundingBox, LatLng } from '@/features/maps/utils/geoUtils';
import { parseMapRegionEvent } from '@/features/maps/utils/mapboxEvents';
import { usePersistedMapCamera } from '@/features/maps/hooks/usePersistedMapCamera';
import { useQuestDetail } from '@/features/quests/hooks/useQuestDetail';
import { useActiveQuest } from '@/features/quests/hooks/useActiveQuest';
import { questKeys } from '@/features/quests/queries/questKeys';

// Quest map domain
import { useGeoQuestViewport } from '@/features/quest-map/hooks/useGeoQuestViewport';
import { useNearbyGeoQuests } from '@/features/quest-map/hooks/useNearbyGeoQuests';
import { useMapFilters } from '@/features/quest-map/hooks/useMapFilters';
import { usePlaceSearch } from '@/features/quest-map/hooks/usePlaceSearch';
import { SearchThisAreaButton } from '@/features/quest-map/components/SearchThisAreaButton';
import { NearbyResultsSheet } from '@/features/quest-map/components/NearbyResultsSheet';
import { MapFilterSheet } from '@/features/quest-map/components/MapFilterSheet';
import { QuestMapHud } from '@/features/quest-map/components/QuestMapHud';
import { questMapKeys } from '@/features/quest-map/queries/questMapKeys';
import type {
  PublicGeoQuestMapItem,
  BottomSheetState,
  NearbySortOrder,
  QuestMarkerData,
} from '@/features/quest-map/types/questMap.types';
import {
  getQuestMapSelectionZoom,
  matchesQuestMapStatus,
  normalizePublicRadiusMeters,
} from '@/features/quest-map/types/questMap.types';
import { getFocusedActiveParticipation } from '@/features/quest-map/utils/questMapHud';

// ─── Inner screen (wrapped by MapProvider) ────────────────────────────────────

function QuestMapInner() {
  const colors = useColors();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isReady, isModuleUnavailable, isTokenMissing } = useMapContext();
  const permissionHook = useLocationPermission();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [sheetState, setSheetState] = useState<BottomSheetState>('collapsed');
  const [selectedQuest, setSelectedQuest] = useState<PublicGeoQuestMapItem | null>(null);
  const [nearbySort, setNearbySort] = useState<NearbySortOrder>('nearest');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);

  const handleMediaUnavailable = useCallback(() => {
    // Remove the stale URL from the selected item immediately, then refresh
    // viewport/nearby data so the next render reflects moderation state.
    setSelectedQuest(current =>
      current ? { ...current, thumbnailUrl: null } : current,
    );
    void queryClient.invalidateQueries({ queryKey: questMapKeys.all });
  }, [queryClient]);

  // ── Camera / bounds state ───────────────────────────────────────────────────
  const [activeBounds, setActiveBounds] = useState<BoundingBox | null>(null);
  const [pendingBounds, setPendingBounds] = useState<BoundingBox | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_MAP_REGION.zoomLevel);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userAccuracyMeters, setUserAccuracyMeters] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialCenterRef = useRef(false);
  const cameraRef = useRef<any>(null);
  const colorScheme = useColorScheme();
  const { camera: persistedCamera, isRestored, persistCamera } = usePersistedMapCamera(
    'quest',
    DEFAULT_MAP_REGION,
  );

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: questMapKeys.all });
      void queryClient.invalidateQueries({ queryKey: questKeys.active(user?.id ?? '') });
    }, [queryClient, user?.id]),
  );

  // A public viewport is useful even when the player declines location. Nearby
  // sorting remains off until the optional foreground permission is granted.
  useEffect(() => {
    const center = isRestored ? persistedCamera : DEFAULT_MAP_REGION;
    setActiveBounds({
      west: center.longitude - 0.1,
      south: center.latitude - 0.1,
      east: center.longitude + 0.1,
      north: center.latitude + 0.1,
    });
  }, [isRestored]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isRestored || !cameraRef.current) return;
    cameraRef.current.setCamera?.({
      centerCoordinate: [persistedCamera.longitude, persistedCamera.latitude],
      zoomLevel: persistedCamera.zoomLevel,
      animationDuration: 0,
    });
  }, [isRestored]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const { filter, activeFilterCount, setFilter, clearFilters } = useMapFilters();

  // ── Place search ────────────────────────────────────────────────────────────
  const searchHook = usePlaceSearch();

  // ── Approximate user location for cache keys (rounded to 2dp) ──────────────
  const roundedUser = userLat !== null && userLng !== null
    ? cacheRoundLatLng(userLat, userLng)
    : null;

  // ── Server state ────────────────────────────────────────────────────────────
  const viewportQuery = useGeoQuestViewport({
    bounds: activeBounds,
    zoomLevel,
    filter,
    approximateUserLat: roundedUser?.latitude,
    approximateUserLng: roundedUser?.longitude,
    enabled: isReady && !!activeBounds,
  });

  const nearbyQuery = useNearbyGeoQuests({
    approximateLat: roundedUser?.latitude ?? null,
    approximateLng: roundedUser?.longitude ?? null,
    filter,
    sortOrder: nearbySort,
    enabled: isReady && roundedUser !== null,
  });

  // The selected Quest detail contains only the public display radius. It is
  // never the private validation geometry and is loaded only for the focused
  // card.
  const selectedDetailQuery = useQuestDetail(selectedQuest?.questId);
  const activeQuestQuery = useActiveQuest();
  const selectedParticipation = getFocusedActiveParticipation(
    selectedQuest?.questId,
    activeQuestQuery.data ?? [],
  );
  const selectedPublicRadius = normalizePublicRadiusMeters(
    selectedDetailQuery.data?.quest_locations?.[0]?.public_radius_meters,
  );

  // ── Mapbox module ───────────────────────────────────────────────────────────
  const MapboxGL = getMapboxGL();

  // ── Handle map region change (debounced) ────────────────────────────────────
  const handleRegionWillChange = useCallback(() => {
    // Map is moving — show "search this area" once movement ends if bounds changed
  }, []);

  const handleRegionDidChange = useCallback((feature: unknown) => {
    const parsed = parseMapRegionEvent(feature);
    if (parsed.zoomLevel !== null) setZoomLevel(parsed.zoomLevel);
    if (parsed.centerLatitude !== null && parsed.centerLongitude !== null && parsed.zoomLevel !== null) {
      void persistCamera({
        latitude: parsed.centerLatitude,
        longitude: parsed.centerLongitude,
        zoomLevel: parsed.zoomLevel,
      });
    }

    if (parsed.bounds) {
      const newBounds: BoundingBox = parsed.bounds;
      setPendingBounds(newBounds);

      // Show "search this area" if bounds moved meaningfully
      if (activeBounds && areBBoxesMeaningfullyDifferent(activeBounds, newBounds, 0.1)) {
        setShowSearchThisArea(true);
      }
    }

    // Debounced auto-query (fires if no explicit "Search this area" tap)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPendingBounds(prev => {
        if (prev) setActiveBounds(prev);
        return prev;
      });
      setShowSearchThisArea(false);
    }, VIEWPORT_DEBOUNCE_MS);
  }, [activeBounds, persistCamera]);

  // ── Search this area ─────────────────────────────────────────────────────────
  const handleSearchThisArea = useCallback(() => {
    if (pendingBounds) setActiveBounds(pendingBounds);
    setShowSearchThisArea(false);
  }, [pendingBounds]);

  // ── Marker selection ─────────────────────────────────────────────────────────
  const handleMarkerPress = useCallback((quest: PublicGeoQuestMapItem) => {
    setSelectedQuest(quest);
    setSheetState('medium');
    cameraRef.current?.setCamera?.({
      centerCoordinate: [quest.displayLongitude, quest.displayLatitude],
      zoomLevel: getQuestMapSelectionZoom(zoomLevel),
      animationDuration: 650,
    });
  }, [zoomLevel]);

  const handleDeselectQuest = useCallback(() => {
    setSelectedQuest(null);
    setSheetState('collapsed');
  }, []);

  // ── Place search selection ────────────────────────────────────────────────────
  const handlePlaceSelect = useCallback((suggestion: typeof searchHook.selectedPlace) => {
    if (!suggestion || !cameraRef.current || !MapboxGL) return;
    searchHook.selectSuggestion(suggestion);
    setIsSearchVisible(false);

    // Move camera to selected place
    const bbox = suggestion.boundingBox;
    if (bbox && cameraRef.current?.fitBounds) {
      cameraRef.current.fitBounds(
        [bbox.west, bbox.south],
        [bbox.east, bbox.north],
        50,
        1000,
      );
    } else if (cameraRef.current?.setCamera) {
      cameraRef.current.setCamera({
        centerCoordinate: [suggestion.centerLongitude, suggestion.centerLatitude],
        zoomLevel: 13,
        animationDuration: 800,
      });
    }

    // Trigger query for the new area
    const newBounds: BoundingBox = suggestion.boundingBox ?? {
      west:  suggestion.centerLongitude - 0.05,
      south: suggestion.centerLatitude  - 0.05,
      east:  suggestion.centerLongitude + 0.05,
      north: suggestion.centerLatitude  + 0.05,
    };
    setActiveBounds(newBounds);
  }, [searchHook, MapboxGL]);

  // ── Recenter on user location ─────────────────────────────────────────────────
  const handleRecenter = useCallback(async () => {
    if (!permissionHook.canUseLocation) {
      await permissionHook.requestPermission();
      return;
    }
    if (!cameraRef.current || !MapboxGL) return;
    if (userLat !== null && userLng !== null) {
      cameraRef.current.setCamera?.({
        centerCoordinate: [userLng, userLat],
        zoomLevel: USER_LOCATION_ZOOM,
        animationDuration: 600,
      });
    }
  }, [permissionHook, userLat, userLng, MapboxGL]);

  // ── User location update (not persisted) ──────────────────────────────────────
  const handleUserLocationUpdate = useCallback((location: any) => {
    const lat = location?.coords?.latitude;
    const lng = location?.coords?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    setUserLat(lat);
    setUserLng(lng);
    setUserAccuracyMeters(
      typeof location?.coords?.accuracy === 'number' && Number.isFinite(location.coords.accuracy)
        ? location.coords.accuracy
        : null,
    );

    // Auto-center once on first location fix
    if (!didInitialCenterRef.current && cameraRef.current?.setCamera) {
      didInitialCenterRef.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: USER_LOCATION_ZOOM,
        animationDuration: 800,
      });
      // Initial bounds estimate
      setActiveBounds({
        west:  lng - 0.1,
        south: lat - 0.1,
        east:  lng + 0.1,
        north: lat + 0.1,
      });
    }
  }, []);

  // ── Disconnected / unavailable state ─────────────────────────────────────────
  if (isTokenMissing) {
    return <MapDisconnectedState reason="token_missing" />;
  }
  if (isModuleUnavailable) {
    return <MapDisconnectedState reason="module_unavailable" />;
  }
  if (viewportQuery.isError && viewportQuery.quests.length === 0) {
    return (
      <MapDisconnectedState
        reason="error"
        mapLabel="Geo-Quests"
        onRetry={() => void viewportQuery.refetch()}
      />
    );
  }

  // ── Map is configured: render full experience ─────────────────────────────────
  // Build marker data from viewport quests
  const filteredViewportQuests = viewportQuery.quests.filter(q => matchesQuestMapStatus(q, filter.status));
  const filteredNearbyQuests = nearbyQuery.sortedQuests.filter(q => matchesQuestMapStatus(q, filter.status));
  const markerQuests: QuestMarkerData[] = filteredViewportQuests.map(q => ({
    questId:      q.questId,
    occurrenceId: q.occurrenceId,
    latitude:     q.displayLatitude,
    longitude:    q.displayLongitude,
    status:       q.availabilityState === 'active'
      ? 'active'
      : q.availabilityState === 'completed'
      ? 'completed'
      : q.availabilityState === 'awaiting_proof'
      ? 'awaiting_proof'
      : q.availabilityState === 'under_review'
      ? 'under_review'
      : q.availabilityState === 'upcoming'
      ? 'upcoming'
      : q.availabilityState === 'unavailable'
      ? 'unavailable'
      : 'available',
    isSelected:   selectedQuest?.questId === q.questId,
    pointsReward: q.pointsReward,
    title:        q.title,
    isFeatured:   q.isFeatured,
  }));
  const sheetQuests = roundedUser ? filteredNearbyQuests : filteredViewportQuests;
  const selectedCircle = selectedQuest && selectedPublicRadius && selectedPublicRadius > 0
    ? buildApproximateCircle(
        selectedQuest.displayLatitude,
        selectedQuest.displayLongitude,
        selectedPublicRadius,
      )
    : null;
  const currentUserLocation: LatLng | null =
    userLat !== null && userLng !== null
      ? { latitude: userLat, longitude: userLng }
      : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      {MapboxGL ? (
        <MapboxGL.MapView
          style={styles.map}
          styleURL={colorScheme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light}
          logoEnabled
          attributionEnabled
          compassEnabled
          onRegionWillChange={handleRegionWillChange}
          onRegionDidChange={handleRegionDidChange}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [
                 persistedCamera.longitude,
                 persistedCamera.latitude,
              ],
               zoomLevel: persistedCamera.zoomLevel,
            }}
          />

          {/* User location indicator */}
          {permissionHook.canUseLocation && (
            <MapboxGL.UserLocation
              visible
              onUpdate={handleUserLocationUpdate}
              showsUserHeadingIndicator
            />
          )}

          {/* Quest markers */}
          {markerQuests.map(marker => (
            <MapboxGL.MarkerView
              key={`${marker.questId}-${marker.occurrenceId ?? 'none'}`}
              coordinate={[marker.longitude, marker.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <QuestMarkerPin
                marker={marker}
                onPress={() => {
                   const quest = filteredViewportQuests.find(q => q.questId === marker.questId);
                  if (quest) handleMarkerPress(quest);
                }}
                colors={colors}
              />
            </MapboxGL.MarkerView>
          ))}
          {selectedCircle ? (
            <MapboxGL.ShapeSource id="selected-quest-target-area" shape={selectedCircle}>
              <MapboxGL.FillLayer
                id="selected-quest-target-area-fill"
                style={{
                  fillColor: colors.accent,
                  fillOpacity: 0.12,
                  fillOutlineColor: colors.accent,
                }}
              />
            </MapboxGL.ShapeSource>
          ) : null}
        </MapboxGL.MapView>
      ) : null}

      {/* ── Floating controls ─────────────────────────────────────────────── */}

      {/* Permission banner */}
      <View style={styles.topControls}>
        <MapPermissionBanner
          status={permissionHook.status}
          onRequestPermission={permissionHook.requestPermission}
        />

        {/* Search bar */}
        {isSearchVisible ? (
          <SearchBar
            searchHook={searchHook}
            onSelectPlace={handlePlaceSelect}
            onClose={() => { setIsSearchVisible(false); searchHook.clearSearch(); }}
            colors={colors}
          />
        ) : (
          <View style={styles.iconRow}>
            <TouchableOpacity
              onPress={() => setIsSearchVisible(true)}
              style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityLabel="Search for a place"
            >
              <Feather name="search" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsFilterSheetVisible(true)}
              style={[
                styles.iconButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                activeFilterCount > 0 && { borderColor: colors.accent },
              ]}
              accessibilityLabel={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
            >
              <Feather name="sliders" size={18} color={activeFilterCount > 0 ? colors.accent : colors.foreground} />
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <QuestMapHud
        selectedQuest={selectedQuest}
        selectedQuestDetail={selectedDetailQuery.data}
        selectedParticipation={selectedParticipation}
        activeCount={activeQuestQuery.data?.length ?? null}
        nearbyCount={sheetQuests.length}
        nearbyCountIsApproximate={!roundedUser}
        isLoadingActive={activeQuestQuery.isLoading}
      />

      {/* Search this area button — centered */}
      <View style={styles.searchThisAreaWrap} pointerEvents="box-none">
        <SearchThisAreaButton
          visible={showSearchThisArea && !isSearchVisible}
          isLoading={viewportQuery.isFetching}
          onPress={handleSearchThisArea}
        />
      </View>

      {/* Recenter button */}
      <TouchableOpacity
        onPress={handleRecenter}
        style={[
          styles.recenterButton,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessibilityLabel="Center map on my location"
      >
        <Feather
          name={permissionHook.canUseLocation ? 'navigation' : 'navigation-2'}
          size={20}
          color={permissionHook.canUseLocation ? colors.accent : colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <NearbyResultsSheet
        sheetState={sheetState}
        selectedQuest={selectedQuest}
        nearbyQuests={sheetQuests}
        sortOrder={nearbySort}
        distanceUnit={DEFAULT_DISTANCE_UNIT}
        isLoadingNearby={nearbyQuery.isLoading}
        isErrorNearby={nearbyQuery.isError}
        onRetryNearby={() => void nearbyQuery.refetch()}
        activeFilterCount={activeFilterCount}
        onExpandSheet={() => setSheetState('expanded')}
        onCollapseSheet={() => setSheetState('collapsed')}
        onSelectQuest={handleMarkerPress}
        onDeselectQuest={handleDeselectQuest}
        onSortChange={setNearbySort}
        onOpenFilters={() => setIsFilterSheetVisible(true)}
        onMediaUnavailable={handleMediaUnavailable}
        userLocation={currentUserLocation}
        hasLocationPermission={permissionHook.canUseLocation}
        onRequestLocationPermission={permissionHook.requestPermission}
        publicRadiusMeters={selectedPublicRadius}
      />

      {/* ── Filter sheet ──────────────────────────────────────────────────── */}
      <MapFilterSheet
        visible={isFilterSheetVisible}
        filter={filter}
        onApply={(f) => { setFilter(f); setActiveBounds(prev => prev ? { ...prev } : null); }}
        onClose={() => setIsFilterSheetVisible(false)}
      />
    </View>
  );
}

// ─── Quest Marker Pin ─────────────────────────────────────────────────────────

interface QuestMarkerPinProps {
  marker: QuestMarkerData;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function QuestMarkerPin({ marker, onPress, colors }: QuestMarkerPinProps) {
  const statusStyle = getMarkerStyle(marker.status, marker.isSelected, colors);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${marker.title} — ${marker.status} — ${marker.pointsReward} points`}
    >
      <View
        style={[
          styles.marker,
          { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
          marker.isSelected && styles.markerSelected,
        ]}
      >
        <Feather
          name={
            marker.status === 'completed'
              ? 'check'
              : marker.status === 'active'
              ? 'navigation'
              : marker.status === 'awaiting_proof'
              ? 'camera'
              : marker.status === 'under_review'
              ? 'clock'
              : marker.status === 'locked'
              ? 'lock'
              : marker.isFeatured
              ? 'star'
              : 'map-pin'
          }
          size={marker.isSelected ? 16 : 12}
          color={statusStyle.icon}
        />
      </View>
    </TouchableOpacity>
  );
}

function getMarkerStyle(
  status: QuestMarkerData['status'],
  isSelected: boolean,
  colors: ReturnType<typeof useColors>,
) {
  // Do not communicate state through color alone — icons also differ
  switch (status) {
    case 'active':
      return { bg: colors.accent, border: colors.accent, icon: '#fff' };
    case 'completed':
      return { bg: colors.secondary, border: colors.border, icon: colors.mutedForeground };
    case 'awaiting_proof':
    case 'under_review':
      return { bg: colors.secondary, border: colors.accent, icon: colors.accent };
    case 'upcoming':
      return { bg: colors.secondary, border: colors.border, icon: colors.mutedForeground };
    case 'unavailable':
    case 'locked':
      return { bg: colors.secondary, border: colors.border, icon: colors.mutedForeground };
    default: // available
      return { bg: colors.primary, border: colors.primary, icon: colors.primaryForeground };
  }
}

function buildApproximateCircle(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const safeRadius = Math.min(Math.max(radiusMeters, 1), 5_000);
  const bounds = bboxFromCenterRadius({ latitude, longitude }, safeRadius);
  const latitudeDelta = (bounds.north - bounds.south) / 2;
  const longitudeDelta = (bounds.east - bounds.west) / 2;
  const coordinates = Array.from({ length: 33 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return [
      longitude + Math.cos(angle) * longitudeDelta,
      latitude + Math.sin(angle) * latitudeDelta,
    ];
  });

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  };
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({
  searchHook,
  onSelectPlace,
  onClose,
  colors,
}: {
  searchHook: ReturnType<typeof usePlaceSearch>;
  onSelectPlace: (suggestion: ReturnType<typeof usePlaceSearch>['suggestions'][0]) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.searchContainer}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search for a place…"
          placeholderTextColor={colors.mutedForeground}
          value={searchHook.query}
          onChangeText={searchHook.setQuery}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Search for a place"
        />
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close search">
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      {searchHook.suggestions.length > 0 && (
        <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {searchHook.suggestions.map(s => (
            <TouchableOpacity
              key={s.placeId}
              onPress={() => onSelectPlace(s)}
              style={[styles.suggestionRow, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={s.placeName}
            >
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={1}>
                {s.placeName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Root screen export (wraps with MapProvider) ──────────────────────────────

export default function QuestMapScreen() {
  return (
    <MapProvider>
      <QuestMapInner />
    </MapProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 8 : 16,
    left: spacing[4],
    right: spacing[4],
    gap: spacing[2],
    zIndex: 10,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fontFamily.bold,
  },

  searchThisAreaWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 78,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9,
  },

  recenterButton: {
    position: 'absolute',
    right: spacing[4],
    bottom: 260,
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },

  marker: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  markerSelected: {
    width: 40,
    height: 40,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },

  searchContainer: { gap: spacing[2] },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    paddingVertical: 2,
  },
  suggestions: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
