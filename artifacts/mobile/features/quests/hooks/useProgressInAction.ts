/**
 * useProgressInAction — In Action participations for the Progress screen.
 * Fetches all active/proof-state participations with embedded quest metadata.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchInActionParticipations } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { InActionItem, InActionSummary } from '../types/questProgress.types';

export interface UseProgressInActionResult {
  items: InActionItem[];
  summary: InActionSummary;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useProgressInAction(): UseProgressInActionResult {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const query = useQuery<InActionItem[]>({
    queryKey: progressKeys.inAction(userId),
    queryFn: () => fetchInActionParticipations(userId),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  const items = query.data ?? [];

  const summary: InActionSummary = {
    totalActive:         items.filter(i => ['started', 'in_progress'].includes(i.status)).length,
    awaitingProof:       items.filter(i => i.status === 'awaiting_proof').length,
    underReview:         items.filter(i => i.status === 'under_review').length,
    needsResubmission:   items.filter(i => i.status === 'needs_resubmission').length,
    hasExpiringToday:    items.some(i => {
      if (!i.expiresAt) return false;
      const exp = new Date(i.expiresAt);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return exp >= now && exp <= tomorrow;
    }),
  };

  return {
    items,
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
