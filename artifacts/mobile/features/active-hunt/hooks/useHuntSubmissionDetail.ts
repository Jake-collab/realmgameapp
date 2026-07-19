/**
 * useHuntSubmissionDetail — Worlds (Prompt 13)
 *
 * Fetches the current proof submission for a hunt stop (if any).
 * Returns safe subset — no reviewer identity, no internal moderation data.
 */

import { useQuery } from '@tanstack/react-query';
import { huntKeys } from '@/features/hunts/queries/huntKeys';
import { fetchHuntStopSubmission } from '@/features/hunts/repositories/hunt.repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { HuntProofSubmissionDetail } from '../types/activeHunt.types';

interface UseHuntSubmissionDetailOptions {
  participationId: string | null;
  stopId: string | null;
  userId: string | null;
  enabled?: boolean;
}

function mapSubmissionDetail(raw: any): HuntProofSubmissionDetail {
  return {
    submissionId:         raw.submissionId,
    submissionType:       raw.submissionType,
    textResponse:         raw.textResponse ?? null,
    status:               raw.status,
    moderationStatus:     raw.moderationStatus ?? 'pending',
    reviewExplanation:    raw.reviewExplanation ?? null,
    submittedAt:          raw.submittedAt ?? null,
    reviewedAt:           raw.reviewedAt ?? null,
    previousSubmissionId: raw.previousSubmissionId ?? null,
    locationVerified:     raw.locationVerified ?? false,
    mediaItems:           raw.mediaItems ?? [],
  };
}

export function useHuntSubmissionDetail({
  participationId,
  stopId,
  userId,
  enabled = true,
}: UseHuntSubmissionDetailOptions) {
  return useQuery<HuntProofSubmissionDetail | null>({
    queryKey: huntKeys.submissions(participationId ?? '', stopId ?? '', userId ?? ''),
    queryFn: async () => {
      const raw = await fetchHuntStopSubmission(participationId!, stopId!);
      if (!raw) return null;
      return mapSubmissionDetail(raw);
    },
    enabled: enabled &&
      !!participationId && !!stopId && !!userId &&
      isSupabaseConfigured(),
    staleTime: 15_000,
    retry: 1,
  });
}
