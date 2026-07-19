/**
 * MapProvider — Worlds
 *
 * Initializes Mapbox SDK with the configured access token.
 * Provides the map configuration context to all child components.
 *
 * Behavior:
 * - If EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is missing: renders DisconnectedState.
 * - If @rnmapbox/maps is unavailable (Expo Go, CI): renders DisconnectedState.
 * - In production: does NOT show developer setup instructions.
 * - Mapbox attribution remains visible inside map components (required by ToS).
 *
 * Usage:
 *   <MapProvider>
 *     <YourMapScreen />
 *   </MapProvider>
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isMapboxConfigured, MAPBOX_ACCESS_TOKEN } from './config/mapConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapContextValue {
  /** True when Mapbox SDK is initialized and ready to render */
  isReady: boolean;
  /** True when the SDK module is unavailable (Expo Go / no native build) */
  isModuleUnavailable: boolean;
  /** True when the access token is missing or invalid */
  isTokenMissing: boolean;
}

const MapContext = createContext<MapContextValue>({
  isReady: false,
  isModuleUnavailable: false,
  isTokenMissing: true,
});

export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}

// ─── Lazy SDK loader ──────────────────────────────────────────────────────────

/**
 * Lazily import @rnmapbox/maps.
 * In Expo Go (no native module), this throws — caught and handled gracefully.
 */
let MapboxGL: typeof import('@rnmapbox/maps') | null = null;
let mapboxLoadAttempted = false;

function tryLoadMapbox(): { loaded: boolean; unavailable: boolean } {
  if (mapboxLoadAttempted) {
    return { loaded: MapboxGL !== null, unavailable: MapboxGL === null };
  }
  mapboxLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    MapboxGL = require('@rnmapbox/maps');
    return { loaded: true, unavailable: false };
  } catch {
    MapboxGL = null;
    return { loaded: false, unavailable: true };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface MapProviderProps {
  children: ReactNode;
}

export function MapProvider({ children }: MapProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isModuleUnavailable, setIsModuleUnavailable] = useState(false);

  const tokenMissing = !isMapboxConfigured();

  useEffect(() => {
    if (tokenMissing) return;

    const { loaded, unavailable } = tryLoadMapbox();

    if (unavailable) {
      setIsModuleUnavailable(true);
      return;
    }

    if (loaded && MapboxGL) {
      try {
        MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);
        setIsReady(true);
      } catch {
        setIsModuleUnavailable(true);
      }
    }
  }, [tokenMissing]);

  return (
    <MapContext.Provider
      value={{
        isReady,
        isModuleUnavailable,
        isTokenMissing: tokenMissing,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}

// ─── Re-export SDK for use in map components ──────────────────────────────────

/** Access the lazily loaded Mapbox GL module — null when unavailable */
export function getMapboxGL(): typeof import('@rnmapbox/maps') | null {
  if (!mapboxLoadAttempted) tryLoadMapbox();
  return MapboxGL;
}
