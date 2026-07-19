/**
 * useGeoValidation — Worlds
 *
 * Manages the trusted server-side location validation flow.
 *
 * Rules:
 * - Validation coordinates go ONLY to the trusted backend endpoint.
 * - Do NOT auto-retry failed validations — each attempt is user-initiated.
 * - Rate limiting is enforced server-side; client enforces a minimum delay.
 * - Do not expose private geometry, validation radius, or hidden thresholds.
 * - Validation result does NOT award points — points are server-side only.
 * - Location readings used for validation are never persisted to storage.
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { submitGeoValidation } from '../repositories/questMap.repository';
import { useForegroundLocation } from '../../maps/hooks/useForegroundLocation';
import type {
  GeoValidationRequest,
  GeoValidationResponse,
  GeoFixtureScenario,
} from '../types/questMap.types';
import type { ForegroundLocationReading } from '../../maps/hooks/useForegroundLocation';
import {
  isLocationFresh,
  classifyAccuracy,
  accuracyUserMessage,
} from '../../maps/utils/geoUtils';
import { DEV_VALIDATION_RESPONSES } from '../fixtures/geoQuestFixtures';
import {
  MAX_LOCATION_AGE_SECONDS,
  DEFAULT_MAX_ACCURACY_METERS,
  VALIDATION_RETRY_DELAY_MS,
} from '../../maps/config/mapConfig';
import { questMapKeys } from '../queries/questMapKeys';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationPhase =
  | 'idle'
  | 'acquiring_location'
  | 'checking_accuracy'
  | 'submitting'
  | 'success'
  | 'failed'
  | 'rate_limited';

export interface UseGeoValidationOptions {
  participationId: string;
  questStepId?: string | null;
  validationType: 'start' | 'step' | 'completion';
  /** Quest-specific required accuracy (meters) — falls back to DEFAULT */
  requiredAccuracyMeters?: number;
  /** Quest-specific max location age (seconds) — falls back to DEFAULT */
  maxLocationAgeSeconds?: number;
  onSuccess?: (response: GeoValidationResponse) => void;
  onFailed?: (response: GeoValidationResponse) => void;
}

export interface UseGeoValidationResult {
  phase: ValidationPhase;
  lastResponse: GeoValidationResponse | null;
  locationState: ReturnType<typeof useForegroundLocation>['state'];
  locationReading: ForegroundLocationReading | null;
  locationErrorMessage: string | null;
  /** User-facing message based on current phase and response */
  userMessage: string | null;
  /** True when the user may attempt another validation */
  canRetry: boolean;
  retryAfterSeconds: number | null;
  /** Initiate a new validation attempt — acquires location then submits */
  validate: () => Promise<void>;
  /** Cancel and return to idle */
  cancel: () => void;
  /** Development only: simulate a specific scenario without hitting the server */
  __devSimulate?: (scenario: GeoFixtureScenario) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGeoValidation({
  participationId,
  questStepId,
  validationType,
  requiredAccuracyMeters = DEFAULT_MAX_ACCURACY_METERS,
  maxLocationAgeSeconds = MAX_LOCATION_AGE_SECONDS,
  onSuccess,
  onFailed,
}: UseGeoValidationOptions): UseGeoValidationResult {
  const [phase, setPhase] = useState<ValidationPhase>('idle');
  const [lastResponse, setLastResponse] = useState<GeoValidationResponse | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const lastAttemptAt = useRef<number>(0);
  const queryClient = useQueryClient();

  const locationHook = useForegroundLocation();

  const mutation = useMutation({
    mutationFn: (request: GeoValidationRequest) => submitGeoValidation(request),
    retry: 0, // Never auto-retry validation
  });

  const validate = useCallback(async () => {
    // Enforce client-side minimum retry delay
    const now = Date.now();
    const elapsed = now - lastAttemptAt.current;
    if (elapsed < VALIDATION_RETRY_DELAY_MS && lastAttemptAt.current !== 0) {
      const remaining = Math.ceil((VALIDATION_RETRY_DELAY_MS - elapsed) / 1000);
      setUserMessage(`Please wait ${remaining}s before trying again.`);
      return;
    }

    setPhase('acquiring_location');
    setUserMessage('Acquiring your location…');
    setLastResponse(null);
    lastAttemptAt.current = now;

    // Step 1: Acquire fresh location
    const reading = await locationHook.acquireLocation();

    if (!reading) {
      setPhase('failed');
      setUserMessage(locationHook.errorMessage ?? 'Unable to get your location. Please try again.');
      return;
    }

    // Step 2: Check freshness
    if (!isLocationFresh(reading.capturedAt, maxLocationAgeSeconds)) {
      setPhase('failed');
      setUserMessage('Your location reading is outdated. Please try again.');
      return;
    }

    // Step 3: Check accuracy (client pre-check — server is authoritative)
    setPhase('checking_accuracy');
    const accuracyCategory = classifyAccuracy(reading.horizontalAccuracyMeters);
    const accuracyMessage = accuracyUserMessage(accuracyCategory);
    if (reading.horizontalAccuracyMeters > requiredAccuracyMeters * 2) {
      // Only block if accuracy is severely insufficient
      setPhase('failed');
      setUserMessage(accuracyMessage ?? 'Your location signal is not accurate enough.');
      return;
    }

    // Step 4: Submit to trusted backend
    setPhase('submitting');
    setUserMessage('Verifying your location…');

    const requestId = `${participationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const request: GeoValidationRequest = {
        participationId,
        questStepId: questStepId ?? undefined,
        latitude:                  reading.latitude,
        longitude:                 reading.longitude,
        horizontalAccuracyMeters:  reading.horizontalAccuracyMeters,
        capturedAt:                reading.capturedAt.toISOString(),
        requestId,
        validationType,
      };

      const response = await mutation.mutateAsync(request);
      setLastResponse(response);

      if (response.result === 'validated' || response.result === 'not_required') {
        setPhase('success');
        setUserMessage(response.userMessage ?? 'Location verified.');
        // Invalidate map and participation queries
        queryClient.invalidateQueries({ queryKey: questMapKeys.all });
        onSuccess?.(response);
      } else if (response.result === 'rate_limited') {
        setPhase('rate_limited');
        setRetryAfterSeconds(response.retryAfterSeconds ?? 30);
        setUserMessage(response.userMessage ?? 'Too many attempts. Please wait.');
        onFailed?.(response);
      } else {
        setPhase('failed');
        setUserMessage(response.userMessage ?? 'Location check failed. Please try again.');
        onFailed?.(response);
      }
    } catch {
      setPhase('failed');
      setUserMessage('Location validation is temporarily unavailable. Please try again.');
    }
  }, [
    participationId, questStepId, validationType,
    requiredAccuracyMeters, maxLocationAgeSeconds,
    locationHook, mutation, queryClient, onSuccess, onFailed,
  ]);

  const cancel = useCallback(() => {
    setPhase('idle');
    setLastResponse(null);
    setUserMessage(null);
    locationHook.clearLocation();
  }, [locationHook]);

  const canRetry =
    phase === 'idle' ||
    phase === 'failed' ||
    (phase === 'rate_limited' && (retryAfterSeconds ?? 0) <= 0);

  // Development-only simulation
  const __devSimulate = __DEV__
    ? (scenario: GeoFixtureScenario) => {
        const response = DEV_VALIDATION_RESPONSES[scenario];
        if (!response) return;
        setLastResponse(response);
        if (response.result === 'validated') {
          setPhase('success');
        } else if (response.result === 'rate_limited') {
          setPhase('rate_limited');
          setRetryAfterSeconds(response.retryAfterSeconds ?? 30);
        } else {
          setPhase('failed');
        }
        setUserMessage(response.userMessage ?? null);
      }
    : undefined;

  return {
    phase,
    lastResponse,
    locationState: locationHook.state,
    locationReading: locationHook.reading,
    locationErrorMessage: locationHook.errorMessage,
    userMessage,
    canRetry,
    retryAfterSeconds,
    validate,
    cancel,
    __devSimulate,
  };
}
