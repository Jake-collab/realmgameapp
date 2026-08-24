/**
 * Hunt Map Screen — Worlds
 *
 * Primary Hunt landing screen. Map-first experience.
 * Shows public Hunt markers, search, filters, and bottom sheet.
 *
 * Architecture:
 * - Screen owns local UI state (camera, sheet position, selected marker, search).
 * - React Query owns server state (viewport hunts, nearby hunts).
 * - MapProvider (parent) initializes the Mapbox SDK.
 * - Private geometry NEVER passes through this screen.
 * - Only published public Hunts appear here (enforced server-side).
 *
 * Navigation:
 * - Hunt detail → /hunt-detail/[huntId]
 * - No tab changes from within this screen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';

// ── Map foundation (reuse Quest Map architecture) ───────────────────────────
import { MapProvider, useMapContext, getMapboxGL } from '@/features/maps/MapProvider';
import { useLocationPermission } from '@/features/maps/hooks/useLocationPermission';
import { MapDisconnectedState } from '@/features/maps/components/MapDisconnectedState';
import { MapPermissionBanner } from '@/features/maps/components/MapPermissionState';
import {
  DEFAULT_MAP_REGION,
  USER_LOCATION_ZOOM,
  VIEWPORT_DEBOUNCE_MS,
} from '@/features/maps/config/mapConfig';
import {
  areBBoxesMeaningfullyDifferent,
  cacheRoundLatLng,
} from '@/features/maps/utils/geoUtils';
import type { BoundingBox } from '@/features/maps/utils/geoUtils';

// ── Hunt map domain ──────────────────────────────────────────────────────────
import { useHuntMapViewport } from '@/features/hunt-map/hooks/useHuntMapViewport';
import { useNearbyHunts } from '@/features/hunt-map/hooks/useNearbyHunts';
import { useHuntMapFilters } from '@/features/hunt-map/hooks/useHuntMapFilters';
import { HuntNearbySheet } from '@/features/hunt-map/components/HuntNearbySheet';
import { HuntFilterSheet } from '@/features/hunt-map/components/HuntFilterSheet';
import { HuntMarker } from '@/components/hunt/HuntMarker';
import { HuntJoinConfirmation } from '@/components/hunt/HuntJoinConfirmation';
import { useJoinHunt } from '@/features/hunts/hooks/useJoinHunt';
import type { PublicHuntMapItem, HuntMarkerStatus, HuntBottomSheetState, HuntNearbySortOrder } from '@/features/hunt-map/types/huntMap.types';
import { SearchThisAreaButton } from '@/features/quest-map/components/SearchThisAreaButton';
import { usePlaceSearch } from '@/features/quest-map/hooks/usePlaceSearch';

// ─── Inner screen (wrapped by MapProvider) ────────────────────────────────────

function HuntMapInner() {
  const colors = useColors();
  const { user } = useAuth();
  const { isReady, isModuleUnavailable, isTokenMissing } = useMapContext();
  const permissionHook = useLocationPermission();
  const MapboxGL = getMapboxGL();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [sheetState, setSheetState] = useState<HuntBottomSheetState>('collapsed');
  const [selectedHunt, setSelectedHunt] = useState<PublicHuntMapItem | null>(null);
  const [nearbySort, setNearbySort] = useState<HuntNearbySortOrder>('nearest');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [joinTarget, setJoinTarget] = useState<PublicHuntMapItem | null>(null);

  // ── Camera / bounds state ────────────────────────────────────────────────
  const [activeBounds, setActiveBounds] = useState<BoundingBox | null>(null);
  const [pendingBounds, setPendingBounds] = useState<BoundingBox | null>(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_MAP_REGION.zoomLevel);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialCenterRef = useRef(false);
  const cameraRef = useRef<any>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const { filter, activeFilterCount, setFilter, clearFilters } = useHuntMapFilters();

  // ── Place search ──────────────────────────────────────────────────────────
  const searchHook = usePlaceSearch();

  // ── Approximate user location (rounded to 2dp) ────────────────────────────
  const roundedUser = userLat !== null && userLng !== null
    ? cacheRoundLatLng(userLat, userLng)
    : null;

  // ── Server state ──────────────────────────────────────────────────────────
  const viewportQuery = useHuntMapViewport({
    bounds: activeBounds,
    zoomLevel,
    filter,
    approximateUserLat: roundedUser?.latitude,
    approximateUserLng: roundedUser?.longitude,
    enabled: isReady && !!activeBounds,
  });

  const nearbyQuery = useNearbyHunts({
    approximateLat: roundedUser?.latitude ?? null,
    approximateLng: roundedUser?.longitude ?? null,
    filter,
    sortOrder: nearbySort,
    enabled: isReady,
  });

  // ── Join mutation ────────────────────────────────────────────────────────
  const joinMutation = useJoinHunt();

  // ── Region change handler ─────────────────────────────────────────────────
  const handleRegionDidChange = useCallback((feature: any) => {
    const newZoom = feature?.properties?.zoomLevel ?? zoomLevel;
    setZoomLevel(newZoom);

    const visibleBounds = feature?.properties?.visibleBounds;
    if (visibleBounds) {
      const newBounds: BoundingBox = {
        west:  visibleBounds[0][0],
        south: visibleBounds[1][1],
        east:  visibleBounds[1][0],
        north: visibleBounds[0][1],
      };
      setPendingBounds(newBounds);
      if (activeBounds && areBBoxesMeaningfullyDifferent(activeBounds, newBounds, 0.1)) {
        setShowSearchThisArea(true);
      }
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPendingBounds(prev => {
        if (prev) setActiveBounds(prev);
        return prev;
      });
      setShowSearchThisArea(false);
    }, VIEWPORT_DEBOUNCE_MS);
  }, [activeBounds, zoomLevel]);

  // ── Search this area ──────────────────────────────────────────────────────
  const handleSearchThisArea = useCallback(() => {
    if (pendingBounds) setActiveBounds(pendingBounds);
    setShowSearchThisArea(false);
  }, [pendingBounds]);

  // ── Marker selection ──────────────────────────────────────────────────────
  const handleMarkerPress = useCallback((hunt: PublicHuntMapItem) => {
    setSelectedHunt(hunt);
    setSheetState('medium');
  }, []);

  const handleDeselectHunt = useCallback(() => {
    setSelectedHunt(null);
    setSheetState('collapsed');
  }, []);

  // ── Place search ──────────────────────────────────────────────────────────
  const handlePlaceSelect = useCallback((suggestion: typeof searchHook.selectedPlace) => {
    if (!suggestion || !cameraRef.current || !MapboxGL) return;
    searchHook.selectSuggestion(suggestion);
    setIsSearchVisible(false);

    const bbox = suggestion.boundingBox;
    if (bbox && cameraRef.current?.fitBounds) {
      cameraRef.current.fitBounds([bbox.west, bbox.south], [bbox.east, bbox.north], 50, 1000);
    } else if (cameraRef.current?.setCamera) {
      cameraRef.current.setCamera({
        centerCoordinate: [suggestion.centerLongitude, suggestion.centerLatitude],
        zoomLevel: 13,
        animationDuration: 800,
      });
    }

    const newBounds: BoundingBox = suggestion.boundingBox ?? {
      west:  suggestion.centerLongitude - 0.05,
      south: suggestion.centerLatitude  - 0.05,
      east:  suggestion.centerLongitude + 0.05,
      north: suggestion.centerLatitude  + 0.05,
    };
    setActiveBounds(newBounds);
  }, [searchHook, MapboxGL]);

  // ── Recenter ──────────────────────────────────────────────────────────────
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

  // ── User location update ──────────────────────────────────────────────────
  const handleUserLocationUpdate = useCallback((location: any) => {
    const lat = location?.coords?.latitude;
    const lng = location?.coords?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    setUserLat(lat);
    setUserLng(lng);

    if (!didInitialCenterRef.current && cameraRef.current?.setCamera) {
      didInitialCenterRef.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: USER_LOCATION_ZOOM,
        animationDuration: 800,
      });
      setActiveBounds({ west: lng - 0.1, south: lat - 0.1, east: lng + 0.1, north: lat + 0.1 });
    }
  }, []);

  // ── Join flow ─────────────────────────────────────────────────────────────
  const handleJoinPress = useCallback((hunt: PublicHuntMapItem) => {
    if (!user) {
      // Not authenticated — route to detail which will prompt sign-in
      router.push(`/hunt-detail/${hunt.huntId}`);
      return;
    }
    setJoinTarget(hunt);
  }, [user]);

  const handleConfirmJoin = useCallback(() => {
    if (!joinTarget || !user) return;
    joinMutation.mutate(
      { huntId: joinTarget.huntId, occurrenceId: joinTarget.occurrenceId ?? null, userId: user.id },
      {
        onSuccess: (result) => {
          setJoinTarget(null);
          if (result.success && result.participationId) {
            router.push(`/hunt-ready/${result.participationId}`);
          }
        },
        onError: () => {
          setJoinTarget(null);
        },
      }
    );
  }, [joinTarget, user, joinMutation]);

  // ── Disconnected / unavailable ────────────────────────────────────────────
  if (isTokenMissing) return <MapDisconnectedState reason="token_missing" />;
  if (isModuleUnavailable) return <MapDisconnectedState reason="module_unavailable" />;
  if (viewportQuery.isError && viewportQuery.hunts.length === 0) return <MapDisconnectedState reason="error" />;

  // ── Build marker data ─────────────────────────────────────────────────────
  const markers = viewportQuery.hunts.map(h => ({
    huntId:      h.huntId,
    occurrenceId: h.occurrenceId,
    latitude:    h.displayLatitude,
    longitude:   h.displayLongitude,
    status:      resolveMarkerStatus(h),
    isSelected:  selectedHunt?.huntId === h.huntId,
    pointsReward: h.pointsReward,
    title:       h.title,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      {MapboxGL ? (
        <MapboxGL.MapView
          style={styles.map}
          logoEnabled
          attributionEnabled
          compassEnabled
          onRegionDidChange={handleRegionDidChange}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [DEFAULT_MAP_REGION.longitude, DEFAULT_MAP_REGION.latitude],
              zoomLevel: DEFAULT_MAP_REGION.zoomLevel,
            }}
          />

          {permissionHook.canUseLocation && (
            <MapboxGL.UserLocation
              visible
              onUpdate={handleUserLocationUpdate}
              showsUserHeadingIndicator
            />
          )}

          {/* Hunt markers */}
          {markers.map(m => (
            <MapboxGL.MarkerView
              key={`${m.huntId}-${m.occurrenceId ?? 'none'}`}
              coordinate={[m.longitude, m.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <HuntMarker
                title={m.title}
                status={m.status}
                pointsReward={m.pointsReward}
                isSelected={m.isSelected}
                onPress={() => {
                  const hunt = viewportQuery.hunts.find(h => h.huntId === m.huntId);
                  if (hunt) handleMarkerPress(hunt);
                }}
              />
            </MapboxGL.MarkerView>
          ))}
        </MapboxGL.MapView>
      ) : null}

      {/* ── Floating controls ─────────────────────────────────────────── */}
      <View style={styles.topControls}>
        <MapPermissionBanner
          status={permissionHook.status}
          onRequestPermission={permissionHook.requestPermission}
        />

        {isSearchVisible ? (
          <HuntSearchBar
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
                activeFilterCount > 0 && { borderColor: colors.hunt },
              ]}
              accessibilityLabel={`Hunt filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
            >
              <Feather
                name="sliders"
                size={18}
                color={activeFilterCount > 0 ? colors.hunt : colors.foreground}
              />
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: colors.hunt }]}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search this area */}
      <View style={styles.searchThisAreaWrap} pointerEvents="box-none">
        <SearchThisAreaButton
          visible={showSearchThisArea && !isSearchVisible}
          isLoading={viewportQuery.isFetching}
          onPress={handleSearchThisArea}
        />
      </View>

      {/* Recenter */}
      <TouchableOpacity
        onPress={handleRecenter}
        style={[styles.recenterButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityLabel="Center map on my location"
      >
        <Feather
          name={permissionHook.canUseLocation ? 'navigation' : 'navigation-2'}
          size={20}
          color={permissionHook.canUseLocation ? colors.hunt : colors.mutedForeground}
        />
      </TouchableOpacity>

      {/* ── Bottom sheet ─────────────────────────────────────────────── */}
      <HuntNearbySheet
        sheetState={sheetState}
        selectedHunt={selectedHunt}
        nearbyHunts={nearbyQuery.sortedHunts}
        sortOrder={nearbySort}
        isLoadingNearby={nearbyQuery.isLoading}
        activeFilterCount={activeFilterCount}
        isAuthenticated={!!user}
        onExpandSheet={() => setSheetState('expanded')}
        onCollapseSheet={() => setSheetState('collapsed')}
        onSelectHunt={h => { setSelectedHunt(h); setSheetState('medium'); }}
        onDeselectHunt={handleDeselectHunt}
        onSortChange={setNearbySort}
        onOpenFilters={() => setIsFilterSheetVisible(true)}
        onJoinHunt={handleJoinPress}
      />

      {/* ── Filter sheet ──────────────────────────────────────────────── */}
      <HuntFilterSheet
        visible={isFilterSheetVisible}
        filter={filter}
        onApply={(f) => { setFilter(f); setActiveBounds(prev => prev ? { ...prev } : null); }}
        onClose={() => setIsFilterSheetVisible(false)}
      />

      {/* ── Join confirmation ─────────────────────────────────────────── */}
      {joinTarget && (
        <HuntJoinConfirmation
          visible={!!joinTarget}
          hunt={{
            title: joinTarget.title,
            participationMode: joinTarget.participationMode,
            stopCount: joinTarget.stopCount,
            estimatedDurationMinutes: joinTarget.estimatedDurationMinutes,
            pointsReward: joinTarget.pointsReward,
            startsAt: joinTarget.startsAt,
            endsAt: joinTarget.endsAt,
            safetyNote: null,
            requiresLocation: joinTarget.requiresLocation,
            requiresProof: joinTarget.requiresProof,
          }}
          isLoading={joinMutation.isPending}
          onConfirm={handleConfirmJoin}
          onDismiss={() => setJoinTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Marker status resolver ────────────────────────────────────────────────────

function resolveMarkerStatus(hunt: PublicHuntMapItem): HuntMarkerStatus {
  if (hunt.isFeatured && !hunt.participationStatus) return 'featured';
  if (hunt.participationStatus === 'active' || hunt.participationStatus === 'paused') return 'active';
  if (hunt.participationStatus === 'accepted' || hunt.participationStatus === 'ready') return 'joined';
  if (hunt.participationStatus === 'completed') return 'completed';
  if (hunt.availabilityState === 'full' || hunt.isFull) return 'full';
  if (hunt.availabilityState === 'upcoming') return 'upcoming';
  if (hunt.availabilityState === 'completed') return 'completed';
  return 'available';
}

// ─── Search bar ───────────────────────────────────────────────────────────────

function HuntSearchBar({
  searchHook, onSelectPlace, onClose, colors,
}: {
  searchHook: ReturnType<typeof usePlaceSearch>;
  onSelectPlace: (s: ReturnType<typeof usePlaceSearch>['suggestions'][0]) => void;
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

// ─── Root screen export ───────────────────────────────────────────────────────

export default function HuntMapScreen() {
  return (
    <MapProvider>
      <HuntMapInner />
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
    bottom: 280,
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
