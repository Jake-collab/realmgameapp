/**
 * useValidateHuntStopLocation — Worlds (Prompt 13)
 *
 * Orchestrates the location-validation flow for a hunt stop:
 *  1. Checks foreground location permission
 *  2. Acquires a fresh GPS reading (via useForegroundLocation)
 *  3. Submits to the trusted server RPC
 *  4. Returns a safe result — no geofence geometry ever returned
 *
 * This hook is called only on explicit user action (Check Location tap).
 * Not used for continuous tracking or background monitoring.
 */

import { useState, useCallback } from 'react';
import { useForegroundLocation } from '@/features/maps/hooks/useForegroundLocation';
import { useLocationPermission } from '@/features/maps/hooks/useLocationPermission';
import { rpcValidateHuntStopLocation } from '@/features/hunts/repositories/hunt.repository';
import type { LocationValidationResult, LocationValidationOutcome } from '../types/activeHunt.types';

const MAX_LOCATION_AGE_SECONDS = 120; // Reject readings older than 2 minutes

interface UseValidateHuntStopLocationOptions {
  participationId: string;
  stopId: string;
}

export function useValidateHuntStopLocation({
  participationId,
  stopId,
}: UseValidateHuntStopLocationOptions) {
  const [validationResult, setValidationResult] = useState<LocationValidationResult>({
    outcome: 'not_started',
    validated: false,
    reasonCode: null,
    userMessage: '',
  });

  const locationHook = useForegroundLocation();
  const { status: permissionStatus } = useLocationPermission();

  const validate = useCallback(async (): Promise<LocationValidationResult> => {
    // ── Permission check ─────────────────────────────────────────────────────
    if (permissionStatus === 'denied' || permissionStatus === 'blocked') {
      const result: LocationValidationResult = {
        outcome:     'permission_denied',
        validated:   false,
        reasonCode:  'PERMISSION_DENIED',
        userMessage: 'Location permission is required. Please enable it in Settings.',
      };
      setValidationResult(result);
      return result;
    }

    // ── Acquire fresh GPS reading ────────────────────────────────────────────
    setValidationResult({
      outcome:    'acquiring',
      validated:  false,
      reasonCode: null,
      userMessage: 'Acquiring your location…',
    });

    const reading = await locationHook.acquireLocation();

    if (!reading) {
      let outcome: LocationValidationOutcome = 'timeout';
      let userMessage = 'Could not get your location. Move to an open area and try again.';

      if (locationHook.state === 'permission_denied') {
        outcome = 'permission_denied';
        userMessage = 'Location permission is required. Please enable it in Settings.';
      } else if (locationHook.state === 'timeout') {
        outcome = 'timeout';
        userMessage = 'Location request timed out. Move to an open area and try again.';
      }

      const result: LocationValidationResult = {
        outcome,
        validated:   false,
        reasonCode:  outcome.toUpperCase(),
        userMessage,
      };
      setValidationResult(result);
      return result;
    }

    // ── Staleness check ──────────────────────────────────────────────────────
    const ageSeconds = (Date.now() - reading.capturedAt.getTime()) / 1000;
    if (ageSeconds > MAX_LOCATION_AGE_SECONDS) {
      const result: LocationValidationResult = {
        outcome:    'timeout',
        validated:  false,
        reasonCode: 'STALE_LOCATION',
        userMessage: 'Location reading is outdated. Please try again.',
      };
      setValidationResult(result);
      return result;
    }

    // ── Submit to server ─────────────────────────────────────────────────────
    try {
      const serverResult = await rpcValidateHuntStopLocation(
        participationId,
        stopId,
        reading.latitude,
        reading.longitude,
        reading.horizontalAccuracyMeters,
      );

      let outcome: LocationValidationOutcome;
      switch (serverResult.reasonCode) {
        case 'OUTSIDE_REQUIRED_AREA': outcome = 'outside_area';      break;
        case 'POOR_ACCURACY':         outcome = 'poor_accuracy';      break;
        case 'INVALID_PARTICIPATION': outcome = 'hunt_expired';       break;
        case 'STOP_UNAVAILABLE':      outcome = 'stop_unavailable';   break;
        case null:                    outcome = serverResult.validated ? 'validated' : 'server_error'; break;
        default:                      outcome = 'server_error';
      }

      const result: LocationValidationResult = {
        outcome,
        validated:   serverResult.validated,
        reasonCode:  serverResult.reasonCode,
        userMessage: serverResult.userMessage ||
          (serverResult.validated ? 'Location verified.' : 'You are not in the required area yet.'),
      };
      setValidationResult(result);
      return result;
    } catch (_err) {
      const result: LocationValidationResult = {
        outcome:    'server_error',
        validated:  false,
        reasonCode: 'SERVER_ERROR',
        userMessage: 'Location validation temporarily unavailable. Please try again.',
      };
      setValidationResult(result);
      return result;
    }
  }, [participationId, stopId, locationHook, permissionStatus]);

  const reset = useCallback(() => {
    setValidationResult({
      outcome:    'not_started',
      validated:  false,
      reasonCode: null,
      userMessage: '',
    });
    locationHook.clearLocation();
  }, [locationHook]);

  return {
    validationResult,
    isAcquiring: locationHook.state === 'acquiring' ||
                 validationResult.outcome === 'acquiring',
    validate,
    reset,
  };
}
