/**
 * useForegroundLocation — Worlds
 *
 * Acquires a single foreground location reading for trusted geo-validation.
 * NOT for continuous tracking or map centering — it is validation-only.
 *
 * Rules:
 * - Only used when the user explicitly initiates a validation action.
 * - Returns a single snapshot — not a subscription.
 * - The reading is kept in-memory and NEVER persisted to storage.
 * - Staleness is checked before submission using locationAgeSeconds().
 * - Do not use this hook for ordinary map centering (use device heading instead).
 */

import { useState, useCallback } from 'react';
import * as ExpoLocation from 'expo-location';
import { locationAgeSeconds } from '../utils/geoUtils';
import type { LatLng } from '../utils/geoUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForegroundLocationReading {
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters: number;
  capturedAt: Date;
}

export type LocationAcquisitionState =
  | 'idle'
  | 'acquiring'
  | 'acquired'
  | 'error'
  | 'permission_denied'
  | 'timeout';

export interface UseForegroundLocationResult {
  state: LocationAcquisitionState;
  reading: ForegroundLocationReading | null;
  errorMessage: string | null;
  /** Age of the current reading in seconds, or null if no reading */
  readingAgeSeconds: number | null;
  /** Acquire a fresh reading — call only on user action */
  acquireLocation: () => Promise<ForegroundLocationReading | null>;
  /** Clear the current reading */
  clearLocation: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACQUISITION_TIMEOUT_MS = 30_000;
const MIN_ACCURACY_METERS_TO_ACCEPT = 150; // Accept anything ≤ 150m; server validates threshold

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useForegroundLocation(): UseForegroundLocationResult {
  const [state, setState] = useState<LocationAcquisitionState>('idle');
  const [reading, setReading] = useState<ForegroundLocationReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const acquireLocation = useCallback(async (): Promise<ForegroundLocationReading | null> => {
    setState('acquiring');
    setErrorMessage(null);

    try {
      // Check permission before requesting
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== ExpoLocation.PermissionStatus.GRANTED) {
        setState('permission_denied');
        setErrorMessage('Location permission is required to validate your position.');
        return null;
      }

      // Race against a timeout
      const locationPromise = ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ACQUISITION_TIMEOUT_MS)
      );

      const location = await Promise.race([locationPromise, timeoutPromise]);
      if (!location) {
        setState('timeout');
        setErrorMessage('Location request timed out. Please try again.');
        return null;
      }

      const { latitude, longitude, accuracy } = location.coords;
      const newReading: ForegroundLocationReading = {
        latitude,
        longitude,
        horizontalAccuracyMeters: accuracy ?? 999,
        capturedAt: new Date(location.timestamp),
      };

      setReading(newReading);
      setState('acquired');
      return newReading;
    } catch (err) {
      if (err instanceof Error && err.message === 'timeout') {
        setState('timeout');
        setErrorMessage('Could not get your location in time. Move to an open area and try again.');
      } else {
        setState('error');
        setErrorMessage('Unable to get your location. Please check your device settings.');
      }
      return null;
    }
  }, []);

  const clearLocation = useCallback(() => {
    setReading(null);
    setState('idle');
    setErrorMessage(null);
  }, []);

  const readingAgeSeconds = reading
    ? locationAgeSeconds(reading.capturedAt)
    : null;

  return {
    state,
    reading,
    errorMessage,
    readingAgeSeconds,
    acquireLocation,
    clearLocation,
  };
}
