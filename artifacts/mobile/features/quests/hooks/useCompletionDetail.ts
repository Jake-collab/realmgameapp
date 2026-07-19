/**
 * useCompletionDetail — Full completion detail for a single participation.
 * Owner-only. Validates completion status server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchCompletionDetail } from '../repositories/questProgress.repository';
import { progressKeys } from '../queries/progressKeys';
import type { CompletionDetail } from '../types/questProgress.types';

export function useCompletionDetail(participationId: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<CompletionDetail | null>({
    queryKey: progressKeys.completionDetail(participationId ?? ''),
    queryFn: () => fetchCompletionDetail(participationId!, userId),
    enabled: !!participationId && !!userId && isSupabaseConfigured(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
