/**
 * MapProvider — Web stub (Worlds)
 *
 * @rnmapbox/maps is a native-only SDK that cannot run in a web browser.
 * This platform-specific file (`.web.tsx`) is resolved by Metro instead of
 * `MapProvider.tsx` when bundling for web, preventing Mapbox — and its
 * transitive `mapbox-gl/dist/mapbox-gl.css` import — from entering the
 * web bundle at all.
 *
 * The public API surface is identical so all consumers compile without changes.
 */

import React, { createContext, useContext, type ReactNode } from 'react';

interface MapContextValue {
  isReady: boolean;
  isModuleUnavailable: boolean;
  isTokenMissing: boolean;
}

const MapContext = createContext<MapContextValue>({
  isReady: false,
  isModuleUnavailable: true,
  isTokenMissing: true,
});

export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}

interface MapProviderProps {
  children: ReactNode;
}

export function MapProvider({ children }: MapProviderProps) {
  return (
    <MapContext.Provider
      value={{ isReady: false, isModuleUnavailable: true, isTokenMissing: true }}
    >
      {children}
    </MapContext.Provider>
  );
}

/** Web stub — always returns null (no native Mapbox on web) */
export function getMapboxGL(): null {
  return null;
}
