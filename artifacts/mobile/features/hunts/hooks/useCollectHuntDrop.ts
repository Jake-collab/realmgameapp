import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForegroundLocation } from '@/features/maps/hooks/useForegroundLocation';
import { collectHuntDrop, issueHuntDropCollectionSession } from '../repositories/huntDrop.repository';
import { huntKeys } from '../queries/huntKeys';

export function useCollectHuntDrop(input: { participationId: string; userId: string; huntId: string }) {
  const location = useForegroundLocation();
  const queryClient = useQueryClient();

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

  return { ...mutation, collect: useCallback((stopId: string) => mutation.mutateAsync(stopId), [mutation]) };
}