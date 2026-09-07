/**
 * Persisted map camera — Worlds
 *
 * Stores only a coarse, last-used viewport. Foreground GPS readings and
 * validation coordinates are never persisted.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { LOCATION_STORAGE_POLICY } from '../utils/coordinatePrivacy';
import { cacheRoundLatLng, isValidLatLng } from '../utils/geoUtils';

export type PersistedMapScope = 'quest' | 'hunt';

export interface PersistedMapCamera {
  latitude: number;
  longitude: number;
  zoomLevel: number;
}

interface UsePersistedMapCameraResult {
  camera: PersistedMapCamera;
  isRestored: boolean;
  persistCamera: (camera: PersistedMapCamera) => Promise<void>;
}

function normalizeCamera(camera: PersistedMapCamera): PersistedMapCamera | null {
  if (!isValidLatLng(camera.latitude, camera.longitude)) return null;
  if (!Number.isFinite(camera.zoomLevel)) return null;

  const rounded = cacheRoundLatLng(camera.latitude, camera.longitude);
  return {
    latitude: rounded.latitude,
    longitude: rounded.longitude,
    zoomLevel: Math.max(
      0,
      Math.min(LOCATION_STORAGE_POLICY.maxStoredZoom, camera.zoomLevel),
    ),
  };
}

export function usePersistedMapCamera(
  scope: PersistedMapScope,
  fallback: PersistedMapCamera,
): UsePersistedMapCameraResult {
  const storageKey = `${LOCATION_STORAGE_POLICY.mapCameraStateKey}:${scope}`;
  const [camera, setCamera] = useState<PersistedMapCamera>(fallback);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (!isMounted || !stored) return;
        try {
          const restored = normalizeCamera(JSON.parse(stored) as PersistedMapCamera);
          if (restored) setCamera(restored);
        } catch {
          // Ignore corrupt camera state and use the safe fallback.
        }
      })
      .catch(() => {
        // Camera persistence is an enhancement; map rendering must continue.
      })
      .finally(() => {
        if (isMounted) setIsRestored(true);
      });

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  const persistCamera = useCallback(async (nextCamera: PersistedMapCamera) => {
    const normalized = normalizeCamera(nextCamera);
    if (!normalized) return;
    setCamera(normalized);
    await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));
  }, [storageKey]);

  return { camera, isRestored, persistCamera };
}