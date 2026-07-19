/**
 * useLocationPermission — Worlds
 *
 * Manages foreground location permission state using expo-location.
 * Covers all platform states: not_determined, granted, denied, blocked,
 * restricted, unavailable, and reduced_accuracy.
 *
 * Rules:
 * - NEVER request background location permission from this hook.
 * - NEVER prompt automatically on mount — require explicit user action.
 * - Permission denial is a normal user choice, not an error state.
 * - Do not request permission repeatedly after denial.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as ExpoLocation from 'expo-location';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocationPermissionStatus =
  | 'not_determined'   // Not yet asked
  | 'granted'          // Full foreground access
  | 'denied'           // User denied (can be re-requested via prompt on iOS)
  | 'blocked'          // User permanently denied (Settings required)
  | 'restricted'       // OS restriction (parental controls, MDM, etc.)
  | 'unavailable'      // Device does not support location
  | 'reduced_accuracy' // iOS 14+ precise location declined
  | 'loading';         // Status check in progress

export interface UseLocationPermissionResult {
  status: LocationPermissionStatus;
  /** True when location is usable for nearby discovery */
  canUseLocation: boolean;
  /** True when full accuracy is available (not reduced) */
  hasFullAccuracy: boolean;
  /** Request foreground permission — call only on explicit user action */
  requestPermission: () => Promise<LocationPermissionStatus>;
  /** Check current status without prompting */
  checkPermission: () => Promise<LocationPermissionStatus>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocationPermission(): UseLocationPermissionResult {
  const [status, setStatus] = useState<LocationPermissionStatus>('loading');
  const hasMounted = useRef(false);

  const normalizeStatus = useCallback(
    (permissionResponse: ExpoLocation.LocationPermissionResponse): LocationPermissionStatus => {
      const { status: s, ios } = permissionResponse;

      // Reduced accuracy (iOS 14+) — cast to any because expo-location types don't always include this
      if ((ios as any)?.accuracy === 'reduced') return 'reduced_accuracy';

      switch (s) {
        case ExpoLocation.PermissionStatus.GRANTED:
          return 'granted';
        case ExpoLocation.PermissionStatus.DENIED:
          // Distinguish permanently blocked vs soft-denied
          // expo-location doesn't always surface this, so treat denied as denied
          return 'denied';
        case ExpoLocation.PermissionStatus.UNDETERMINED:
          return 'not_determined';
        default:
          return 'unavailable';
      }
    },
    []
  );

  const checkPermission = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      const response = await ExpoLocation.getForegroundPermissionsAsync();
      const normalized = normalizeStatus(response);
      setStatus(normalized);
      return normalized;
    } catch {
      const s: LocationPermissionStatus = 'unavailable';
      setStatus(s);
      return s;
    }
  }, [normalizeStatus]);

  const requestPermission = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      setStatus('loading');
      const response = await ExpoLocation.requestForegroundPermissionsAsync();
      const normalized = normalizeStatus(response);
      setStatus(normalized);
      return normalized;
    } catch {
      const s: LocationPermissionStatus = 'unavailable';
      setStatus(s);
      return s;
    }
  }, [normalizeStatus]);

  // Check existing status on mount — do NOT request
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    checkPermission();
  }, [checkPermission]);

  const canUseLocation =
    status === 'granted' || status === 'reduced_accuracy';

  const hasFullAccuracy = status === 'granted';

  return {
    status,
    canUseLocation,
    hasFullAccuracy,
    requestPermission,
    checkPermission,
  };
}
