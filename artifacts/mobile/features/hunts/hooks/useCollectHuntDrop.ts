import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForegroundLocation } from '@/features/maps/hooks/useForegroundLocation';
import { collectHuntDrop, issueHuntDropCollectionSession } from '../repositories/huntDrop.repository';
import { huntKeys } from '../queries/huntKeys';

export function useCollectHuntDrop(input: { participationId: string; userId: string; huntId: string }) {
  const location = useForegroundLocation();
  const queryClient = useQueryClient();
  // A second tap can happen before React has rendered mutation.isPending. Keep
  // this per-hook lock outside render state; SQL remains the final authority.
  const collectingStopIds = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: async (stopId: string) => {
      // Collection is intentionally online and uses two fresh foreground reads.
      // A cached reading, background task, or local queue must never collect a Drop.
      const first = await location.acquireLocation();
      if (!first) throw new Error(location.errorMessage ?? 'Unable to get your location. Try again in an open area.');
      const session = await issueHuntDropCollectionSession({
        participationId: input.participationId, stopId,
        latitude: first.latitude, longitude: first.longitude, accuracyMeters: first.horizontalAccuracyMeters,
      });
      const final = await location.acquireLocation();
      if (!final) throw new Error(location.errorMessage ?? 'Unable to verify your location. Try again.');
      return collectHuntDrop({
        sessionId: session.sessionId,
        latitude: final.latitude, longitude: final.longitude, accuracyMeters: final.horizontalAccuracyMeters,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: huntKeys.activeHunt(input.participationId, input.userId) });
      void queryClient.invalidateQueries({ queryKey: huntKeys.dropSearchZones(input.participationId, input.userId) });
      void queryClient.invalidateQueries({ queryKey: huntKeys.stopProgress(input.participationId, input.userId) });
    },
  });

  const collect = useCallback(async (stopId: string) => {
    if (collectingStopIds.current.has(stopId)) {
      throw new Error('Collection is already in progress for this Drop.');
    }
    collectingStopIds.current.add(stopId);
    try {
      return await mutation.mutateAsync(stopId);
    } finally {
      collectingStopIds.current.delete(stopId);
    }
  }, [mutation]);

  return { ...mutation, collect };
}