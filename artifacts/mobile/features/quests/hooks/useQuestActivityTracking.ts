import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useQueryClient } from '@tanstack/react-query';
import { questKeys } from '../queries/questKeys';
import { recordQuestActivitySample } from '../repositories/quest.repository';
import type { QuestParticipationRowExtended } from '../repositories/quest.repository';
import type { QuestRow } from '@/lib/supabase/database.types';

const ACTIVE_STATUSES = new Set(['started', 'in_progress']);

export function useQuestActivityTracking(input: {
  quest: Pick<QuestRow, 'verification_methods' | 'required_distance_meters' | 'activity_type'> | null | undefined;
  participation: QuestParticipationRowExtended | null | undefined;
  userId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sampleQueue = useRef(Promise.resolve());
  const active = !!input.quest
    && !!input.participation
    && !!input.userId
    && input.quest.verification_methods?.includes('activity_tracking') === true
    && ACTIVE_STATUSES.has(input.participation.status);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    if (!active || !input.participation || !input.userId) {
      setIsTracking(false);
      return () => { cancelled = true; };
    }

    const start = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermissionStatus(permission.status);
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setErrorMessage('Location permission is needed to measure this activity.');
        return;
      }

      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5_000,
            distanceInterval: 5,
          },
          (location) => {
            const capturedAt = new Date(location.timestamp).toISOString();
            const clientSampleId = [
              capturedAt,
              location.coords.latitude.toFixed(6),
              location.coords.longitude.toFixed(6),
            ].join(':');
            sampleQueue.current = sampleQueue.current
              .then(async () => {
                if (cancelled || !input.participation || !input.userId) return;
                const result = await recordQuestActivitySample({
                  participationId: input.participation.id,
                  userId: input.userId,
                  clientSampleId,
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracyMeters: location.coords.accuracy ?? 101,
                  capturedAt,
                });
                if (cancelled) return;
                queryClient.setQueryData<QuestParticipationRowExtended>(
                  questKeys.participation(input.participation.id),
                  (current) => current
                    ? { ...current, activity_distance_meters: result.total_distance_meters, activity_last_sample_at: capturedAt }
                    : current,
                );
                if (!result.accepted && result.rejection_code !== 'participation_not_active') {
                  setErrorMessage('A location sample was skipped because it did not pass the activity quality check.');
                } else if (result.accepted) {
                  setErrorMessage(null);
                }
              })
              .catch(() => {
                if (!cancelled) setErrorMessage('Activity progress could not be saved. Keep the app open and try again.');
              });
          },
        );
        if (!cancelled) setIsTracking(true);
      } catch {
        if (!cancelled) setErrorMessage('Activity tracking is unavailable on this device.');
      }
    };

    void start();
    return () => {
      cancelled = true;
      subscription?.remove();
      setIsTracking(false);
    };
  }, [active, input.participation?.id, input.participation?.status, input.userId, queryClient]);

  return {
    permissionStatus,
    isTracking,
    errorMessage,
    distanceMeters: Number(input.participation?.activity_distance_meters ?? 0),
    targetMeters: Number(input.quest?.required_distance_meters ?? 0),
  };
}