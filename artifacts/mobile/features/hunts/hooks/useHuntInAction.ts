/**
 * useHuntInAction — In Action Hunt participations for the Progress screen.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchHuntInAction } from '../repositories/huntProgress.repository';
import { huntProgressKeys } from '../queries/huntProgressKeys';
import type {
  HuntInActionItem,
  HuntInActionSummary,
} from '../types/huntProgress.types';

export interface UseHuntInActionResult {
  items: HuntInActionItem[];
  summary: HuntInActionSummary;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useHuntInAction(): UseHuntInActionResult {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const query = useQuery<HuntInActionItem[]>({
    queryKey: huntProgressKeys.inAction(userId),
    queryFn:  () => fetchHuntInAction(userId),
    enabled:  !!userId && isSupabaseConfigured(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  const items = query.data ?? [];

  const summary: HuntInActionSummary = {
    activeHunts: items.filter(i => i.status === 'active').length,
    stopsUnderReview: items.filter(i => i.pendingStop?.stopStatus === 'under_review').length,
    stopsNeedingResubmission: items.filter(i => i.pendingStop?.stopStatus === 'needs_resubmission').length,
    stopsAwaitingProof: items.filter(i => i.pendingStop?.stopStatus === 'awaiting_proof').length,
    hasApproachingDeadline: items.some(i => {
      if (!i.completionDeadline) return false;
      const dl = new Date(i.completionDeadline);
      const now = new Date();
      const twoHours = 2 * 60 * 60 * 1000;
      return dl.getTime() - now.getTime() < twoHours && dl > now;
    }),
    earliestDeadline: items
      .filter(i => i.completionDeadline)
      .map(i => i.completionDeadline!)
      .sort()[0] ?? null,
  };

  return {
    items,
    summary,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
