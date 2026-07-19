/**
 * useSubmissionHistory — Proof submission history for a participation.
 * Owner-only. Returns submissions in chronological order.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchSubmissionHistory } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { SubmissionHistoryItem } from '../types/questProgress.types';

export function useSubmissionHistory(participationId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<SubmissionHistoryItem[]>({
    queryKey: progressKeys.submissionHistory(participationId ?? ''),
    queryFn: () => fetchSubmissionHistory(participationId!, userId),
    enabled: !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 60 * 1000,
    retry: 1,
  });
}
